import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  INITIAL_BOUTIQUES,
  INITIAL_PRODUCTS,
  INITIAL_SALES,
  INITIAL_DEBTS,
  INITIAL_EXPENSES,
  INITIAL_CUSTOMERS
} from '../utils/initialData';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Persistence key helpers
  const loadLocal = (key, fallback) => {
    try {
      const saved = localStorage.getItem(`gestock_3b_${key}`);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [boutiques] = useState(INITIAL_BOUTIQUES);
  const [activeBoutiqueId, setActiveBoutiqueId] = useState(() => loadLocal('activeBoutiqueId', 'all'));
  const [activeRole, setActiveRole] = useState(() => loadLocal('activeRole', 'admin')); // 'admin' | 'gerant'
  const [theme, setTheme] = useState(() => loadLocal('theme', 'dark'));

  // Data States
  const [products, setProducts] = useState(() => loadLocal('products', INITIAL_PRODUCTS));
  const [sales, setSales] = useState(() => loadLocal('sales', INITIAL_SALES));
  const [debts, setDebts] = useState(() => loadLocal('debts', INITIAL_DEBTS));
  const [expenses, setExpenses] = useState(() => loadLocal('expenses', INITIAL_EXPENSES));
  const [customers, setCustomers] = useState(() => loadLocal('customers', INITIAL_CUSTOMERS));

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

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('gestock_3b_activeBoutiqueId', JSON.stringify(activeBoutiqueId));
  }, [activeBoutiqueId]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_activeRole', JSON.stringify(activeRole));
  }, [activeRole]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_theme', JSON.stringify(theme));
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_debts', JSON.stringify(debts));
  }, [debts]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('gestock_3b_customers', JSON.stringify(customers));
  }, [customers]);

  // Current active boutique details (or null if 'all')
  const activeBoutique = boutiques.find((b) => b.id === activeBoutiqueId) || null;

  // Add a sale
  const addSale = ({ items, paymentMethod, cashReceived, cashChange, omReference, customerName, customerId, dueDate }) => {
    const targetBoutiqueId = activeBoutiqueId === 'all' ? 'b1' : activeBoutiqueId;
    const targetBoutique = boutiques.find((b) => b.id === targetBoutiqueId);

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const newSaleId = `V-${1000 + sales.length + 1}`;

    const newSale = {
      id: newSaleId,
      boutiqueId: targetBoutiqueId,
      date: new Date().toISOString(),
      items,
      totalAmount,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? Number(cashReceived) : null,
      cashChange: paymentMethod === 'cash' ? Number(cashChange) : null,
      omReference: paymentMethod === 'orange_money' ? omReference : null,
      customerName: customerName || 'Client Passant',
      seller: targetBoutique ? targetBoutique.manager : 'Administrateur'
    };

    // Deduct stock
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const itemInSale = items.find((i) => i.productId === p.id);
        if (!itemInSale) return p;

        const currentStockInStore = p.stocks[targetBoutiqueId] || 0;
        const newStockInStore = Math.max(0, currentStockInStore - itemInSale.quantity);

        return {
          ...p,
          stocks: {
            ...p.stocks,
            [targetBoutiqueId]: newStockInStore
          }
        };
      })
    );

    // If Credit sale -> Create Debt
    if (paymentMethod === 'credit') {
      const debtId = `D-${200 + debts.length + 1}`;
      const newDebt = {
        id: debtId,
        customerId: customerId || `c-${Date.now()}`,
        customerName: customerName || 'Client Crédit',
        phone: '',
        boutiqueId: targetBoutiqueId,
        saleId: newSaleId,
        date: new Date().toISOString(),
        dueDate: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        originalAmount: totalAmount,
        remainingAmount: totalAmount,
        status: 'pending',
        repayments: []
      };

      setDebts((prev) => [newDebt, ...prev]);

      // Update customer debt total
      setCustomers((prev) => {
        const existing = prev.find((c) => c.name.toLowerCase() === customerName.toLowerCase());
        if (existing) {
          return prev.map((c) => (c.id === existing.id ? { ...c, totalDebt: c.totalDebt + totalAmount } : c));
        } else {
          return [
            ...prev,
            { id: `c-${Date.now()}`, name: customerName, phone: '', boutiqueId: targetBoutiqueId, totalDebt: totalAmount }
          ];
        }
      });
    }

    setSales((prev) => [newSale, ...prev]);
    addToast(`Vente ${newSaleId} enregistrée avec succès ! (${totalAmount.toLocaleString()} GNF)`, 'success');
    return newSale;
  };

  // Repay Debt
  const repayDebt = ({ debtId, amount, paymentMethod, omRef, receivedBy }) => {
    const numAmount = Number(amount);

    setDebts((prevDebts) =>
      prevDebts.map((debt) => {
        if (debt.id !== debtId) return debt;

        const newRemaining = Math.max(0, debt.remainingAmount - numAmount);
        const isPaid = newRemaining === 0;

        const repaymentEntry = {
          id: `R-${Date.now()}`,
          date: new Date().toISOString(),
          amount: numAmount,
          paymentMethod,
          omRef: omRef || null,
          receivedBy: receivedBy || 'Gérant'
        };

        return {
          ...debt,
          remainingAmount: newRemaining,
          status: isPaid ? 'paid' : 'partial',
          repayments: [...debt.repayments, repaymentEntry]
        };
      })
    );

    addToast(`Remboursement de ${numAmount.toLocaleString()} GNF enregistré !`, 'success');
  };

  // Transfer stock between boutiques
  const transferStock = ({ productId, fromBoutiqueId, toBoutiqueId, quantity }) => {
    const qty = Number(quantity);
    if (qty <= 0) return;

    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.id !== productId) return p;

        const currentFrom = p.stocks[fromBoutiqueId] || 0;
        if (currentFrom < qty) {
          addToast(`Stock insuffisant dans la boutique source !`, 'error');
          return p;
        }

        const currentTo = p.stocks[toBoutiqueId] || 0;

        return {
          ...p,
          stocks: {
            ...p.stocks,
            [fromBoutiqueId]: currentFrom - qty,
            [toBoutiqueId]: currentTo + qty
          }
        };
      })
    );

    const product = products.find((p) => p.id === productId);
    const fromB = boutiques.find((b) => b.id === fromBoutiqueId)?.name;
    const toB = boutiques.find((b) => b.id === toBoutiqueId)?.name;

    addToast(`Transfert de ${qty}x ${product?.name} (${fromB} ➔ ${toB}) réalisé !`, 'success');
  };

  // Add Product
  const addProduct = (newProd) => {
    const id = `p-${Date.now()}`;
    const productObj = {
      id,
      ...newProd,
      stocks: newProd.stocks || { b1: 0, b2: 0, b3: 0 }
    };
    setProducts((prev) => [productObj, ...prev]);
    addToast(`Produit "${newProd.name}" ajouté avec succès !`, 'success');
  };

  // Update Product
  const updateProduct = (id, updatedFields) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updatedFields } : p)));
    addToast(`Produit mis à jour !`, 'success');
  };

  // Add Expense
  const addExpense = ({ category, description, amount, boutiqueId }) => {
    const targetBoutiqueId = boutiqueId || (activeBoutiqueId === 'all' ? 'b1' : activeBoutiqueId);
    const newExpense = {
      id: `E-${300 + expenses.length + 1}`,
      boutiqueId: targetBoutiqueId,
      date: new Date().toISOString(),
      category,
      description,
      amount: Number(amount),
      recordedBy: activeRole === 'admin' ? 'Administrateur' : 'Gérant'
    };

    setExpenses((prev) => [newExpense, ...prev]);
    addToast(`Dépense de ${Number(amount).toLocaleString()} GNF enregistrée !`, 'info');
  };

  // Reset to initial demo data
  const resetToDemoData = () => {
    setProducts(INITIAL_PRODUCTS);
    setSales(INITIAL_SALES);
    setDebts(INITIAL_DEBTS);
    setExpenses(INITIAL_EXPENSES);
    setCustomers(INITIAL_CUSTOMERS);
    localStorage.clear();
    addToast('Données de démonstration réinitialisées avec succès !', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        boutiques,
        activeBoutiqueId,
        setActiveBoutiqueId,
        activeBoutique,
        activeRole,
        setActiveRole,
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
        transferStock,
        addProduct,
        updateProduct,
        addExpense,
        resetToDemoData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
