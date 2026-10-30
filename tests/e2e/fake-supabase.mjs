#!/usr/bin/env node
// ÉMULATEUR SUPABASE MINIMAL — POUR LES TESTS DE BOUT EN BOUT UNIQUEMENT.
//
// Reproduit le sous-ensemble des API Supabase utilisé par l'application
// (Auth, REST/PostgREST, Storage) au-dessus d'un PostgreSQL local où les
// migrations ont été appliquées (npm run test:db le prépare). Chaque requête
// REST s'exécute avec le rôle (anon / authenticated / service_role) et les
// claims du jeton, exactement comme PostgREST : les politiques RLS, les
// privilèges de colonnes et les fonctions SQL sont donc réellement testés.
//
// Ce n'est PAS un remplaçant de Supabase et il ne doit jamais servir en
// production.
//
// Usage : TEST_DATABASE_URL=postgres://… node tests/e2e/fake-supabase.mjs
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import pg from 'pg';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const SECRET = process.env.FAKE_JWT_SECRET ?? 'test-secret-not-for-production-use-only-000';
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 10 });
const storageDir = join(tmpdir(), 'fake-supabase-storage');
mkdirSync(storageDir, { recursive: true });

// --- JWT HS256 ------------------------------------------------------------
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
export function sign(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [head, body, sig] = (token ?? '').split('.');
  if (!head || !body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  if (expected !== sig) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}

// --- Comptes (mémoire) -----------------------------------------------------
const passwords = new Map(); // userId -> password
const banned = new Set();
const refreshTokens = new Map(); // token -> userId

async function loadUser(id) {
  const { rows } = await pool.query('select id, email, raw_user_meta_data, created_at from auth.users where id = $1', [id]);
  return rows[0] ?? null;
}
function userJson(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.created_at,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.created_at,
    banned_until: banned.has(u.id) ? '2999-01-01T00:00:00Z' : null,
  };
}
function sessionFor(u) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp: now + 3600, iat: now });
  const refresh_token = randomUUID();
  refreshTokens.set(refresh_token, u.id);
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token, user: userJson(u) };
}

// --- Utilitaires HTTP ------------------------------------------------------
function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(payload);
}
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}
function claimsOf(req) {
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  return verify(bearer) ?? verify(req.headers.apikey) ?? { role: 'anon' };
}
function pgError(res, error) {
  const code = error.code ?? '';
  const status = code === '42501' ? 403 : code === '23505' || code === '23503' ? 409 : code === 'P0001' ? 400 : code.startsWith('22') || code.startsWith('23') ? 400 : 500;
  send(res, status, { code, message: error.message, details: error.detail ?? null, hint: error.hint ?? null });
}

async function asRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const role = ['anon', 'authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon';
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await client.query(`set local role ${role}`);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// --- REST (sous-ensemble PostgREST) ---------------------------------------
const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw Object.assign(new Error(`identifiant invalide : ${name}`), { code: 'PGRST100' });
  return `"${name}"`;
};

