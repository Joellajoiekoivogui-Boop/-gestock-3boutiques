import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createProduct, createSale, createUser, pool, SHOP1, SHOP2, sql } from './helpers';

let admin: string;
let cashier1: string;
let cashier1b: string;
let cashier2: string;
let manager1: string;

beforeAll(async () => {
  admin = await createUser({ role: 'admin', name: 'Admin Dépenses' });
  cashier1 = await createUser({ name: 'Caissier dépenses NP1', shop: SHOP1 });
  cashier1b = await createUser({ name: 'Autre caissier NP1', shop: SHOP1 });
  cashier2 = await createUser({ name: 'Caissier dépenses NP2', shop: SHOP2 });
  manager1 = await createUser({ name: 'Gérant dépenses NP1', shop: SHOP1, permissions: ['view_all_sales'] });
});

afterAll(async () => {
  await pool.end();
});

const add = (uid: string, label: string, amount: number, shop: string | null = null, day: string | null = null) =>
  as(uid, async (c) => {
    const { rows } = await c.query(`select public.add_expense($1, $2, $3::uuid, $4::date) as id`, [
      label,
      amount,
      shop,
      day,
    ]);
    return rows[0].id as string;
  });
const visible = (uid: string) =>
  as(uid, async (c) => (await c.query(`select id from public.expenses`)).rows.map((r) => r.id as string));

describe('journée de vente (7h → 7h)', () => {
  it('commence à 7h : avant 7h, c’est encore la veille', async () => {
    const [row] = await sql<{ a: string; b: string; c: string }>(
      `select to_char((timestamp '2026-11-17 04:00' - public.day_start())::date, 'YYYY-MM-DD') as a,
              to_char((timestamp '2026-11-17 06:59' - public.day_start())::date, 'YYYY-MM-DD') as b,
              to_char((timestamp '2026-11-17 07:00' - public.day_start())::date, 'YYYY-MM-DD') as c`,
    );
    expect(row).toEqual({ a: '2026-11-16', b: '2026-11-16', c: '2026-11-17' });
  });

  it('le rapport de la journée en cours contient la vente qui vient d’être faite', async () => {
    // Boutique propre à ce test : le classement des produits n'est pas mêlé aux autres.
    const [{ id: shop }] = await sql<{ id: string }>(
      `insert into public.shops (name, sort_order) values ('Boutique journée', 98) returning id`,
    );
    const seller = await createUser({ name: 'Caissier journée', shop });
    const product = await createProduct({ name: 'Plat journée', price: 7000, shop });
    await createSale(seller, [{ product_id: product, quantity: 1 }]);
    const report = await as(admin, async (c) => {
      const { rows } = await c.query(
        `select public.get_sales_report(public.current_business_day(), public.current_business_day(), $1::uuid) as r`,
        [shop],
      );
      return rows[0].r as { top_products: { product_id: string }[] };
    });
    expect(report.top_products.map((p) => p.product_id)).toContain(product);
  });
});

describe('dépenses de caisse', () => {
  it('le caissier note une dépense : sa boutique, la journée en cours, son nom', async () => {
    const id = await add(cashier1, 'Piment et oignons', 15000);
    const [row] = await sql<{ shop_id: string; ok: boolean; created_by_name: string; amount: string }>(
      `select shop_id, business_date = public.current_business_day() as ok, created_by_name, amount
         from public.expenses where id = $1`,
      [id],
    );
    expect(row).toMatchObject({ shop_id: SHOP1, ok: true, created_by_name: 'Caissier dépenses NP1' });
    expect(Number(row.amount)).toBe(15000);
  });

  it('refuse un prix invalide, un libellé vide, une autre boutique ou une autre date', async () => {
    await expect(add(cashier1, 'Sel', 0)).rejects.toThrow(/prix de la dépense est invalide/);
    await expect(add(cashier1, 'Sel', 99.5)).rejects.toThrow(/prix de la dépense est invalide/);
    await expect(add(cashier1, ' ', 1000)).rejects.toThrow(/Indiquez ce qui a été acheté/);
    await expect(add(cashier1, 'Sel', 1000, SHOP2)).rejects.toThrow(/que dans votre boutique/);
    await expect(add(cashier1, 'Sel', 1000, null, '2026-01-01')).rejects.toThrow(/le jour même/);
  });

  it('chacun voit ses dépenses ; le gérant voit celles de sa boutique ; l’admin voit tout', async () => {
    const mine = await add(cashier1, 'Cube Maggi', 5000);
    const other = await add(cashier1b, 'Huile', 30000);
    const far = await add(cashier2, 'Tomates', 8000);
    const seen1 = await visible(cashier1);
    expect(seen1).toContain(mine);
    expect(seen1).not.toContain(other);
    const seenManager = await visible(manager1);
    expect(seenManager).toEqual(expect.arrayContaining([mine, other]));
    expect(seenManager).not.toContain(far);
    expect(await visible(admin)).toEqual(expect.arrayContaining([mine, other, far]));
  });

  it('l’administrateur note une dépense d’un jour passé dans la boutique choisie, pas dans le futur', async () => {
    const id = await add(admin, 'Charbon', 20000, SHOP2, '2026-01-10');
    const [row] = await sql<{ shop_id: string; d: string }>(
      `select shop_id, to_char(business_date, 'YYYY-MM-DD') as d from public.expenses where id = $1`,
      [id],
    );
    expect(row).toEqual({ shop_id: SHOP2, d: '2026-01-10' });
    await expect(add(admin, 'Charbon', 20000, SHOP2, '2999-01-01')).rejects.toThrow(/futur/);
  });

  it('seul l’administrateur supprime une dépense, et la suppression est tracée ; personne ne la modifie', async () => {
    const id = await add(cashier1, 'Ail', 2000);
    await as(cashier1, (c) => c.query(`delete from public.expenses where id = $1`, [id]));
    expect((await sql(`select 1 from public.expenses where id = $1`, [id])).length).toBe(1);
    await expect(sql(`update public.expenses set amount = 1 where id = $1`, [id])).rejects.toThrow(/ni modifiées/);
    await as(admin, (c) => c.query(`delete from public.expenses where id = $1`, [id]));
    expect((await sql(`select 1 from public.expenses where id = $1`, [id])).length).toBe(0);
    const logs = await sql(`select action from public.audit_logs where entity_id = $1 order by id`, [id]);
    expect(logs.map((l) => l.action)).toEqual(['expenses.insert', 'expenses.delete']);
  });
});
