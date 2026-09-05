import React, { createContext, useContext, useState, useEffect } from 'react';

const TOKEN_KEY = 'gestock_3b_token';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Persistence key helpers (préférences d'affichage uniquement — les
  // données métier vivent désormais dans Supabase, plus dans le navigateur)
  const loadLocal = (key, fallback) => {
    try {
      const saved = localStorage.getItem(`gestock_3b_${key}`);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [activeBoutiqueId, setActiveBoutiqueId] = useState(() => loadLocal('activeBoutiqueId', 'all'));
  const [theme, setTheme] = useState(() => loadLocal('theme', 'dark'));

  // Le rôle découle du compte connecté
  const activeRole = currentUser?.role === 'admin' ? 'admin' : 'gerant';

  // Data States — chargées depuis /api/data (Supabase), partagées entre tous les appareils
  const [boutiques, setBoutiques] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [debts, setDebts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);

  // UI Toast notifications
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Chargement des données partagées (Supabase, via les fonctions serveur) ---
  const fetchData = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setDataLoading(true);
    try {
      const r = await fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Impossible de charger les données.');
      setBoutiques(data.boutiques || []);
      setProducts(data.products || []);
      setSales(data.sales || []);
      setDebts(data.debts || []);
      setExpenses(data.expenses || []);
      setCustomers(data.customers || []);
    } catch (err) {
      addToast(err.message || 'Serveur injoignable. Vérifiez votre connexion.', 'error');
    } finally {
      setDataLoading(false);
    }
  };

  // Petit utilitaire d'appel API authentifié pour les actions métier
  const callApi = async (url, method, body) => {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const r = await fetch(url, {
        method,
        headers:
          method === 'GET'
            ? { Authorization: `Bearer ${token}` }
            : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Une erreur est survenue.');
      return { ok: true, data };
    } catch (err) {
      addToast(err.message || 'Serveur injoignable. Vérifiez votre connexion.', 'error');
      return { ok: false, error: err.message };
    }
  };

  // --- Authentification (fonctions serveur Vercel + jeton signé) ---
  const applyUser = (user) => {
    setCurrentUser(user);
    setActiveBoutiqueId(
      user.role === 'admin' ? loadLocal('activeBoutiqueId', 'all') : user.boutiqueId
    );
  };

  // Au démarrage : on valide le jeton auprès du serveur (une session forgée
  // à la main dans le localStorage est rejetée ici), puis on charge les données.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthChecking(false);
      return;
    }
    fetch('/api/session', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('invalid'))))
      .then(({ user }) => {
        applyUser(user);
        return fetchData();
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setAuthChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return { ok: false, error: data.error || 'Connexion impossible.' };
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      applyUser(data.user);
      addToast(`Bienvenue ${data.user.name} !`, 'success');
      await fetchData();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Serveur injoignable. Vérifiez votre connexion.' };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setCurrentUser(null);
    addToast('Vous êtes déconnecté.', 'info');
  };

  // Un gérant ne peut pas changer de boutique
  const changeBoutique = (id) => {
    if (activeRole !== 'admin') return;
    setActiveBoutiqueId(id);
  };

  // Verrouille la boutique du gérant (y compris après un rechargement)
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && activeBoutiqueId !== currentUser.boutiqueId) {
      setActiveBoutiqueId(currentUser.boutiqueId);
    }
  }, [currentUser, activeBoutiqueId]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_activeBoutiqueId', JSON.stringify(activeBoutiqueId));
  }, [activeBoutiqueId]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_theme', JSON.stringify(theme));
    document.documentElement.setAttribute('data-theme', theme);
    // Barre d'état (PWA / mobile) accordée au thème actif
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#0f172a');
  }, [theme]);

  // Current active boutique details (or null if 'all')
  const activeBoutique = boutiques.find((b) => b.id === activeBoutiqueId) || null;

  // Add a sale
  const addSale = async ({ items, paymentMethod, cashReceived, cashChange, omReference, customerName, customerId, dueDate }) => {
    const targetBoutiqueId = activeBoutiqueId === 'all' ? 'b1' : activeBoutiqueId;

    const result = await callApi('/api/sales', 'POST', {
      boutiqueId: targetBoutiqueId,
      items,
      paymentMethod,
      cashReceived,
      cashChange,
      omReference,
      customerName,
      customerId,
      dueDate
    });
    if (!result.ok) return null;

    await fetchData();
    addToast(`Vente ${result.data.sale.id} enregistrée avec succès ! (${result.data.sale.totalAmount.toLocaleString()} GNF)`, 'success');
    return result.data.sale;
  };

  // Repay Debt
  const repayDebt = async ({ debtId, amount, paymentMethod, omRef, receivedBy }) => {
    const result = await callApi('/api/debts', 'POST', { debtId, amount, paymentMethod, omRef, receivedBy });
    if (!result.ok) return null;

    await fetchData();
    addToast(`Remboursement de ${Number(amount).toLocaleString()} GNF enregistré !`, 'success');
    return result.data.debt;
  };

  // Add Expense
  const addExpense = async ({ category, description, amount, boutiqueId }) => {
    const targetBoutiqueId = boutiqueId || (activeBoutiqueId === 'all' ? 'b1' : activeBoutiqueId);
    const result = await callApi('/api/expenses', 'POST', { category, description, amount, boutiqueId: targetBoutiqueId });
    if (!result.ok) return null;

    await fetchData();
    addToast(`Dépense de ${Number(amount).toLocaleString()} GNF enregistrée !`, 'info');
    return result.data.expense;
  };

  return (
    <AppContext.Provider
      value={{
        boutiques,
        currentUser,
        authChecking,
        dataLoading,
        login,
        logout,
        activeBoutiqueId,
        setActiveBoutiqueId: changeBoutique,
        activeBoutique,
        activeRole,
        theme,
        setTheme,
        products,
        sales,
        debts,
        expenses,
        customers,
        toasts,
        addToast,
        removeToast,
        addSale,
        repayDebt,
        addExpense,
        refreshData: fetchData,
        apiRequest: callApi
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
