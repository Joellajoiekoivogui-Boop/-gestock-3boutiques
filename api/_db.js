// Client Supabase côté serveur (fonctions Vercel uniquement).
// Utilise la clé secrète (service_role) : ne JAMAIS importer ce fichier
// depuis du code qui s'exécute dans le navigateur.
import { createClient } from '@supabase/supabase-js';
import { verify } from './_lib.js';

let client = null;

export function getDb() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants).');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// Vérifie le jeton de session (même mécanisme que /api/session) et
// renvoie l'utilisateur, ou null si absent/invalide.
export function requireUser(req) {
  const secret = process.env.AUTH_SECRET;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token && secret ? verify(token, secret) : null;
  if (!payload) return null;
  return {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role === 'admin' ? 'admin' : 'gerant',
    boutiqueId: payload.boutiqueId
  };
}

export function toCamel(row) {
  if (Array.isArray(row)) return row.map(toCamel);
  if (row === null || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = v;
  }
  return out;
}
