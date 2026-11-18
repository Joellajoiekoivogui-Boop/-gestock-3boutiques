import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createProduct, createSale, createUser, pool, SHOP1, SHOP2, sql } from './helpers';

let admin: string;
let adminNoShop: string;
let cashier1: string;
let cashier2: string;
let manager1: string;
let product1: string;
let product2: string;

beforeAll(async () => {
  admin = await createUser({ role: 'admin', name: 'Admin Boutiques' });
  adminNoShop = await createUser({
    role: 'admin',
    name: 'Admin sans boutique',
    shop: null,
  });
  cashier1 = await createUser({ name: 'Caissier NP1', shop: SHOP1 });
  cashier2 = await createUser({ name: 'Caissier NP2', shop: SHOP2 });
  manager1 = await createUser({
    name: 'Gérant NP1',
    shop: SHOP1,
    permissions: ['view_all_sales', 'cancel_sales', 'refund_sales', 'manage_stock', 'view_reports'],
  });
  product1 = await createProduct({
    name: 'Savon NP1',
    price: 5000,
    trackStock: true,
    stock: 20,
    shop: SHOP1,
  });
  product2 = await createProduct({
    name: 'Savon NP2',
    price: 6000,
    trackStock: true,
    stock: 20,
    shop: SHOP2,
  });
});

