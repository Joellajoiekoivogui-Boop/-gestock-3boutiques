import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createProduct, createSale, createUser, pool, sql } from './helpers';

let admin: string;
let cashier: string;
let manager: string;
let shop: string;
let shopB: string;
let plat: string;
let boisson: string;

const report = (uid: string, shopId: string | null) =>
  as(uid, async (c) => {
    const { rows } = await c.query(
      `select public.get_sales_report(public.current_business_day(), public.current_business_day(), $1::uuid) as r`,
      [shopId],
    );
    return rows[0].r as Record<string, unknown> & {
      by_shop: { shop_id: string; name: string; count: number; net: number }[];
      margin?: { revenue_with_cost: number; cost_total: number; margin: number; revenue_without_cost: number };
      top_margin?: { product_id: string; quantity: number; margin: number }[];
    };
  });

beforeAll(async () => {
  // Boutiques propres à ce fichier : chiffres indépendants des autres tests.
  [{ id: shop }] = await sql<{ id: string }>(
    `insert into public.shops (name, sort_order) values ('Boutique marge', 97) returning id`,
  );
  [{ id: shopB }] = await sql<{ id: string }>(
    `insert into public.shops (name, sort_order) values ('Boutique marge B', 96) returning id`,
  );
  admin = await createUser({ role: 'admin', name: 'Admin Marge' });
  cashier = await createUser({ name: 'Caissier Marge', shop });
  manager = await createUser({ name: 'Gérant Marge', shop, permissions: ['view_reports'] });
  plat = await createProduct({ name: 'Plat marge', price: 50000, shop });
  boisson = await createProduct({ name: 'Boisson sans coût', price: 10000, shop });
});

afterAll(async () => {
  await pool.end();
});

describe('prix d’achat', () => {
  it('seul l’administrateur le fixe et le lit ; le changement est tracé', async () => {
    await expect(
      as(cashier, (c) => c.query(`select public.set_product_cost($1::uuid, 30000)`, [plat])),
    ).rejects.toThrow(/Seul l'administrateur/);
    await as(admin, (c) => c.query(`select public.set_product_cost($1::uuid, 30000)`, [plat]));
    const seenByCashier = await as(cashier, async (c) => (await c.query(`select * from public.product_costs`)).rows);
    expect(seenByCashier).toHaveLength(0);
    const seenByAdmin = await as(
      admin,
      async (c) => (await c.query(`select cost_price from public.product_costs where product_id = $1`, [plat])).rows,
    );
    expect(Number(seenByAdmin[0].cost_price)).toBe(30000);
    const logs = await sql(
      `select action from public.audit_logs where entity_id = $1 and action = 'product.cost_changed'`,
      [plat],
    );
    expect(logs.length).toBe(1);
  });

  it('refuse un prix invalide ; null efface le prix', async () => {
    await expect(as(admin, (c) => c.query(`select public.set_product_cost($1::uuid, -5)`, [plat]))).rejects.toThrow(
      /invalide/,
    );
    await as(admin, (c) => c.query(`select public.set_product_cost($1::uuid, 1)`, [boisson]));
    await as(admin, (c) => c.query(`select public.set_product_cost($1::uuid, null)`, [boisson]));
    expect((await sql(`select 1 from public.product_costs where product_id = $1`, [boisson])).length).toBe(0);
  });

  it('les coûts mémorisés des ventes sont invisibles et figés', async () => {
    await expect(as(cashier, (c) => c.query(`select * from public.sale_item_costs`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(admin, (c) => c.query(`select * from public.sale_item_costs`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('marge et boutiques dans le rapport', () => {
  it('coût figé à la vente : changer le prix d’achat ensuite ne change pas la marge passée', async () => {
    await createSale(cashier, [
      { product_id: plat, quantity: 2 }, // 100 000, coût 60 000
      { product_id: boisson, quantity: 3 }, // 30 000, sans coût
    ]);
    await as(admin, (c) => c.query(`select public.set_product_cost($1::uuid, 45000)`, [plat]));
    const r = await report(admin, shop);
    expect(r.margin).toMatchObject({});
    expect(Number(r.margin!.revenue_with_cost)).toBe(100000);
    expect(Number(r.margin!.cost_total)).toBe(60000);
    expect(Number(r.margin!.margin)).toBe(40000);
    expect(Number(r.margin!.revenue_without_cost)).toBe(30000);
    expect(r.top_margin!.map((p) => p.product_id)).toEqual([plat]);
  });

  it('le gérant voit le rapport de sa boutique, sans la marge', async () => {
    const r = await report(manager, null);
    expect(r.margin).toBeUndefined();
    expect(r.top_margin).toBeUndefined();
    expect(r.by_shop.map((s) => s.shop_id)).toEqual([shop]);
  });

  it('l’administrateur voit les boutiques côte à côte', async () => {
    const other = await createUser({ name: 'Caissier B', shop: shopB });
    const p = await createProduct({ name: 'Produit B', price: 20000, shop: shopB });
    await createSale(other, [{ product_id: p, quantity: 1 }]);
    const r = await report(admin, null);
    const mine = r.by_shop.find((s) => s.shop_id === shop)!;
    const theirs = r.by_shop.find((s) => s.shop_id === shopB)!;
    expect(Number(mine.net)).toBe(130000);
    expect(Number(theirs.net)).toBe(20000);
    expect(Number(theirs.count)).toBe(1);
  });
});
