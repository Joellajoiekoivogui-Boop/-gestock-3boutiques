import { z } from 'zod';
import { PERMISSION_KEYS } from '@/lib/permissions';

// Messages d'erreur par défaut en français.
z.config(z.locales.fr());

const MAX_AMOUNT = 1_000_000_000_000; // 1 000 milliards GNF

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} est obligatoire.` : `${label} : ${min} caractères minimum.`)
    .max(max, `${label} : ${max} caractères maximum.`);

// Texte facultatif : "" / null / undefined → null. La sortie reste une entrée
// valide (le serveur peut revalider ce que le formulaire a produit).
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .nullish()
    .transform((v) => (v ? v : null));

const amount = (label: string) =>
  z
    .number(`${label} : saisissez un nombre.`)
    .int(`${label} : nombre entier attendu (pas de centimes en GNF).`)
    .min(0, `${label} ne peut pas être négatif.`)
    .max(MAX_AMOUNT, `${label} est trop élevé.`);

export const idSchema = z.uuid('Identifiant invalide.');

// --- Connexion ---------------------------------------------------------------
export const loginSchema = z.object({
  email: z.email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Le mot de passe est obligatoire.').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;

// --- Vente -------------------------------------------------------------------
export const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: idSchema,
        quantity: z.number().int().min(1, 'Quantité invalide.').max(10_000, 'Quantité trop élevée.'),
      }),
    )
    .min(1, 'Le panier est vide.')
    .max(200, 'Le panier contient trop de lignes.'),
  paymentMethod: z.string().regex(/^[a-z0-9_]{2,32}$/, 'Mode de paiement invalide.'),
  discount: amount('La remise'),
  idempotencyKey: z.uuid(),
  note: optionalText(500),
});
export type SaleInput = z.input<typeof saleSchema>;

// --- Produits ----------------------------------------------------------------
export const productSchema = z.object({
  name: trimmed(1, 120, 'Le nom'),
  description: optionalText(1000),
  categoryId: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(idSchema.nullable()),
  price: amount('Le prix'),
  isAvailable: z.boolean(),
  trackStock: z.boolean(),
  minimumStock: z.number('Saisissez un nombre.').int().min(0).max(1_000_000),
  initialStock: z.number('Saisissez un nombre.').int().min(0).max(1_000_000).optional(),
});
export type ProductFormValues = z.input<typeof productSchema>;
export type ProductFormOutput = z.output<typeof productSchema>;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function validateImage(file: File | null): string | null {
  if (!file || file.size === 0) return null;
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Format d’image accepté : JPG, PNG ou WebP.';
  if (file.size > MAX_IMAGE_BYTES) return 'L’image ne doit pas dépasser 2 Mo.';
  return null;
}

// --- Catégories --------------------------------------------------------------
export const categorySchema = z.object({
  name: trimmed(1, 80, 'Le nom'),
  description: optionalText(500),
  sortOrder: z.number('Saisissez un nombre.').int().min(0).max(100_000),
  isActive: z.boolean(),
});
export type CategoryFormValues = z.input<typeof categorySchema>;
export type CategoryFormOutput = z.output<typeof categorySchema>;

// --- Stocks ------------------------------------------------------------------
export const stockMovementSchema = z
  .object({
    productId: idSchema,
    type: z.enum(['restock', 'adjustment']),
    quantity: z
      .number('Saisissez un nombre.')
      .int('Nombre entier attendu.')
      .refine((v) => v !== 0, 'La quantité ne peut pas être nulle.')
      .refine((v) => Math.abs(v) <= 1_000_000, 'Quantité trop élevée.'),
    reason: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'restock' && value.quantity < 0) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Un approvisionnement doit être positif.' });
    }
    if (value.type === 'adjustment' && (!value.reason || value.reason.length < 3)) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Le motif est obligatoire pour un ajustement.' });
    }
  });
export type StockMovementValues = z.input<typeof stockMovementSchema>;
export type StockMovementOutput = z.output<typeof stockMovementSchema>;

// --- Annulation / remboursement ---------------------------------------------
export const cancelSaleSchema = z.object({
  saleId: idSchema,
  reason: trimmed(3, 500, 'Le motif'),
});
export type CancelSaleValues = z.input<typeof cancelSaleSchema>;
export type CancelSaleOutput = z.output<typeof cancelSaleSchema>;

export const refundSaleSchema = z.object({
  saleId: idSchema,
  amount: amount('Le montant').refine((v) => v > 0, 'Le montant doit être supérieur à 0.'),
  reason: trimmed(3, 500, 'Le motif'),
});
export type RefundSaleValues = z.input<typeof refundSaleSchema>;
export type RefundSaleOutput = z.output<typeof refundSaleSchema>;

// --- Utilisateurs ------------------------------------------------------------
export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(72, '72 caractères maximum.')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre.')
  .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre.');

const roleSchema = z.enum(['admin', 'cashier']);
const permissionsSchema = z.array(z.enum(PERMISSION_KEYS)).max(PERMISSION_KEYS.length);

export const createUserSchema = z.object({
  fullName: trimmed(2, 120, 'Le nom'),
  email: z.email('Adresse e-mail invalide.').max(200),
  password: passwordSchema,
  role: roleSchema,
  permissions: permissionsSchema,
});
export type CreateUserValues = z.input<typeof createUserSchema>;
export type CreateUserOutput = z.output<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: idSchema,
  fullName: trimmed(2, 120, 'Le nom'),
  role: roleSchema,
  permissions: permissionsSchema,
  isActive: z.boolean(),
});
export type UpdateUserValues = z.input<typeof updateUserSchema>;
export type UpdateUserOutput = z.output<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ id: idSchema, password: passwordSchema });
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>;
export type ResetPasswordOutput = z.output<typeof resetPasswordSchema>;

// --- Paramètres --------------------------------------------------------------
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const settingsSchema = z.object({
  name: trimmed(1, 120, 'Le nom'),
  tagline: optionalText(120),
  address: optionalText(300),
  phone: optionalText(60),
  email: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.email('Adresse e-mail invalide.').nullable()),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Code devise sur 3 lettres (ex. GNF).'),
  receiptFooter: optionalText(300),
  receiptFormat: z.enum(['80mm', '58mm', 'a4']),
  receiptPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,6}$/, '1 à 6 lettres ou chiffres (ex. MG).'),
  stockEnabled: z.boolean(),
  posShowImages: z.boolean(),
  timezone: z.string().trim().refine(isValidTimeZone, 'Fuseau horaire inconnu.'),
});
export type SettingsFormValues = z.input<typeof settingsSchema>;
export type SettingsFormOutput = z.output<typeof settingsSchema>;

export const paymentMethodSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{2,32}$/, 'Code : 2 à 32 caractères (minuscules, chiffres, _).'),
  label: trimmed(1, 60, 'Le libellé'),
  isActive: z.boolean(),
  sortOrder: z.number('Saisissez un nombre.').int().min(0).max(100_000),
});
export type PaymentMethodValues = z.input<typeof paymentMethodSchema>;
export type PaymentMethodOutput = z.output<typeof paymentMethodSchema>;

export function fieldErrorsOf(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}
