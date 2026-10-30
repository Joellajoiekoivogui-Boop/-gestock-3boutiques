#!/usr/bin/env node
// Tests d'intégration de la base de données.
//
// Crée une base PostgreSQL jetable, y applique un « bouchon » de
// l'environnement Supabase (auth.uid(), rôles anon/authenticated…) puis TOUTES
// les migrations de supabase/migrations, et lance les tests de tests/db.
//
// Prérequis : un PostgreSQL 15+ accessible. Par défaut :
//   DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres
// Usage : npm run test:db
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const adminUrl = process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const dbName = process.env.TEST_DATABASE_NAME ?? 'massagui_test';

const root = new URL('..', import.meta.url).pathname;
const migrationsDir = join(root, 'supabase', 'migrations');

async function main() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists "${dbName}" with (force)`);
  await admin.query(`create database "${dbName}"`);
  await admin.end();

  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${dbName}`;

  const db = new pg.Client({ connectionString: testUrl.toString() });
  await db.connect();
  await db.query(readFileSync(join(root, 'supabase', 'tests', 'supabase-stub.sql'), 'utf8'));
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    process.stdout.write(`→ migration ${file}\n`);
    await db.query(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  await db.end();

  const result = spawnSync('npx', ['vitest', 'run', '--config', 'vitest.db.config.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, TEST_DATABASE_URL: testUrl.toString() },
  });
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