afterAll(async () => {
  await pool.end();
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('boutiques', () => {
  it('existent : Nabele Plus 1 et Nabele Plus 2', async () => {
    const rows = await sql<{ name: string }>(
      `select name from public.shops where id in ('${SHOP1}', '${SHOP2}') order by sort_order`,
    );
    expect(rows.map((r) => r.name)).toEqual(['Nabele Plus 1', 'Nabele Plus 2']);
  });

  it('un caissier ne voit que sa boutique et ses produits ; l’admin voit tout', async () => {
    const shops1 = await as(cashier1, async (c) => (await c.query(`select id from public.shops`)).rows);
    expect(ids(shops1)).toEqual([SHOP1]);
    const prods1 = ids(await as(cashier1, async (c) => (await c.query(`select id from public.products`)).rows));
    expect(prods1).toContain(product1);
    expect(prods1).not.toContain(product2);
    const prodsAdmin = ids(await as(admin, async (c) => (await c.query(`select id from public.products`)).rows));
    expect(prodsAdmin).toEqual(expect.arrayContaining([product1, product2]));
  });
});

describe('ventes par boutique', () => {
  it('la vente est enregistrée dans la boutique du caissier', async () => {
    const sale = await createSale(cashier2, [{ product_id: product2, quantity: 1 }]);
    const [row] = await sql<{ shop_id: string }>(`select shop_id from public.sales where id = $1`, [sale.sale_id]);
    expect(row.shop_id).toBe(SHOP2);
  });

  it('refuse un produit d’une autre boutique et une boutique qui n’est pas la sienne', async () => {
    await expect(createSale(cashier1, [{ product_id: product2, quantity: 1 }])).rejects.toThrow(
      /n'appartient pas à la boutique/,
    );
    await expect(
      createSale(cashier1, [{ product_id: product1, quantity: 1 }], {
        shopId: SHOP2,
      }),
    ).rejects.toThrow(/que dans votre boutique/);
  });

  it('l’admin vend dans la boutique choisie, et doit en choisir une', async () => {
    const sale = await createSale(admin, [{ product_id: product2, quantity: 1 }], { shopId: SHOP2 });
    const [row] = await sql<{ shop_id: string }>(`select shop_id from public.sales where id = $1`, [sale.sale_id]);
    expect(row.shop_id).toBe(SHOP2);
    await expect(createSale(adminNoShop, [{ product_id: product1, quantity: 1 }])).rejects.toThrow(
      /Choisissez la boutique/,
    );
  });

  it('refuse un caissier sans boutique', async () => {
    const lost = await createUser({ name: 'Sans boutique', shop: null });
    await expect(createSale(lost, [{ product_id: product1, quantity: 1 }])).rejects.toThrow(/Choisissez la boutique/);
  });

  it('le stock de chaque boutique est séparé', async () => {
    const before = await sql<{ id: string; stock_quantity: number }>(
      `select id, stock_quantity from public.products where id = any($1::uuid[])`,
      [[product1, product2]],
    );
    await createSale(cashier1, [{ product_id: product1, quantity: 2 }]);
    const after = await sql<{ id: string; stock_quantity: number }>(
      `select id, stock_quantity from public.products where id = any($1::uuid[])`,
      [[product1, product2]],
    );
    const s = (rows: typeof before, id: string) => rows.find((r) => r.id === id)!.stock_quantity;
    expect(s(after, product1)).toBe(s(before, product1) - 2);
    expect(s(after, product2)).toBe(s(before, product2));
  });

  it('la boutique d’une vente ne peut pas changer', async () => {
    const sale = await createSale(cashier1, [{ product_id: product1, quantity: 1 }]);
    await expect(sql(`update public.sales set shop_id = $2 where id = $1`, [sale.sale_id, SHOP2])).rejects.toThrow(
      /boutique d'une vente/,
    );
  });
});

describe('droits limités à sa boutique', () => {
  it('un gérant qui voit toutes les ventes ne voit que celles de sa boutique', async () => {
    const other = await createSale(cashier2, [{ product_id: product2, quantity: 1 }]);
    const mine = await createSale(cashier1, [{ product_id: product1, quantity: 1 }]);
    const seen = ids(await as(manager1, async (c) => (await c.query(`select id from public.sales`)).rows));
    expect(seen).toContain(mine.sale_id);
    expect(seen).not.toContain(other.sale_id);
  });

  it('ne peut ni annuler, ni rembourser, ni encaisser un crédit dans l’autre boutique', async () => {
    const other = await createSale(cashier2, [{ product_id: product2, quantity: 1 }]);
    await expect(
      as(manager1, (c) => c.query(`select public.cancel_sale($1::uuid, 'Erreur')`, [other.sale_id])),
    ).rejects.toThrow(/Vente introuvable/);
    await expect(
      as(manager1, (c) => c.query(`select public.refund_sale($1::uuid, 1000, 'Erreur')`, [other.sale_id])),
    ).rejects.toThrow(/Vente introuvable/);
    const credit = await createSale(cashier2, [{ product_id: product2, quantity: 1 }], {
      method: 'credit',
      customer: 'Client NP2',
    });
    await expect(
      as(manager1, (c) => c.query(`select public.settle_credit($1::uuid, 'cash')`, [credit.sale_id])),
    ).rejects.toThrow(/Vente introuvable/);
  });

  it('ne modifie aucun stock : réservé à l’administrateur, qui gère les deux boutiques', async () => {
    for (const product of [product1, product2]) {
      await expect(
        as(manager1, (c) => c.query(`select public.record_stock_movement($1::uuid, 'restock', 5, null)`, [product])),
      ).rejects.toThrow(/Seul l'administrateur/);
      await as(admin, (c) => c.query(`select public.record_stock_movement($1::uuid, 'restock', 5, null)`, [product]));
    }
    const seen = await as(manager1, async (c) => (await c.query(`select id from public.stock_movements`)).rows);
    expect(seen).toHaveLength(0);
  });

  it('un caissier ne peut pas changer sa propre boutique', async () => {
    await as(cashier1, (c) => c.query(`update public.profiles set shop_id = $2 where id = $1`, [cashier1, SHOP2]));
    const [row] = await sql<{ shop_id: string }>(`select shop_id from public.profiles where id = $1`, [cashier1]);
    expect(row.shop_id).toBe(SHOP1);
  });
});

describe('rapports par boutique', () => {
  const report = (uid: string, shop: string | null) =>
    as(uid, async (c) => {
      const { rows } = await c.query(
        `select public.get_sales_report(current_date - 1, current_date + 1, $1::uuid) as r`,
        [shop],
      );
      return rows[0].r as { gross_sales: number; shop_id: string | null };
    });

  it('l’admin voit chaque boutique ou les deux cumulées', async () => {
    const all = await report(admin, null);
    const one = await report(admin, SHOP1);
    const two = await report(admin, SHOP2);
    // D'autres fichiers de test ajoutent leur propre boutique : « toutes » contient au moins les deux.
    expect(Number(all.gross_sales)).toBeGreaterThanOrEqual(Number(one.gross_sales) + Number(two.gross_sales));
    expect(Number(one.gross_sales)).toBeGreaterThan(0);
    expect(Number(two.gross_sales)).toBeGreaterThan(0);

    const dash = await as(admin, async (c) => {
      const { rows } = await c.query(`select public.get_dashboard_summary($1::uuid) as s`, [SHOP2]);
      return rows[0].s as { periods: { today: { gross: number } } };
    });
    expect(Number(dash.periods.today.gross)).toBe(Number(two.gross_sales));
  });

  it('un gérant est toujours limité à sa boutique', async () => {
    const mine = await report(manager1, null);
    expect(mine.shop_id).toBe(SHOP1);
    await expect(report(manager1, SHOP2)).rejects.toThrow(/qu'à votre boutique/);
  });
});
