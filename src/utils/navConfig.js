import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Receipt,
  Wallet,
  FileSpreadsheet,
  Settings as SettingsIcon
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tableau de Bord', shortLabel: 'Accueil', icon: LayoutDashboard, adminOnly: true },
  { id: 'pos', label: 'Caisse / Ventes', shortLabel: 'Caisse', icon: ShoppingCart, badge: 'POS' },
  { id: 'inventory', label: 'Gestion des Stocks', shortLabel: 'Stocks', icon: Boxes },
  { id: 'debts', label: 'Dettes & Clients', shortLabel: 'Dettes', icon: Receipt },
  { id: 'expenses', label: 'Dépenses & Caisse', shortLabel: 'Dépenses', icon: Wallet },
  { id: 'reports', label: 'Rapports PDF', shortLabel: 'Rapports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Paramètres', shortLabel: 'Réglages', icon: SettingsIcon, adminOnly: true }
];

export const getNavItems = (role) => NAV_ITEMS.filter((item) => role === 'admin' || !item.adminOnly);