function splitTop(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const fkCache = new Map();
async function foreignKey(from, to) {
  const key = `${from}->${to}`;
  if (!fkCache.has(key)) {
    const { rows } = await pool.query(
      `select a.attname as col, af.attname as ref
         from pg_constraint c
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
         join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
        where c.contype = 'f' and c.conrelid = $1::regclass and c.confrelid = $2::regclass`,
      [`public.${from}`, `public.${to}`],
    );
    if (rows.length !== 1) throw Object.assign(new Error(`relation ${from}→${to} introuvable ou ambiguë`), { code: 'PGRST200' });
    fkCache.set(key, rows[0]);
  }
  return fkCache.get(key);
}

async function selectList(table, select, alias) {
  const items = splitTop(select || '*');
  const out = [];
  for (const item of items) {
    const m = item.match(/^([a-z_]+)\((.*)\)$/);
    if (m) {
      const [, rel, inner] = m;
      const fk = await foreignKey(table, rel);
      const innerCols = (await selectList(rel, inner, '_e')).join(', ');
      out.push(
        `(select row_to_json(_x) from (select ${innerCols} from public.${ident(rel)} _e where _e.${ident(fk.ref)} = ${alias}.${ident(fk.col)}) _x) as ${ident(rel)}`,
      );
    } else if (item === '*') out.push(`${alias}.*`);
    else out.push(`${alias}.${ident(item)}`);
  }
  return out;
}

function filters(params, values) {
  const clauses = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(key)) continue;
    const dot = raw.indexOf('.');
    const op = raw.slice(0, dot);
    const value = raw.slice(dot + 1);
    const col = `t.${ident(key)}`;
    const push = (v) => {
      values.push(v);
      return `$${values.length}`;
    };
    switch (op) {
      case 'eq': clauses.push(`${col} = ${push(value)}`); break;
      case 'neq': clauses.push(`${col} <> ${push(value)}`); break;
      case 'gt': clauses.push(`${col} > ${push(value)}`); break;
      case 'gte': clauses.push(`${col} >= ${push(value)}`); break;
      case 'lt': clauses.push(`${col} < ${push(value)}`); break;
      case 'lte': clauses.push(`${col} <= ${push(value)}`); break;
      case 'like': clauses.push(`${col}::text like ${push(value.replaceAll('*', '%'))}`); break;
      case 'ilike': clauses.push(`${col}::text ilike ${push(value.replaceAll('*', '%'))}`); break;
      case 'is': clauses.push(`${col} is ${value === 'null' ? 'null' : value === 'true' ? 'true' : 'false'}`); break;
      case 'in': {
        const list = value.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''));
        clauses.push(`${col}::text = any(${push(list)})`);
        break;
      }
      default:
        throw Object.assign(new Error(`opérateur non pris en charge : ${op}`), { code: 'PGRST100' });
    }
  }
  return clauses.length ? `where ${clauses.join(' and ')}` : '';
}

