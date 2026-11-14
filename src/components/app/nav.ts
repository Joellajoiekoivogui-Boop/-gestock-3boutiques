import {
  BarChart3,
  Boxes,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import type { ProfileRow } from '@/lib/database.types';
import { can, isAdmin } from '@/lib/permissions';

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavSection = { title: string; items: NavItem[] };

type ProfileLike = Pick<ProfileRow, 'role' | 'permissions' | 'is_active'>;

// La navigation n'est qu'un confort : chaque page et chaque action revérifie
// les droits côté serveur, et la base applique RLS.
export function navFor(profile: ProfileLike): NavSection[] {
  const admin = isAdmin(profile);
  const sections: NavSection[] = [];

  const vente: NavItem[] = [{ href: '/pos', label: 'Caisse', icon: ShoppingCart }];
  if (can(profile, 'view_all_sales')) {
    vente.push({ href: '/admin/sales', label: 'Historique des ventes', icon: Receipt });
  } else {
    vente.push({ href: '/pos/sales', label: 'Mes ventes', icon: Receipt });
  }

  if (admin) {
    sections.push({ title: 'Pilotage', items: [{ href: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard }] });
  }
  sections.push({ title: 'Vente', items: vente });

  const catalogue: NavItem[] = [];
  if (admin) {
    catalogue.push({ href: '/admin/products', label: 'Produits', icon: UtensilsCrossed });
    catalogue.push({ href: '/admin/categories', label: 'Catégories', icon: FolderTree });
  }
  if (can(profile, 'manage_stock')) catalogue.push({ href: '/admin/inventory', label: 'Stocks', icon: Boxes });
  if (catalogue.length) sections.push({ title: 'Catalogue', items: catalogue });

  const gestion: NavItem[] = [];
  if (can(profile, 'view_reports')) gestion.push({ href: '/admin/reports', label: 'Rapports', icon: BarChart3 });
  if (admin) {
    gestion.push({ href: '/admin/users', label: 'Utilisateurs', icon: Users });
    gestion.push({ href: '/admin/audit', label: 'Journal d’activité', icon: ScrollText });
    gestion.push({ href: '/admin/settings', label: 'Paramètres', icon: Settings });
  }
  if (gestion.length) sections.push({ title: 'Gestion', items: gestion });

  return sections;
}

// Barre du haut : les onglets du travail quotidien, le reste sous « Gestion ».
const PRIMARY_HREFS = ['/pos', '/pos/sales', '/admin/sales', '/admin/dashboard'];
const SHORT_LABELS: Record<string, string> = {
  '/pos/sales': 'Mes ventes',
  '/admin/sales': 'Ventes',
};

export function navLayout(profile: ProfileLike): { primary: NavItem[]; manage: NavItem[] } {
  const items = navFor(profile).flatMap((section) => section.items);
  const primary = PRIMARY_HREFS.flatMap((href) => {
    const item = items.find((i) => i.href === href);
    return item ? [{ ...item, label: SHORT_LABELS[href] ?? item.label }] : [];
  });
  const manage = items.filter((i) => !PRIMARY_HREFS.includes(i.href));
  return { primary, manage };
}
