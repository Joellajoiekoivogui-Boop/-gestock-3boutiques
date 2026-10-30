import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createProduct, createSale, createUser, n, pool, sql, stockOf } from './helpers';

let admin: string;
let cashierA: string;
let cashierB: string;

beforeAll(async () => {
  admin = await createUser({ role: 'admin', name: 'Admin' });
  cashierA = await createUser({ name: 'Caissier A' });
  cashierB = await createUser({ name: 'Caissier B' });
});

afterAll(async () => {
  await pool.end();
});

describe('comptes et rôles', () => {
  it('crée un profil caissier INACTIF pour tout nouveau compte', async () => {
    await sql(`insert into auth.users (email, raw_user_meta_data) values ('nouveau@test.local', '{"full_name":"Nouveau"}')`);
    const [profile] = await sql(`select role, is_active, full_name from public.profiles where email = 'nouveau@test.local'`);
    expect(profile).toEqual({ role: 'cashier', is_active: false, full_name: 'Nouveau' });
  });

  it('un compte inactif ne voit rien', async () => {
    const inactive = await createUser({ active: false });
    await createProduct({ price: 1000 });
    const rows = await as(inactive, (c) => c.query(`select * from public.products`));
    expect(rows.rowCount).toBe(0);
  });

  it('un caissier ne peut pas changer son rôle ni ses permissions', async () => {
    await as(cashierA, (c) =>
      c.query(`update public.profiles set role = 'admin', permissions = '{view_all_sales}' where id = $1`, [cashierA]),
    );
    const [profile] = await sql(`select role, permissions from public.profiles where id = $1`, [cashierA]);
    expect(profile).toEqual({ role: 'cashier', permissions: [] });
  });

  it('un caissier ne lit que son propre profil', async () => {
    const { rows } = await as(cashierA, (c) => c.query(`select id from public.profiles`));
    expect(rows.map((r) => r.id)).toEqual([cashierA]);
  });

  it('un admin peut modifier les rôles et permissions', async () => {
    const target = await createUser();
    await as(admin, (c) =>
      c.query(`update public.profiles set permissions = '{view_reports}' where id = $1`, [target]),
    );
    const [profile] = await sql(`select permissions from public.profiles where id = $1`, [target]);
    expect(profile.permissions).toEqual(['view_reports']);
  });

  it('refuse une permission inconnue', async () => {
    const target = await createUser();
    await expect(
      as(admin, (c) => c.query(`update public.profiles set permissions = '{super_pouvoir}' where id = $1`, [target])),
    ).rejects.toThrow(/profiles_permissions_valid/);
  });

  it('empêche de retirer le dernier administrateur actif', async () => {
    const admins = await sql(`select id from public.profiles where role = 'admin' and is_active`);
    // On désactive tous les autres admins pour ne garder que `admin`.
    for (const { id } of admins) {
      if (id !== admin) await sql(`update public.profiles set is_active = false where id = $1`, [id]);
    }
    await expect(
      as(admin, (c) => c.query(`update public.profiles set role = 'cashier' where id = $1`, [admin])),
    ).rejects.toThrow(/au moins un administrateur actif/);
    for (const { id } of admins) {
      await sql(`update public.profiles set is_active = true where id = $1`, [id]);
    }
  });
});