function orderBy(order) {
  if (!order) return '';
  return `order by ${order
    .split(',')
    .map((part) => {
      const [col, dir, nulls] = part.split('.');
      return `t.${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullslast' ? ' nulls last' : nulls === 'nullsfirst' ? ' nulls first' : ''}`;
    })
    .join(', ')}`;
}

async function handleRest(req, res, url, claims) {
  const path = url.pathname.replace(/^\/rest\/v1\//, '');
  const params = [...url.searchParams.entries()];
  const prefer = req.headers.prefer ?? '';
  const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object+json');

  // RPC
  if (path.startsWith('rpc/')) {
    const fn = ident(path.slice(4));
    const body = req.method === 'POST' ? JSON.parse((await readBody(req)).toString() || '{}') : Object.fromEntries(url.searchParams);
    const values = [];
    const args = Object.entries(body).map(([k, v]) => {
      values.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
      return `${ident(k)} => $${values.length}`;
    });
    const result = await asRole(claims, (c) => c.query(`select public.${fn}(${args.join(', ')}) as r`, values));
    const value = result.rows[0]?.r;
    if (value === '' || value === undefined) return send(res, 204, undefined);
    return send(res, 200, value);
  }

  const table = ident(path);
  const tableName = path;

  if (req.method === 'GET' || req.method === 'HEAD') {
    const values = [];
    const where = filters(params, values);
    const cols = (await selectList(tableName, url.searchParams.get('select'), 't')).join(', ');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    const sql = `select coalesce(json_agg(row_to_json(r)), '[]'::json) as data from (
      select ${cols} from public.${table} t ${where} ${orderBy(url.searchParams.get('order'))}
      ${limit ? `limit ${Number(limit)}` : ''} ${offset ? `offset ${Number(offset)}` : ''}) r`;
    const { data, count } = await asRole(claims, async (c) => {
      const rows = (await c.query(sql, values)).rows[0].data;
      let total = null;
      if (/count=exact/.test(prefer)) {
        total = Number((await c.query(`select count(*) as n from public.${table} t ${where}`, values)).rows[0].n);
      }
      return { data: rows, count: total };
    });
    const start = Number(offset ?? 0);
    const headers = { 'Content-Range': `${data.length ? `${start}-${start + data.length - 1}` : '*'}/${count ?? '*'}` };
    if (wantsObject) {
      if (data.length !== 1) {
        return send(res, 406, {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
          details: `The result contains ${data.length} rows`,
          hint: null,
        });
      }
      return send(res, 200, req.method === 'HEAD' ? undefined : data[0], headers);
    }
    return send(res, 200, req.method === 'HEAD' ? undefined : data, headers);
  }

  const representation = /return=representation/.test(prefer);
  const sel = url.searchParams.get('select');
  const returning = representation ? `returning ${!sel || sel === '*' ? '*' : splitTop(sel).map(ident).join(', ')}` : '';
  const toValue = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v);
  const run = async (sql, values) => {
    const wrapped = representation
      ? `with w as (${sql} ${returning}) select coalesce(json_agg(row_to_json(w)), '[]'::json) as data from w`
      : sql;
    const result = await asRole(claims, (c) => c.query(wrapped, values));
    return representation ? result.rows[0].data : null;
  };

  if (req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString());
    const rows = Array.isArray(body) ? body : [body];
    const keys = Object.keys(rows[0] ?? {});
    const values = [];
    const tuples = rows.map((row) => `(${keys.map((k) => {
      values.push(toValue(row[k]));
      return `$${values.length}`;
    }).join(', ')})`);
    const data = await run(`insert into public.${table} (${keys.map(ident).join(', ')}) values ${tuples.join(', ')}`, values);
    if (!representation) return send(res, 201, undefined);
    return send(res, 201, wantsObject ? data[0] : data);
  }

  if (req.method === 'PATCH') {
    const body = JSON.parse((await readBody(req)).toString());
    const values = [];
    const sets = Object.entries(body).map(([k, v]) => {
      values.push(toValue(v));
      return `${ident(k)} = $${values.length}`;
    });
    const where = filters(params, values);
    const data = await run(`update public.${table} t set ${sets.join(', ')} ${where}`, values);
    if (!representation) return send(res, 204, undefined);
    return send(res, 200, wantsObject ? data[0] : data);
  }

  if (req.method === 'DELETE') {
    const values = [];
    const where = filters(params, values);
    await asRole(claims, (c) => c.query(`delete from public.${table} t ${where}`, values));
    return send(res, 204, undefined);
  }

  return send(res, 405, { message: 'méthode non prise en charge' });
}

// --- Auth (sous-ensemble GoTrue) -----------------------------------------
async function handleAuth(req, res, url, claims) {
  const path = url.pathname.replace(/^\/auth\/v1/, '');

  if (path === '/token' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const userId = refreshTokens.get(body.refresh_token);
      const user = userId && (await loadUser(userId));
      if (!user || banned.has(user.id)) return send(res, 400, { code: 'refresh_token_not_found', message: 'Invalid Refresh Token' });
      return send(res, 200, sessionFor(user));
    }
    const { rows } = await pool.query('select id from auth.users where lower(email) = lower($1)', [body.email ?? '']);
    const id = rows[0]?.id;
    if (!id || passwords.get(id) !== body.password) {
      return send(res, 400, { code: 'invalid_credentials', error: 'invalid_grant', message: 'Invalid login credentials' });
    }
    if (banned.has(id)) return send(res, 400, { code: 'user_banned', message: 'User is banned' });
    return send(res, 200, sessionFor(await loadUser(id)));
  }

  if (path === '/user' && req.method === 'GET') {
    if (claims.role !== 'authenticated' || !claims.sub) return send(res, 401, { code: 'no_authorization', message: 'invalid JWT' });
    const user = await loadUser(claims.sub);
    if (!user || banned.has(user.id)) return send(res, 401, { code: 'user_not_found', message: 'User not found' });
    return send(res, 200, userJson(user));
  }

  if (path === '/logout') return send(res, 204, undefined);

  // API d'administration (clé service_role)
  if (path.startsWith('/admin/users')) {
    if (claims.role !== 'service_role') return send(res, 403, { message: 'service_role requis' });
    const id = path.split('/')[3];
    if (req.method === 'POST' && !id) {
      const body = JSON.parse((await readBody(req)).toString());
      const exists = await pool.query('select 1 from auth.users where lower(email) = lower($1)', [body.email]);
      if (exists.rowCount) return send(res, 422, { code: 'email_exists', message: 'A user with this email address has already been registered' });
      const { rows } = await pool.query(
        'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id, email, raw_user_meta_data, created_at',
        [body.email, body.user_metadata ?? {}],
      );
      passwords.set(rows[0].id, body.password);
      return send(res, 200, userJson(rows[0]));
    }
    if (req.method === 'PUT' && id) {
      const body = JSON.parse((await readBody(req)).toString());
      if (body.password) passwords.set(id, body.password);
      if (body.ban_duration === 'none') banned.delete(id);
      else if (body.ban_duration) banned.add(id);
      const user = await loadUser(id);
      return user ? send(res, 200, userJson(user)) : send(res, 404, { message: 'User not found' });
    }
    if (req.method === 'DELETE' && id) {
      await pool.query('delete from auth.users where id = $1', [id]);
      return send(res, 200, {});
    }
  }

  return send(res, 404, { message: `auth: ${req.method} ${path} non émulé` });
}

// --- Storage ---------------------------------------------------------------
async function handleStorage(req, res, url, claims) {
  const path = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\//, ''));
  if (req.method === 'GET' && path.startsWith('public/')) {
    const file = join(storageDir, path.slice(7));
    if (!existsSync(file)) return send(res, 404, { message: 'not found' });
    const meta = existsSync(`${file}.type`) ? readFileSync(`${file}.type`, 'utf8') : 'application/octet-stream';
    return send(res, 200, readFileSync(file), { 'Content-Type': meta });
  }
  // Même règle que les politiques Storage : écriture réservée aux admins.
  const isAdmin = await asRole(claims, async (c) => (await c.query('select public.is_admin() as ok')).rows[0].ok).catch(() => false);
  if (!isAdmin) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });

  if (req.method === 'POST') {
    const file = join(storageDir, path);
    mkdirSync(dirname(file), { recursive: true });
    let body = await readBody(req);
    let type = req.headers['content-type'] ?? 'application/octet-stream';
    if (type.startsWith('multipart/form-data')) {
      const form = await new Response(body, { headers: { 'content-type': type } }).formData();
      const part = [...form.values()].find((v) => typeof v === 'object');
      type = part.type;
      body = Buffer.from(await part.arrayBuffer());
    }
    writeFileSync(file, body);
    writeFileSync(`${file}.type`, type);
    return send(res, 200, { Key: path, Id: randomUUID() });
  }
  if (req.method === 'DELETE') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    for (const prefix of body.prefixes ?? []) rmSync(join(storageDir, path, prefix), { force: true });
    return send(res, 200, []);
  }
  return send(res, 405, { message: 'non émulé' });
}

// --- Serveur -----------------------------------------------------------------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') {
    return send(res, 204, undefined, { 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
  }
  const claims = claimsOf(req);
  try {
    if (url.pathname.startsWith('/rest/v1/')) return await handleRest(req, res, url, claims);
    if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url, claims);
    if (url.pathname.startsWith('/storage/v1/object/')) return await handleStorage(req, res, url, claims);
    send(res, 404, { message: 'route inconnue' });
  } catch (error) {
    if (process.env.FAKE_SUPABASE_DEBUG) console.error(req.method, req.url, error.message);
    pgError(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`fake-supabase prêt sur http://localhost:${PORT}`);
  console.log(`ANON_KEY=${sign({ role: 'anon', iss: 'fake' })}`);
  console.log(`SERVICE_ROLE_KEY=${sign({ role: 'service_role', iss: 'fake' })}`);
});
