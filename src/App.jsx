import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';

import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { Debts } from './pages/Debts';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

function MainLayout() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <div className="app-shell">
      <Navbar />

      <div className="app-body">
        <Sidebar activePage={activePage} setActivePage={setActivePage} />

        <main className="app-main-content">
          {activePage === 'dashboard' && <Dashboard onNavigate={setActivePage} />}
          {activePage === 'pos' && <POS />}
          {activePage === 'inventory' && <Inventory />}
          {activePage === 'debts' && <Debts />}
          {activePage === 'expenses' && <Expenses />}
          {activePage === 'reports' && <Reports />}
          {activePage === 'settings' && <Settings />}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
