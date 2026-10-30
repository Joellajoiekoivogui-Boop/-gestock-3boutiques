import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createProduct, createSale, createUser, n, pool, sql, stockOf, withProductHeld } from './helpers';

let admin: string;
let cashier: string;

beforeAll(async () => {
  admin = await createUser({ role: 'admin', name: 'Admin Test' });
  cashier = await createUser({ name: 'Awa Caissière' });
});

afterAll(async () => {
  await pool.end();
});

const receiptSeq = (receipt: string) => Number(receipt.split('-').at(-1));

describe('create_sale — calculs et enregistrement', () => {
  it('recalcule les montants à partir des prix en base et ignore les prix envoyés', async () => {
    const riz = await createProduct({ name: 'Riz au poulet', price: 25000 });
    const jus = await createProduct({ name: 'Jus naturel', price: 10000 });

    const result = await createSale(cashier, [
      { product_id: riz, quantity: 2, unit_price: 1 },
      { product_id: jus, quantity: 1, price: 0 },
    ]);

    expect(result.replayed).toBe(false);
    expect(n(result.total_amount)).toBe(60000);
    expect(result.receipt_number).toMatch(/^MG-\d{4}-\d{6}$/);

    const [sale] = await sql(`select * from public.sales where id = $1`, [result.sale_id]);
    expect(n(sale.subtotal)).toBe(60000);
    expect(n(sale.discount_amount)).toBe(0);
    expect(n(sale.total_amount)).toBe(60000);
    expect(sale.item_count).toBe(3);
    expect(sale.cashier_id).toBe(cashier);
    expect(sale.cashier_name).toBe('Awa Caissière');
    expect(sale.payment_method).toBe('cash');
    expect(sale.payment_method_label).toBe('Espèces');
    expect(sale.payment_status).toBe('paid');
    expect(sale.sale_status).toBe('completed');

    const lines = await sql(
      `select product_name, unit_price, quantity, line_total from public.sale_items
       where sale_id = $1 order by product_name`,
      [result.sale_id],
    );
    expect(lines.map((l) => [l.product_name, n(l.unit_price), l.quantity, n(l.line_total)])).toEqual([
      ['Jus naturel', 10000, 1, 10000],
      ['Riz au poulet', 25000, 2, 50000],
    ]);
  });

  it('additionne les quantités d’un même produit présent sur plusieurs lignes', async () => {
    const p = await createProduct({ price: 5000 });
    const result = await createSale(cashier, [
      { product_id: p, quantity: 1 },
      { product_id: p, quantity: 2 },
    ]);
    const lines = await sql(`select quantity, line_total from public.sale_items where sale_id = $1`, [
      result.sale_id,
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
    expect(n(lines[0].line_total)).toBe(15000);
  });

  it('conserve le nom et le prix du produit tels qu’au moment de la vente', async () => {
    const p = await createProduct({ name: 'Ancien nom', price: 7000 });
    const result = await createSale(cashier, [{ product_id: p, quantity: 1 }]);
    await sql(`update public.products set name = 'Nouveau nom', price = 9000 where id = $1`, [p]);
    const [line] = await sql(`select product_name, unit_price from public.sale_items where sale_id = $1`, [
      result.sale_id,
    ]);
    expect(line.product_name).toBe('Ancien nom');
    expect(n(line.unit_price)).toBe(7000);
  });

  it('attribue des numéros de reçu consécutifs', async () => {
    const p = await createProduct({ price: 1000 });
    const a = await createSale(cashier, [{ product_id: p, quantity: 1 }]);
    const b = await createSale(cashier, [{ product_id: p, quantity: 1 }]);
    expect(receiptSeq(b.receipt_number)).toBe(receiptSeq(a.receipt_number) + 1);
  });

  it('refuse un panier vide, une quantité invalide ou un produit inconnu', async () => {
    const p = await createProduct({ price: 1000 });
    await expect(createSale(cashier, [])).rejects.toThrow(/panier est vide/);
    await expect(createSale(cashier, [{ product_id: p, quantity: 0 }])).rejects.toThrow(/invalide/);
    await expect(createSale(cashier, [{ product_id: p, quantity: -2 }])).rejects.toThrow(/invalide/);
    await expect(createSale(cashier, [{ product_id: randomUUID(), quantity: 1 }])).rejects.toThrow(
      /n'existe plus/,
    );
  });

  it('refuse un produit indisponible et un mode de paiement désactivé', async () => {
    const off = await createProduct({ name: 'Plat retiré', price: 1000, available: false });
    await expect(createSale(cashier, [{ product_id: off, quantity: 1 }])).rejects.toThrow(/plus disponible/);

    const p = await createProduct({ price: 1000 });
    await sql(`update public.payment_methods set is_active = false where code = 'other'`);
    await expect(createSale(cashier, [{ product_id: p, quantity: 1 }], { method: 'other' })).rejects.toThrow(
      /Mode de paiement/,
    );
    await sql(`update public.payment_methods set is_active = true where code = 'other'`);
    await expect(createSale(cashier, [{ product_id: p, quantity: 1 }], { method: 'inexistant' })).rejects.toThrow(
      /Mode de paiement/,
    );
  });

  it('enregistre les paiements Mobile Money comme moyens déclarés', async () => {
    const p = await createProduct({ price: 2000 });
    const result = await createSale(cashier, [{ product_id: p, quantity: 1 }], { method: 'orange_money' });
    const [sale] = await sql(`select payment_method_label, payment_status from public.sales where id = $1`, [
      result.sale_id,
    ]);
    expect(sale.payment_method_label).toBe('Orange Money');
    expect(sale.payment_status).toBe('paid');
  });

  it('refuse un compte inactif ou non connecté', async () => {
    const inactive = await createUser({ active: false });
    const p = await createProduct({ price: 1000 });
    await expect(createSale(inactive, [{ product_id: p, quantity: 1 }])).rejects.toThrow(/inactif/);
    await expect(
      as(null, (c) =>
        c.query(`select public.create_sale('[]'::jsonb, 'cash', gen_random_uuid(), 0)`),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('create_sale — remises', () => {
  it('refuse une remise sans la permission apply_discount', async () => {
    const p = await createProduct({ price: 10000 });
    await expect(createSale(cashier, [{ product_id: p, quantity: 1 }], { discount: 1000 })).rejects.toThrow(
      /autorisé à appliquer une remise/,
    );
  });

  it('applique une remise autorisée et refuse une remise supérieure au sous-total', async () => {
    const senior = await createUser({ permissions: ['apply_discount'] });
    const p = await createProduct({ price: 10000 });
    const result = await createSale(senior, [{ product_id: p, quantity: 2 }], { discount: 2500 });
    const [sale] = await sql(`select subtotal, discount_amount, total_amount from public.sales where id = $1`, [
      result.sale_id,
    ]);
    expect([n(sale.subtotal), n(sale.discount_amount), n(sale.total_amount)]).toEqual([20000, 2500, 17500]);

    await expect(createSale(senior, [{ product_id: p, quantity: 1 }], { discount: 10001 })).rejects.toThrow(
      /dépasser le sous-total/,
    );
    await expect(createSale(senior, [{ product_id: p, quantity: 1 }], { discount: 10.5 })).rejects.toThrow(
      /remise est invalide/,
    );
  });
});

describe('create_sale — idempotence et doubles soumissions', () => {
  it('renvoie la même vente pour une même clé', async () => {
    const p = await createProduct({ price: 3000, trackStock: true, stock: 10 });
    const key = randomUUID();
    const first = await createSale(cashier, [{ product_id: p, quantity: 2 }], { key });
    const second = await createSale(cashier, [{ product_id: p, quantity: 2 }], { key });
    expect(second.sale_id).toBe(first.sale_id);
    expect(second.receipt_number).toBe(first.receipt_number);
    expect(second.replayed).toBe(true);
    expect(await stockOf(p)).toBe(8);
    const [{ count }] = await sql(`select count(*)::int as count from public.sales where idempotency_key = $1`, [key]);
    expect(count).toBe(1);
  });

  it('ne crée qu’une vente pour 8 clics simultanés', async () => {
    const p = await createProduct({ price: 3000, trackStock: true, stock: 100 });
    const key = randomUUID();
    const results = await withProductHeld(p, () =>
      Promise.all(Array.from({ length: 8 }, () => createSale(cashier, [{ product_id: p, quantity: 1 }], { key }))),
    );
    expect(new Set(results.map((r) => r.sale_id)).size).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await stockOf(p)).toBe(99);
  });

  it('refuse de réutiliser la clé d’un autre caissier', async () => {
    const other = await createUser();
    const p = await createProduct({ price: 1000 });
    const key = randomUUID();
    await createSale(cashier, [{ product_id: p, quantity: 1 }], { key });
    await expect(createSale(other, [{ product_id: p, quantity: 1 }], { key })).rejects.toThrow(/déjà utilisé/);
  });
});

describe('create_sale — stocks', () => {
  it('décrémente le stock suivi et journalise le mouvement', async () => {
    const p = await createProduct({ price: 4000, trackStock: true, stock: 5 });
    const result = await createSale(cashier, [{ product_id: p, quantity: 3 }]);
    expect(await stockOf(p)).toBe(2);
    const moves = await sql(`select movement_type, quantity, stock_after, user_id from public.stock_movements where sale_id = $1`, [
      result.sale_id,
    ]);
    expect(moves).toEqual([{ movement_type: 'sale', quantity: -3, stock_after: 2, user_id: cashier }]);
  });

  it('refuse de vendre plus que le stock disponible, sans rien enregistrer', async () => {
    const p = await createProduct({ name: 'Poulet braisé', price: 4000, trackStock: true, stock: 2 });
    const other = await createProduct({ price: 1000, trackStock: true, stock: 10 });
    const [{ last_value: before }] = await sql(`select last_value from public.receipt_counters`);
    const [{ count: salesBefore }] = await sql(`select count(*)::int as count from public.sales`);

    await expect(
      createSale(cashier, [
        { product_id: other, quantity: 1 },
        { product_id: p, quantity: 3 },
      ]),
    ).rejects.toThrow(/Stock insuffisant pour « Poulet braisé » \(disponible : 2\)/);

    expect(await stockOf(p)).toBe(2);
    expect(await stockOf(other)).toBe(10);
    const [{ last_value: after }] = await sql(`select last_value from public.receipt_counters`);
    expect(after).toBe(before); // pas de numéro de reçu consommé
    const [{ count: salesAfter }] = await sql(`select count(*)::int as count from public.sales`);
    expect(salesAfter).toBe(salesBefore);
  });

  it('ne touche pas au stock d’un produit non suivi', async () => {
    const p = await createProduct({ price: 4000, trackStock: false, stock: 0 });
    await createSale(cashier, [{ product_id: p, quantity: 50 }]);
    expect(await stockOf(p)).toBe(0);
  });

  it('ignore les stocks quand la gestion de stock est désactivée globalement', async () => {
    const p = await createProduct({ price: 4000, trackStock: true, stock: 1 });
    await sql(`update public.restaurant_settings set stock_enabled = false`);
    try {
      await createSale(cashier, [{ product_id: p, quantity: 5 }]);
      expect(await stockOf(p)).toBe(1);
    } finally {
      await sql(`update public.restaurant_settings set stock_enabled = true`);
    }
  });

  it('ventes simultanées : jamais plus que le stock, numéros uniques et consécutifs', async () => {
    const p = await createProduct({ price: 2000, trackStock: true, stock: 5 });
    const cashiers = await Promise.all(Array.from({ length: 3 }, () => createUser()));
    const attempts = await withProductHeld(p, () =>
      Promise.allSettled(
        Array.from({ length: 12 }, (_, i) => createSale(cashiers[i % 3], [{ product_id: p, quantity: 1 }])),
      ),
    );
    const ok = attempts.filter((a): a is PromiseFulfilledResult<Awaited<ReturnType<typeof createSale>>> => a.status === 'fulfilled');
    const failed = attempts.filter((a) => a.status === 'rejected') as PromiseRejectedResult[];

    expect(ok).toHaveLength(5);
    expect(failed).toHaveLength(7);
    for (const f of failed) expect(String(f.reason)).toMatch(/Stock insuffisant/);
    expect(await stockOf(p)).toBe(0);

    const seqs = ok.map((r) => receiptSeq(r.value.receipt_number)).sort((a, b) => a - b);
    expect(new Set(seqs).size).toBe(5);
    expect(seqs.at(-1)! - seqs[0]).toBe(4);
  });
});

describe('sales — intégrité de l’historique', () => {
  it('interdit toute écriture directe dans les ventes à un utilisateur', async () => {
    const p = await createProduct({ price: 1000 });
    const result = await createSale(cashier, [{ product_id: p, quantity: 1 }]);
    await expect(
      as(cashier, (c) => c.query(`update public.sales set total_amount = 0 where id = $1`, [result.sale_id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(cashier, (c) =>
        c.query(
          `insert into public.sales (receipt_number, cashier_id, cashier_name, subtotal, total_amount, payment_method, payment_method_label, item_count, idempotency_key)
           values ('X', $1, 'x', 1, 1, 'cash', 'Espèces', 1, gen_random_uuid())`,
          [cashier],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(admin, (c) => c.query(`delete from public.sale_items where sale_id = $1`, [result.sale_id])),
    ).rejects.toThrow(/permission denied/);
  });

  it('fige le contenu financier même pour le super-utilisateur', async () => {
    const p = await createProduct({ price: 1000 });
    const result = await createSale(cashier, [{ product_id: p, quantity: 1 }]);
    await expect(sql(`update public.sales set total_amount = 0, subtotal = 0 where id = $1`, [result.sale_id])).rejects.toThrow(
      /ne peut pas être modifié/,
    );
    await expect(sql(`delete from public.sales where id = $1`, [result.sale_id])).rejects.toThrow(
      /ne peut pas être supprimée/,
    );
    await expect(sql(`update public.sale_items set quantity = 9 where sale_id = $1`, [result.sale_id])).rejects.toThrow(
      /ni modifiées ni supprimées/,
    );
  });

  it('journalise chaque vente', async () => {
    const p = await createProduct({ price: 1000 });
    const result = await createSale(cashier, [{ product_id: p, quantity: 1 }]);
    const logs = await sql(`select user_id, user_name, action from public.audit_logs where entity_id = $1`, [
      result.sale_id,
    ]);
    expect(logs).toEqual([{ user_id: cashier, user_name: 'Awa Caissière', action: 'sale.created' }]);
  });
});
