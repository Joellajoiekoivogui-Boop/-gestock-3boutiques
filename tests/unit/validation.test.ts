import { describe, expect, it } from 'vitest';
import { toUserMessage } from '@/lib/errors';
import { navFor } from '@/components/app/nav';
import { can, isAdmin } from '@/lib/permissions';
import {
  createUserSchema,
  productSchema,
  saleSchema,
  settingsSchema,
  stockMovementSchema,
  validateImage,
} from '@/lib/validation';

const uuid = '0b6f7a52-6a3c-4c1e-9d3e-3f2a1b0c9d8e';

describe('validation', () => {
  it('vente : panier non vide, quantités entières, remise entière', () => {
    const base = { items: [{ productId: uuid, quantity: 2 }], paymentMethod: 'cash', discount: 0, idempotencyKey: uuid };
    expect(saleSchema.safeParse(base).success).toBe(true);
    expect(saleSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, items: [{ productId: uuid, quantity: 1.5 }] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, discount: 10.5 }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, paymentMethod: 'DROP TABLE' }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, idempotencyKey: 'x' }).success).toBe(false);
  });

  it('produit : prix entier positif, champs vides normalisés', () => {
    const parsed = productSchema.parse({
      name: '  Attiéké  ',
      description: '',
      categoryId: '',
      price: 30000,
      isAvailable: true,
      trackStock: false,
      minimumStock: 0,
    });
    expect(parsed).toMatchObject({ name: 'Attiéké', description: null, categoryId: null });
    expect(productSchema.safeParse({ ...parsed, price: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...parsed, price: 99.99 }).success).toBe(false);
    // La sortie du schéma reste une entrée valide (revalidation serveur).
    expect(productSchema.safeParse(parsed).success).toBe(true);
  });

  it('mouvement de stock : approvisionnement positif, motif obligatoire pour un ajustement', () => {
    expect(stockMovementSchema.safeParse({ productId: uuid, type: 'restock', quantity: 5 }).success).toBe(true);
    expect(stockMovementSchema.safeParse({ productId: uuid, type: 'restock', quantity: -5 }).success).toBe(false);
    expect(stockMovementSchema.safeParse({ productId: uuid, type: 'adjustment', quantity: -2 }).success).toBe(false);
    expect(stockMovementSchema.safeParse({ productId: uuid, type: 'adjustment', quantity: -2, reason: 'Casse' }).success).toBe(true);
    expect(stockMovementSchema.safeParse({ productId: uuid, type: 'adjustment', quantity: 0, reason: 'x' }).success).toBe(false);
  });

  it('utilisateur : mot de passe robuste et permissions connues', () => {
    const base = { fullName: 'Awa Camara', email: 'awa@example.com', password: 'motdepasse12', role: 'cashier', permissions: [] };
    expect(createUserSchema.safeParse(base).success).toBe(true);
    expect(createUserSchema.safeParse({ ...base, password: 'court1' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, password: 'sanschiffreici' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, permissions: ['super_admin'] }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, role: 'owner' }).success).toBe(false);
  });

  it('paramètres : devise, préfixe et fuseau', () => {
    const base = {
      name: 'MassaGui Fils SARL.U',
      currency: 'gnf',
      receiptFormat: '80mm',
      receiptPrefix: 'mg',
      stockEnabled: true,
      posShowImages: true,
      timezone: 'Africa/Conakry',
      email: '',
    };
    expect(settingsSchema.parse(base)).toMatchObject({ currency: 'GNF', receiptPrefix: 'MG', email: null });
    expect(settingsSchema.safeParse({ ...base, timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, receiptPrefix: 'MG-2026' }).success).toBe(false);
  });

  it('images : type et taille', () => {
    expect(validateImage(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull();
    expect(validateImage(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toMatch(/Format/);
    expect(validateImage(new File([new Uint8Array(3 * 1024 * 1024)], 'a.jpg', { type: 'image/jpeg' }))).toMatch(/2 Mo/);
    expect(validateImage(null)).toBeNull();
  });
});

describe('messages d’erreur', () => {
  it('affiche les messages métier et masque les messages techniques', () => {
    expect(toUserMessage({ code: 'P0001', message: 'Stock insuffisant pour « Riz » (disponible : 2).' })).toBe(
      'Stock insuffisant pour « Riz » (disponible : 2).',
    );
    expect(toUserMessage({ code: '42501', message: 'permission denied for table sales' })).toBe('Action non autorisée.');
    expect(toUserMessage({ code: '23503', message: 'violates foreign key constraint' })).toMatch(/Désactivez-le/);
    expect(toUserMessage({ code: 'XX000', message: 'internal' })).toMatch(/inattendue/);
    expect(toUserMessage({ message: 'TypeError: fetch failed' })).toMatch(/Connexion à la base de données impossible/);
  });
});

describe('droits et navigation', () => {
  const cashier = { role: 'cashier' as const, permissions: [] as string[], is_active: true };
  const admin = { role: 'admin' as const, permissions: [] as string[], is_active: true };

  it('un admin a tout, un caissier seulement ses permissions, un compte inactif rien', () => {
    expect(can(admin, 'cancel_sales')).toBe(true);
    expect(can(cashier, 'cancel_sales')).toBe(false);
    expect(can({ ...cashier, permissions: ['cancel_sales'] }, 'cancel_sales')).toBe(true);
    expect(can({ ...admin, is_active: false }, 'cancel_sales')).toBe(false);
    expect(isAdmin({ ...admin, is_active: false })).toBe(false);
  });

  it('la navigation suit le rôle', () => {
    const hrefs = (p: Parameters<typeof navFor>[0]) => navFor(p).flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs(cashier)).toEqual(['/pos', '/pos/sales']);
    expect(hrefs({ ...cashier, permissions: ['manage_stock', 'view_reports'] })).toEqual([
      '/pos',
      '/pos/sales',
      '/admin/inventory',
      '/admin/reports',
    ]);
    expect(hrefs(admin)).toContain('/admin/dashboard');
    expect(hrefs(admin)).toContain('/admin/users');
    expect(hrefs(admin)).toContain('/admin/sales');
  });
});
