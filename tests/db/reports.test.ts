import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createProduct, createSale, createUser, n, pool, sql } from './helpers';

let admin: string;
let cashier: string;

type Report = Record<string, unknown> & {
  by_day: { day: string; gross: number; refunds: number; net: number; count: number }[];
  by_payment_method: { code: string; gross: number; refunds: number; net: number; count: number }[];
  top_products: { product_id: string; name: string; quantity: number; revenue: number }[];
  by_category: { name: string; revenue: number }[];
  by_cashier: { cashier_id: string; count: number; gross: number; refunds: number; cancelled_count: number }[];
};

async function today(): Promise<string> {
  const [row] = await sql<{ d: string }>(
    `select to_char((now() at time zone timezone)::date, 'YYYY-MM-DD') as d from public.restaurant_settings`,
  );
  return row.d;
}

async function report(uid: string, from: string, to: string): Promise<Report> {
  return as(uid, async (c) => {
    const { rows } = await c.query(`select public.get_sales_report($1::date, $2::date) as r`, [from, to]);
    return rows[0].r as Report;
  });
}

beforeAll(async () => {
  admin = await createUser({ role: 'admin' });
  cashier = await createUser({ name: 'Caissier Rapport' });
});

afterAll(async () => {
  await pool.end();
});

describe('get_sales_report', () => {
  it('calcule le CA net en excluant les annulations et en déduisant les remboursements', async () => {
    const day = await today();
    const before = await report(admin, day, day);

    const plat = await createProduct({ name: 'Plat rapport', price: 20000 });
    const boisson = await createProduct({ name: 'Boisson rapport', price: 5000 });

    const s1 = await createSale(cashier, [
      { product_id: plat, quantity: 2 },
      { product_id: boisson, quantity: 2 },
    ]); // 50 000
    const s2 = await createSale(cashier, [{ product_id: boisson, quantity: 1 }], { method: 'orange_money' }); // 5 000
    const s3 = await createSale(cashier, [{ product_id: plat, quantity: 1 }]); // 20 000, annulée ensuite

    await as(admin, (c) => c.query(`select public.cancel_sale($1, 'Erreur')`, [s3.sale_id]));
    await as(admin, (c) => c.query(`select public.refund_sale($1, 5000, 'Boisson renversée')`, [s1.sale_id]));
    expect(s2.receipt_number).toBeTruthy();

    const after = await report(admin, day, day);
    const delta = (key: string) => n(after[key]) - n(before[key]);

    expect(delta('gross_sales')).toBe(55000);
    expect(delta('refunds_total')).toBe(5000);
    expect(delta('net_revenue')).toBe(50000);
    expect(delta('sales_count')).toBe(2);
    expect(delta('cancelled_count')).toBe(1);
    expect(delta('cancelled_amount')).toBe(20000);
    expect(delta('items_sold')).toBe(5);
    expect(n(after.average_basket)).toBe(Math.round(n(after.gross_sales) / n(after.sales_count)));

    // Série journalière : une entrée par jour, cohérente avec les totaux.
    expect(after.by_day).toHaveLength(1);
    expect(n(after.by_day[0].net)).toBe(n(after.net_revenue));

    const orange = after.by_payment_method.find((m) => m.code === 'orange_money')!;
    const orangeBefore = before.by_payment_method.find((m) => m.code === 'orange_money');
    expect(n(orange.gross) - n(orangeBefore?.gross ?? 0)).toBe(5000);

    const platLine = after.top_products.find((p) => p.product_id === plat)!;
    expect(n(platLine.quantity)).toBe(2); // la vente annulée n'est pas comptée
    expect(n(platLine.revenue)).toBe(40000);

    const me = after.by_cashier.find((c) => c.cashier_id === cashier)!;
    expect(n(me.count)).toBe(2);
    expect(n(me.gross)).toBe(55000);
    expect(n(me.refunds)).toBe(5000);
    expect(n(me.cancelled_count)).toBe(1);
  });

  it('renvoie des zéros et des listes vides pour une période sans vente', async () => {
    const r = await report(admin, '2001-01-01', '2001-01-07');
    expect(n(r.net_revenue)).toBe(0);
    expect(n(r.sales_count)).toBe(0);
    expect(n(r.average_basket)).toBe(0);
    expect(r.by_day).toHaveLength(7);
    expect(r.top_products).toEqual([]);
    expect(r.by_payment_method).toEqual([]);
  });

  it('refuse une période invalide ou un utilisateur sans permission', async () => {
    await expect(report(admin, '2026-02-01', '2026-01-01')).rejects.toThrow(/Période invalide/);
    await expect(report(admin, '2024-01-01', '2026-01-01')).rejects.toThrow(/un an/);
    await expect(report(cashier, '2026-01-01', '2026-01-02')).rejects.toThrow(/pas autorisé/);
    const analyst = await createUser({ permissions: ['view_reports'] });
    await expect(report(analyst, '2026-01-01', '2026-01-02')).resolves.toBeTruthy();
  });
});

describe('get_dashboard_summary', () => {
  it('réservé à l’admin, cohérent avec le rapport du jour', async () => {
    await expect(as(cashier, (c) => c.query(`select public.get_dashboard_summary()`))).rejects.toThrow(
      /réservé aux administrateurs/,
    );
    const summary = await as(admin, async (c) => (await c.query(`select public.get_dashboard_summary() as s`)).rows[0].s);
    const day = await today();
    const r = await report(admin, day, day);
    expect(n(summary.periods.today.net)).toBe(n(r.net_revenue));
    expect(n(summary.periods.month.net)).toBeGreaterThanOrEqual(n(summary.periods.today.net));
    expect(n(summary.active_products)).toBeGreaterThan(0);
  });
});
