import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';
import { Login } from './pages/Login';

import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { Debts } from './pages/Debts';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

const ADMIN_ONLY_PAGES = ['dashboard', 'settings'];

function MainLayout() {
  const { activeRole } = useApp();
  const isAdmin = activeRole === 'admin';
  const [requestedPage, setActivePage] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);

  // Un gérant n'accède jamais aux pages réservées à l'admin
  const activePage =
    !isAdmin && ADMIN_ONLY_PAGES.includes(requestedPage) ? 'pos' : requestedPage;

  return (
    <div className="app-shell">
      <Navbar onOpenMenu={() => setMenuOpen(true)} />

      <div className="app-body">
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          menuOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <main className="app-main-content">
          {activePage === 'dashboard' && isAdmin && <Dashboard onNavigate={setActivePage} />}
          {activePage === 'pos' && <POS />}
          {activePage === 'inventory' && <Inventory />}
          {activePage === 'debts' && <Debts />}
          {activePage === 'expenses' && <Expenses />}
          {activePage === 'reports' && <Reports />}
          {activePage === 'settings' && isAdmin && <Settings />}
        </main>
      </div>
    </div>
  );
}

function Root() {
  const { currentUser, authChecking } = useApp();

  if (authChecking) {
    return (
      <div className="auth-shell">
        <div className="auth-card glass-panel" style={{ textAlign: 'center' }}>
          Vérification de la session…
        </div>
      </div>
    );
  }

  return (
    <>
      {currentUser ? <MainLayout /> : <Login />}
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
