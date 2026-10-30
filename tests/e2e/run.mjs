#!/usr/bin/env node
// Test de bout en bout complet, reproductible :
//   1. base PostgreSQL neuve + migrations ;
//   2. émulateur Supabase (tests/e2e/fake-supabase.mjs) ;
//   3. premier administrateur via scripts/create-admin.mjs ;
//   4. build + démarrage de Next.js ;
//   5. scénario navigateur (tests/e2e/scenario.mjs).
// Prérequis : PostgreSQL local (DATABASE_ADMIN_URL) et Playwright + Chromium.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const root = new URL('../..', import.meta.url).pathname;
const adminUrl = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const dbName = 'massagui_e2e';
const dbUrl = new URL(adminUrl);
dbUrl.pathname = `/${dbName}`;
const children = [];

// Chaque service tourne dans son propre groupe de processus (npx lance des
// sous-processus) : on arrête le groupe entier.
function cleanup() {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // déjà arrêté
    }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));

async function resetDatabase() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists "${dbName}" with (force)`);
  await admin.query(`create database "${dbName}"`);
  await admin.end();
  const db = new pg.Client({ connectionString: dbUrl.toString() });
  await db.connect();
  await db.query(readFileSync(join(root, 'supabase/tests/supabase-stub.sql'), 'utf8'));
  for (const file of readdirSync(join(root, 'supabase/migrations')).sort()) {
    await db.query(readFileSync(join(root, 'supabase/migrations', file), 'utf8'));
  }
  await db.end();
}

function start(command, args, env, readyPattern) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, detached: true });
    children.push(child);
    let output = '';
    const onData = (chunk) => {
      output += chunk;
      if (readyPattern.test(output)) resolve(output);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`${command} arrêté (${code}) :\n${output}`)));
  });
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} a échoué`);
}

await resetDatabase();
console.log('✔ base de test prête');

const fakeOutput = await start('node', ['tests/e2e/fake-supabase.mjs'], { TEST_DATABASE_URL: dbUrl.toString() }, /SERVICE_ROLE_KEY=\S+/);
const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeOutput.match(/ANON_KEY=(\S+)/)[1],
  SUPABASE_SERVICE_ROLE_KEY: fakeOutput.match(/SERVICE_ROLE_KEY=(\S+)/)[1],
  ADMIN_PASSWORD: 'Admin12345678',
  NEXT_TELEMETRY_DISABLED: '1',
};
console.log('✔ émulateur Supabase démarré');

run('node', ['scripts/create-admin.mjs', '--email', 'admin@massagui.test', '--name', 'Mamadou Admin'], env);
if (!process.argv.includes('--no-build')) run('npx', ['next', 'build'], env);
await start('npx', ['next', 'start', '-p', '3100'], env, /Ready|started server|Local:/);
console.log('✔ application démarrée sur http://localhost:3100');

try {
  run('node', ['tests/e2e/scenario.mjs'], { ...env, E2E_BASE_URL: 'http://localhost:3100' });
} catch {
  process.exit(1);
}
process.exit(0);
