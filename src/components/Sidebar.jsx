import React, { useEffect } from 'react';
import { Store, ArrowRightLeft, UserCog, LogOut, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PwaInstall } from './PwaInstall';
import { getNavItems } from '../utils/navConfig';

export const Sidebar = ({ activePage, setActivePage, menuOpen, onClose }) => {
  const { activeBoutiqueId, activeBoutique, activeRole, currentUser, logout } = useApp();

  const navItems = getNavItems(activeRole);

  // Ferme le tiroir avec Échap + bloque le défilement du corps quand ouvert
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen, onClose]);

  const StoreInfo = () => (
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
  );

  const NavList = ({ onNavigate }) => (
    <nav className="sidebar-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setActivePage(item.id);
              onNavigate?.();
            }}
            className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
          >
            <Icon className="w-5 h-5 nav-icon" />
            <span className="nav-label">{item.label}</span>
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </button>
        );
      })}
    </nav>
  );

  const AccountActions = ({ onNavigate }) => (
    <div className="sidebar-account">
      <div className="sidebar-account-user">
        <span className="account-name">{currentUser?.name || 'Utilisateur'}</span>
        <span className="account-role">{activeRole === 'admin' ? 'Administrateur' : 'Gérant'}</span>
      </div>
      <button
        type="button"
        className="sidebar-account-btn"
        onClick={() => {
          onNavigate?.();
          logout();
        }}
      >
        <UserCog className="w-4 h-4" />
        <span>Changer d'utilisateur</span>
      </button>
      <button
        type="button"
        className="sidebar-account-btn sidebar-account-btn-danger"
        onClick={() => {
          onNavigate?.();
          logout();
        }}
      >
        <LogOut className="w-4 h-4" />
        <span>Se déconnecter</span>
      </button>
    </div>
  );

  const Footer = () => (
    <div className="sidebar-footer">
      <div className="pwa-status-card">
        <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
        <div className="pwa-text">
          <span className="pwa-title">Mode PWA Inclus</span>
          <span className="pwa-desc">Synchro temps réel & Hors-ligne</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Barre latérale bureau */}
      <aside className="sidebar-container">
        <StoreInfo />
        <NavList />
        <Footer />
      </aside>

      {/* Tiroir mobile / tablette (menu hamburger) */}
      <div
        className={`drawer-overlay ${menuOpen ? 'drawer-open' : ''}`}
        onClick={onClose}
        aria-hidden={!menuOpen}
      />
      <aside
        className={`drawer-panel ${menuOpen ? 'drawer-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
      >
        <div className="drawer-head">
          <span className="drawer-title">Menu</span>
          <button onClick={onClose} className="drawer-close" aria-label="Fermer le menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <StoreInfo />
        <NavList onNavigate={onClose} />
        <PwaInstall variant="drawer" />
        <AccountActions onNavigate={onClose} />
        <Footer />
      </aside>
    </>
  );
};
