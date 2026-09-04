import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Receipt,
  Wallet,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Store,
  ArrowRightLeft
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Sidebar = ({ activePage, setActivePage }) => {
  const { activeBoutiqueId, activeBoutique, activeRole } = useApp();

  // Le Tableau de Bord et les Paramètres sont réservés à l'administrateur
  const ADMIN_ONLY = ['dashboard', 'settings'];

  const navItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'pos', label: 'Caisse / Ventes', icon: ShoppingCart, badge: 'POS' },
    { id: 'inventory', label: 'Gestion des Stocks', icon: Boxes },
    { id: 'debts', label: 'Dettes & Clients', icon: Receipt },
    { id: 'expenses', label: 'Dépenses & Caisse', icon: Wallet },
    { id: 'reports', label: 'Rapports PDF', icon: FileSpreadsheet },
    { id: 'settings', label: 'Paramètres', icon: SettingsIcon }
  ].filter((item) => activeRole === 'admin' || !ADMIN_ONLY.includes(item.id));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar-container">
        <div className="sidebar-store-info">
          <div className="store-avatar">
            <Store className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="store-meta">
            <span className="store-name">
              {activeBoutiqueId === 'all' ? 'Toutes Boutiques (3)' : activeBoutique?.name}
            </span>
            <span className="store-role-tag">
              {activeRole === 'admin' ? '🔑 Administrateur' : `👤 ${activeBoutique?.manager}`}
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <Icon className="w-5 h-5 nav-icon" />
                <span className="nav-label">{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="pwa-status-card">
            <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
            <div className="pwa-text">
              <span className="pwa-title">Mode PWA Inclus</span>
              <span className="pwa-desc">Synchro temps réel & Hors-ligne</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (iOS / Android / iPadOS ergonomics) */}
      <nav className="mobile-bottom-bar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`mobile-tab ${isActive ? 'mobile-tab-active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              <span className="mobile-tab-label">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
