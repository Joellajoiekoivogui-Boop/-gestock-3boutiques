import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createProduct, createSale, createUser, n, pool, sql } from './helpers';

let admin: string;
let cashierA: string;
let cashierB: string;
let product: string;

beforeAll(async () => {
  admin = await createUser({ role: 'admin', name: 'Admin Crédit' });
  cashierA = await createUser({ name: 'Caissier A' });
  cashierB = await createUser({ name: 'Caissier B' });
  product = await createProduct({ name: 'Poulet yassa', price: 55000 });
});

afterAll(async () => {
  await pool.end();
});

const settle = (uid: string, saleId: string, method: string) =>
  as(uid, (c) => c.query(`select public.settle_credit($1::uuid, $2) as result`, [saleId, method]));

describe('modes de paiement', () => {
  it('propose le Crédit et désactive MTN Mobile Money et le virement', async () => {
    const rows = await sql(`select code, is_active from public.payment_methods order by code`);
    const active = Object.fromEntries(rows.map((r) => [r.code, r.is_active]));
    expect(active.credit).toBe(true);
    expect(active.mtn_momo).toBe(false);
    expect(active.bank_transfer).toBe(false);
  });

  it('refuse une vente avec un mode désactivé', async () => {
    await expect(createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'mtn_momo' })).rejects.toThrow(
      /Mode de paiement invalide ou désactivé/,
    );
  });
});

describe('vente à crédit', () => {
  it('exige le nom du client', async () => {
    await expect(createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'credit' })).rejects.toThrow(
      /nom du client/,
    );
  });

  it('enregistre la vente « à payer » avec le client', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 2 }], {
      method: 'credit',
      customer: '  Mamadou Bah ',
      phone: '+224 622 00 00 00',
    });
    const [row] = await sql(
      `select payment_status, customer_name, customer_phone, total_amount, paid_at from public.sales where id = $1`,
      [sale.sale_id],
    );
    expect(row.payment_status).toBe('pending');
    expect(row.customer_name).toBe('Mamadou Bah');
    expect(row.customer_phone).toBe('+224 622 00 00 00');
    expect(n(row.total_amount)).toBe(110000);
    expect(row.paid_at).toBeNull();
  });

  it('une vente ordinaire reste payée, sans client', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'cash' });
    const [row] = await sql(`select payment_status, customer_name from public.sales where id = $1`, [sale.sale_id]);
    expect(row).toEqual({ payment_status: 'paid', customer_name: null });
  });
});

describe('règlement d’un crédit', () => {
  it('le caissier règle son propre crédit, avec le mode réellement utilisé et une trace', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'credit', customer: 'Fatou' });
    await settle(cashierA, sale.sale_id, 'orange_money');
    const [row] = await sql(
      `select payment_status, settled_payment_method, settled_payment_label, settled_by, paid_at, payment_method
         from public.sales where id = $1`,
      [sale.sale_id],
    );
    expect(row.payment_status).toBe('paid');
    expect(row.payment_method).toBe('credit');
    expect(row.settled_payment_method).toBe('orange_money');
    expect(row.settled_payment_label).toBe('Orange Money');
    expect(row.settled_by).toBe(cashierA);
    expect(row.paid_at).not.toBeNull();
    const [log] = await sql(
      `select action from public.audit_logs where entity_id = $1 and action = 'sale.credit_settled'`,
      [sale.sale_id],
    );
    expect(log.action).toBe('sale.credit_settled');
  });

  it('refuse un second règlement', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'credit', customer: 'Ibrahima' });
    await settle(cashierA, sale.sale_id, 'cash');
    await expect(settle(cashierA, sale.sale_id, 'cash')).rejects.toThrow(/déjà réglé/);
  });

  it('refuse de régler avec le mode Crédit ou un mode désactivé', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'credit', customer: 'Kadiatou' });
    await expect(settle(cashierA, sale.sale_id, 'credit')).rejects.toThrow(/Mode de paiement invalide/);
    await expect(settle(cashierA, sale.sale_id, 'bank_transfer')).rejects.toThrow(/Mode de paiement invalide/);
  });

  it('un autre caissier ne peut pas régler le crédit d’un collègue ; l’admin peut', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'credit', customer: 'Sékou' });
    await expect(settle(cashierB, sale.sale_id, 'cash')).rejects.toThrow(/pas autorisé/);
    await settle(admin, sale.sale_id, 'cash');
    const [row] = await sql(`select payment_status, settled_by from public.sales where id = $1`, [sale.sale_id]);
    expect(row).toEqual({ payment_status: 'paid', settled_by: admin });
  });

  it('une vente payée ne peut pas repasser « à payer », même par un admin en direct', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'cash' });
    await expect(sql(`update public.sales set payment_status = 'pending' where id = $1`, [sale.sale_id])).rejects.toThrow(
      /repasser/,
    );
  });

  it('le client d’une vente ne peut pas être changé après coup', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'credit', customer: 'Aïssata' });
    await expect(sql(`update public.sales set customer_name = 'Autre' where id = $1`, [sale.sale_id])).rejects.toThrow(
      /ne peut pas être modifié/,
    );
  });
});
