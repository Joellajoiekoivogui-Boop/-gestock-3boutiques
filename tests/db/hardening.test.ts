import { afterAll, describe, expect, it } from 'vitest';
import { pool } from './helpers';

afterAll(async () => {
  await pool.end();
});

// Requête avec le rôle anonyme (visiteur non connecté).
async function asAnon(text: string) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role anon');
    return await client.query(text);
  } finally {
    await client.query('rollback').catch(() => {});
    client.release();
  }
}

describe('droits des visiteurs non connectés', () => {
  for (const table of ['shops', 'customers', 'expenses', 'sales', 'products', 'profiles']) {
    it(`aucun accès à ${table}`, async () => {
      await expect(asAnon(`select * from public.${table} limit 1`)).rejects.toThrow(/permission denied/);
    });
  }

  it('aucune fonction métier n’est appelable', async () => {
    for (const call of [
      `select public.add_expense('x', 10)`,
      `select public.create_customer('Test', null, null)`,
      `select public.get_dashboard_summary(null)`,
      `select public.current_business_day()`,
    ]) {
      await expect(asAnon(call)).rejects.toThrow(/permission denied/);
    }
  });

  it('seule la marque (nom, logo) est publique, pour la page de connexion', async () => {
    const { rows } = await asAnon(`select public.get_branding() as b`);
    expect(Object.keys(rows[0].b).sort()).toEqual(['logo_url', 'name', 'tagline']);
  });
});