describe('catalogue', () => {
  it('seul un admin crée ou modifie un produit', async () => {
    await expect(
      as(cashierA, (c) => c.query(`insert into public.products (name, price) values ('Pirate', 1)`)),
    ).rejects.toThrow(/row-level security/);

    const { rows } = await as(admin, (c) =>
      c.query(`insert into public.products (name, price, track_stock) values ('Attiéké poisson', 30000, true) returning id`),
    );
    const id = rows[0].id;
    const updated = await as(cashierA, (c) => c.query(`update public.products set price = 1 where id = $1`, [id]));
    expect(updated.rowCount).toBe(0);
  });

  it('personne ne modifie le stock directement (seulement via les mouvements)', async () => {
    const p = await createProduct({ price: 1000, trackStock: true, stock: 3 });
    await expect(
      as(admin, (c) => c.query(`update public.products set stock_quantity = 999 where id = $1`, [p])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(admin, (c) =>
        c.query(`insert into public.products (name, price, stock_quantity) values ('X', 1, 50)`),
      ),
    ).rejects.toThrow(/permission denied/);
    expect(await stockOf(p)).toBe(3);
  });

  it('interdit de supprimer un produit déjà vendu', async () => {
    const p = await createProduct({ price: 1000 });
    await createSale(cashierA, [{ product_id: p, quantity: 1 }]);
    await expect(as(admin, (c) => c.query(`delete from public.products where id = $1`, [p]))).rejects.toThrow(
      /foreign key/,
    );
  });

  it('journalise les modifications de produits', async () => {
    const { rows } = await as(admin, (c) =>
      c.query(`insert into public.products (name, price) values ('Café', 5000) returning id`),
    );
    await as(admin, (c) => c.query(`update public.products set price = 6000 where id = $1`, [rows[0].id]));
    const logs = await sql(
      `select action, user_id, details from public.audit_logs where entity_id = $1 order by id`,
      [rows[0].id],
    );
    expect(logs.map((l) => l.action)).toEqual(['products.insert', 'products.update']);
    expect(logs[1].user_id).toBe(admin);
    expect(logs[1].details.changes.price).toEqual({ old: 5000, new: 6000 });
  });
});

describe('visibilité des ventes', () => {
  it('un caissier ne voit que ses ventes (et leurs lignes)', async () => {
    const p = await createProduct({ price: 1000 });
    const a = await createSale(cashierA, [{ product_id: p, quantity: 1 }]);
    const b = await createSale(cashierB, [{ product_id: p, quantity: 1 }]);

    const seenByA = await as(cashierA, (c) => c.query(`select id from public.sales`));
    const ids = seenByA.rows.map((r) => r.id);
    expect(ids).toContain(a.sale_id);
    expect(ids).not.toContain(b.sale_id);

    const items = await as(cashierA, (c) => c.query(`select * from public.sale_items where sale_id = $1`, [b.sale_id]));
    expect(items.rowCount).toBe(0);
  });

  it('la permission view_all_sales ouvre toutes les ventes', async () => {
    const supervisor = await createUser({ permissions: ['view_all_sales'] });
    const p = await createProduct({ price: 1000 });
    const b = await createSale(cashierB, [{ product_id: p, quantity: 1 }]);
    const { rows } = await as(supervisor, (c) => c.query(`select id from public.sales where id = $1`, [b.sale_id]));
    expect(rows).toHaveLength(1);
  });

  it('un caissier ne lit ni le journal d’activité ni les mouvements de stock', async () => {
    const logs = await as(cashierA, (c) => c.query(`select * from public.audit_logs`));
    expect(logs.rowCount).toBe(0);
    const moves = await as(cashierA, (c) => c.query(`select * from public.stock_movements`));
    expect(moves.rowCount).toBe(0);
  });

  it('seul un admin peut journaliser un événement d’administration, à son nom', async () => {
    await expect(
      as(cashierA, (c) => c.query(`select public.log_admin_event('user.created', 'profiles', 'x', '{}')`)),
    ).rejects.toThrow(/réservé aux administrateurs/);
    await as(admin, (c) => c.query(`select public.log_admin_event('user.password_reset', 'profiles', $1, '{}')`, [cashierA]));
    const [log] = await sql(`select user_id, action from public.audit_logs where action = 'user.password_reset' order by id desc limit 1`);
    expect(log).toEqual({ user_id: admin, action: 'user.password_reset' });
    await expect(
      as(admin, (c) => c.query(`select public.log_admin_event('pas valide', 'profiles', 'x', '{}')`)),
    ).rejects.toThrow(/Événement invalide/);
  });

  it('le journal d’activité est en ajout seul', async () => {
    await expect(sql(`delete from public.audit_logs`)).rejects.toThrow(/ni modifiées ni supprimées/);
  });
});

describe('accès anonyme', () => {
  it('ne lit que les informations de marque', async () => {
    const { rows } = await as(null, (c) => c.query(`select public.get_branding() as b`));
    expect(rows[0].b.name).toBe('MassaGui Fils SARL.U');
    await expect(as(null, (c) => c.query(`select * from public.products`))).rejects.toThrow(/permission denied/);
    await expect(as(null, (c) => c.query(`select * from public.sales`))).rejects.toThrow(/permission denied/);
  });
});

describe('mouvements de stock', () => {
  it('approvisionnement et ajustement tracés', async () => {
    const p = await createProduct({ price: 1000, trackStock: true, stock: 0 });
    await as(admin, (c) => c.query(`select public.record_stock_movement($1, 'restock', 20, 'Livraison')`, [p]));
    await as(admin, (c) => c.query(`select public.record_stock_movement($1, 'adjustment', -3, 'Casse')`, [p]));
    expect(await stockOf(p)).toBe(17);
    const moves = await sql(
      `select movement_type, quantity, stock_after, reason, user_id from public.stock_movements where product_id = $1 order by created_at, stock_after desc`,
      [p],
    );
    expect(moves).toEqual([
      { movement_type: 'restock', quantity: 20, stock_after: 20, reason: 'Livraison', user_id: admin },
      { movement_type: 'adjustment', quantity: -3, stock_after: 17, reason: 'Casse', user_id: admin },
    ]);
  });

  it('refuse un stock négatif, un ajustement sans motif et un caissier sans permission', async () => {
    const p = await createProduct({ price: 1000, trackStock: true, stock: 2 });
    await expect(
      as(admin, (c) => c.query(`select public.record_stock_movement($1, 'adjustment', -5, 'Erreur')`, [p])),
    ).rejects.toThrow(/négatif/);
    await expect(
      as(admin, (c) => c.query(`select public.record_stock_movement($1, 'adjustment', -1, '')`, [p])),
    ).rejects.toThrow(/motif/);
    await expect(
      as(cashierA, (c) => c.query(`select public.record_stock_movement($1, 'restock', 5, null)`, [p])),
    ).rejects.toThrow(/pas autorisé/);
    const stockKeeper = await createUser({ permissions: ['manage_stock'] });
    await as(stockKeeper, (c) => c.query(`select public.record_stock_movement($1, 'restock', 5, null)`, [p]));
    expect(await stockOf(p)).toBe(7);
  });

  it('refuse un mouvement sur un produit non suivi', async () => {
    const p = await createProduct({ price: 1000, trackStock: false });
    await expect(
      as(admin, (c) => c.query(`select public.record_stock_movement($1, 'restock', 5, null)`, [p])),
    ).rejects.toThrow(/suivi de stock n'est pas activé/);
  });
});

describe('annulations et remboursements', () => {
  it('annulation : permission, motif, stock réintégré, journal', async () => {
    const p = await createProduct({ price: 5000, trackStock: true, stock: 10 });
    const sale = await createSale(cashierA, [{ product_id: p, quantity: 4 }]);
    expect(await stockOf(p)).toBe(6);

    await expect(
      as(cashierA, (c) => c.query(`select public.cancel_sale($1, 'Erreur de saisie')`, [sale.sale_id])),
    ).rejects.toThrow(/pas autorisé à annuler/);
    await expect(as(admin, (c) => c.query(`select public.cancel_sale($1, '')`, [sale.sale_id]))).rejects.toThrow(
      /motif/,
    );

    await as(admin, (c) => c.query(`select public.cancel_sale($1, 'Erreur de saisie')`, [sale.sale_id]));
    expect(await stockOf(p)).toBe(10);
    const [row] = await sql(`select sale_status, cancel_reason, cancelled_by from public.sales where id = $1`, [
      sale.sale_id,
    ]);
    expect(row).toEqual({ sale_status: 'cancelled', cancel_reason: 'Erreur de saisie', cancelled_by: admin });

    await expect(
      as(admin, (c) => c.query(`select public.cancel_sale($1, 'Encore')`, [sale.sale_id])),
    ).rejects.toThrow(/déjà annulée/);

    const logs = await sql(`select action from public.audit_logs where entity_id = $1 order by id`, [sale.sale_id]);
    expect(logs.map((l) => l.action)).toEqual(['sale.created', 'sale.cancelled']);
  });

  it('remboursement partiel puis total', async () => {
    const p = await createProduct({ price: 10000 });
    const sale = await createSale(cashierA, [{ product_id: p, quantity: 3 }]);

    await as(admin, (c) => c.query(`select public.refund_sale($1, 10000, 'Plat froid')`, [sale.sale_id]));
    let [row] = await sql(`select sale_status, refunded_amount from public.sales where id = $1`, [sale.sale_id]);
    expect(row.sale_status).toBe('partially_refunded');
    expect(n(row.refunded_amount)).toBe(10000);

    await expect(
      as(admin, (c) => c.query(`select public.refund_sale($1, 20001, 'Trop')`, [sale.sale_id])),
    ).rejects.toThrow(/dépasse le montant restant/);
    await expect(
      as(admin, (c) => c.query(`select public.cancel_sale($1, 'Annulation')`, [sale.sale_id])),
    ).rejects.toThrow(/ne peut plus être annulée/);

    await as(admin, (c) => c.query(`select public.refund_sale($1, 20000, 'Client mécontent')`, [sale.sale_id]));
    [row] = await sql(`select sale_status, refunded_amount from public.sales where id = $1`, [sale.sale_id]);
    expect(row.sale_status).toBe('refunded');
    expect(n(row.refunded_amount)).toBe(30000);

    await expect(
      as(admin, (c) => c.query(`select public.refund_sale($1, 1, 'Encore')`, [sale.sale_id])),
    ).rejects.toThrow(/ne peut plus être remboursée/);
  });

  it('un caissier avec refund_sales peut rembourser', async () => {
    const refunder = await createUser({ permissions: ['refund_sales'] });
    const p = await createProduct({ price: 1000 });
    const sale = await createSale(cashierA, [{ product_id: p, quantity: 1 }]);
    await expect(
      as(cashierA, (c) => c.query(`select public.refund_sale($1, 1000, 'Erreur')`, [sale.sale_id])),
    ).rejects.toThrow(/pas autorisé à rembourser/);
    await as(refunder, (c) => c.query(`select public.refund_sale($1, 1000, 'Erreur')`, [sale.sale_id]));
  });
});
