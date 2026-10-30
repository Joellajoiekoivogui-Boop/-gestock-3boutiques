import type { AppRole, ProfileRow } from '@/lib/database.types';

// Doit rester identique à la contrainte profiles_permissions_valid (SQL).
export const PERMISSIONS = [
  { key: 'apply_discount', label: 'Appliquer une remise', description: 'Saisir une remise à la caisse.' },
  { key: 'view_all_sales', label: 'Voir toutes les ventes', description: 'Consulter l’historique de tous les caissiers.' },
  { key: 'cancel_sales', label: 'Annuler une vente', description: 'Annuler une vente (motif obligatoire).' },
  { key: 'refund_sales', label: 'Rembourser une vente', description: 'Enregistrer un remboursement total ou partiel.' },
  { key: 'manage_stock', label: 'Gérer les stocks', description: 'Approvisionnements et ajustements de stock.' },
  { key: 'view_reports', label: 'Voir les rapports', description: 'Consulter et exporter les rapports.' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as [Permission, ...Permission[]];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrateur',
  cashier: 'Gérant / Caissier',
};

type ProfileLike = Pick<ProfileRow, 'role' | 'permissions' | 'is_active'>;

export function can(profile: ProfileLike | null | undefined, permission: Permission): boolean {
  if (!profile || !profile.is_active) return false;
  return profile.role === 'admin' || profile.permissions.includes(permission);
}

export function isAdmin(profile: ProfileLike | null | undefined): boolean {
  return !!profile && profile.is_active && profile.role === 'admin';
}
