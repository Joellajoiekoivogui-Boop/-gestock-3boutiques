import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Store,
  Shield,
  User,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Bell,
  Sparkles,
  ChevronDown
} from 'lucide-react';

export const Navbar = () => {
  const {
    boutiques,
    activeBoutiqueId,
    setActiveBoutiqueId,
    activeRole,
    setActiveRole,
    theme,
    setTheme,
    products,
    activeBoutique
  } = useApp();

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calculate low stock alert count
  const lowStockCount = products.filter((p) => {
    if (activeBoutiqueId === 'all') {
      const totalStock = Object.values(p.stocks).reduce((a, b) => a + b, 0);
      return totalStock <= p.minAlertStock * 3;
    }
    return (p.stocks[activeBoutiqueId] || 0) <= p.minAlertStock;
  }).length;

  return (
    <header className="navbar-container">
      {/* Brand & Boutique Switcher */}
      <div className="navbar-left">
        <div className="brand-logo">
          <div className="brand-icon">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="brand-text">
            <span className="brand-title">GESTOCK</span>
            <span className="brand-badge">3B</span>
          </div>
        </div>

        {/* Boutique Selector Dropdown */}
        <div className="boutique-selector-wrapper">
          <Store className="w-4 h-4 text-indigo-400" />
          <select
            value={activeBoutiqueId}
            onChange={(e) => setActiveBoutiqueId(e.target.value)}
            className="boutique-select"
          >
            {activeRole === 'admin' && (
              <option value="all">🏢 Toutes les Boutiques (Vue Consolidée)</option>
            )}
            {boutiques.map((b) => (
              <option key={b.id} value={b.id}>
                📍 {b.name} ({b.manager})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 select-arrow" />
        </div>
      </div>

      {/* Navbar Right Actions */}
      <div className="navbar-right">
        {/* Offline/Online PWA Indicator */}
        <div className={`status-badge ${isOnline ? 'status-online' : 'status-offline'}`}>
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5" /> <span>En Ligne</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" /> <span>Hors Ligne</span>
            </>
          )}
        </div>

        {/* Low stock alert badge */}
        {lowStockCount > 0 && (
          <div className="alert-badge" title={`${lowStockCount} produit(s) en alerte de stock`}>
            <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="alert-count">{lowStockCount}</span>
          </div>
        )}

        {/* Role Switcher (Admin vs Gérant) */}
        <div className="role-switcher">
          <button
            onClick={() => setActiveRole('admin')}
            className={`role-btn ${activeRole === 'admin' ? 'active-role-admin' : ''}`}
            title="Passer en mode Administrateur"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden-mobile">Admin</span>
          </button>
          <button
            onClick={() => {
              setActiveRole('gerant');
              if (activeBoutiqueId === 'all') setActiveBoutiqueId('b1');
            }}
            className={`role-btn ${activeRole === 'gerant' ? 'active-role-gerant' : ''}`}
            title="Passer en mode Gérant de boutique"
          >
            <User className="w-4 h-4" />
            <span className="hidden-mobile">Gérant</span>
          </button>
        </div>

        {/* Theme Dark / Light toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="theme-toggle-btn"
          aria-label="Changer le thème"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-300" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>
      </div>
    </header>
  );
};
