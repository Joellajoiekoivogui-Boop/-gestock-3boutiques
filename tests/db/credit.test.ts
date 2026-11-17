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

describe('dossiers clients', () => {
  const customerOf = async (saleId: string) =>
    (await sql(`select customer_id from public.sales where id = $1`, [saleId]))[0].customer_id as string;

  it('une vente à crédit ouvre un dossier au nom du client', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], {
      method: 'credit',
      customer: 'Oumou Diallo',
      phone: '+224 621 11 22 33',
    });
    const id = await customerOf(sale.sale_id);
    const [client] = await sql(`select name, phone, created_by from public.customers where id = $1`, [id]);
    expect(client).toEqual({ name: 'Oumou Diallo', phone: '+224 621 11 22 33', created_by: cashierA });
  });

  it('le même téléphone, même écrit autrement, retrouve le même dossier', async () => {
    const first = await createSale(cashierA, [{ product_id: product, quantity: 1 }], {
      method: 'credit',
      customer: 'Alpha Condé',
      phone: '+224 655 44 33 22',
    });
    const second = await createSale(cashierB, [{ product_id: product, quantity: 1 }], {
      method: 'credit',
      customer: 'Alpha',
      phone: '655443322',
    });
    expect(await customerOf(second.sale_id)).toBe(await customerOf(first.sale_id));
    const [row] = await sql(`select customer_name from public.sales where id = $1`, [second.sale_id]);
    expect(row.customer_name).toBe('Alpha Condé');
  });

  it('une vente peut viser un dossier choisi à la caisse', async () => {
    const id = await as(cashierA, async (c) => {
      const { rows } = await c.query(`select public.create_customer('Hawa Sylla', '+224 664 00 11 22') as id`);
      return rows[0].id as string;
    });
    const sale = await createSale(cashierB, [{ product_id: product, quantity: 1 }], { method: 'credit', customerId: id });
    expect(await customerOf(sale.sale_id)).toBe(id);
    const [row] = await sql(`select customer_name, customer_phone from public.sales where id = $1`, [sale.sale_id]);
    expect(row).toEqual({ customer_name: 'Hawa Sylla', customer_phone: '+224 664 00 11 22' });
  });

  it('refuse un second dossier avec le même téléphone', async () => {
    await as(cashierA, (c) => c.query(`select public.create_customer('Binta', '+224 610 10 10 10')`));
    await expect(as(cashierB, (c) => c.query(`select public.create_customer('Binta B', '610101010')`))).rejects.toThrow(
      /existe déjà/,
    );
  });

  it('un caissier lit les dossiers mais ne les modifie pas ; l’admin peut', async () => {
    const id = await as(cashierA, async (c) => (await c.query(`select public.create_customer('Moussa Keita') as id`)).rows[0].id as string);
    const seen = await as(cashierB, (c) => c.query(`select id from public.customers where id = $1`, [id]));
    expect(seen.rowCount).toBe(1);
    await as(cashierB, (c) => c.query(`update public.customers set name = 'Changé' where id = $1`, [id]));
    expect((await sql(`select name from public.customers where id = $1`, [id]))[0].name).toBe('Moussa Keita');
    await as(admin, (c) => c.query(`update public.customers set phone = '+224 600 99 99 99' where id = $1`, [id]));
    expect((await sql(`select phone from public.customers where id = $1`, [id]))[0].phone).toBe('+224 600 99 99 99');
  });

  it('une vente ne change pas de dossier', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'credit', customer: 'Lansana' });
    const other = await as(admin, async (c) => (await c.query(`select public.create_customer('Autre client') as id`)).rows[0].id as string);
    await expect(sql(`update public.sales set customer_id = $2 where id = $1`, [sale.sale_id, other])).rejects.toThrow(
      /ne peut pas être changé/,
    );
  });

  it('une vente ordinaire n’ouvre pas de dossier', async () => {
    const sale = await createSale(cashierA, [{ product_id: product, quantity: 1 }], { method: 'cash', customer: 'Ignoré' });
    expect(await customerOf(sale.sale_id)).toBeNull();
  });
});
