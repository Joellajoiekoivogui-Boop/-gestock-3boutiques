import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney, formatDateTime } from '../utils/formatters';
import { ExpenseModal } from '../components/Modals/ExpenseModal';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Smartphone,
  Search,
  Tag
} from 'lucide-react';

export const Expenses = () => {
  const { expenses, sales, activeBoutiqueId, boutiques } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter sales and expenses
  const filteredSales = activeBoutiqueId === 'all'
    ? sales
    : sales.filter((s) => s.boutiqueId === activeBoutiqueId);

  const filteredExpenses = expenses.filter((e) => {
    const matchesBoutique = activeBoutiqueId === 'all' || e.boutiqueId === activeBoutiqueId;
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBoutique && matchesCategory && matchesSearch;
  });

  // Calculate Cash Register totals
  const totalCashCollected = filteredSales
    .filter((s) => s.paymentMethod === 'cash')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const totalOMCollected = filteredSales
    .filter((s) => s.paymentMethod === 'orange_money')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const totalExpensesSum = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netCashInHand = totalCashCollected - totalExpensesSum;

  return (
    <div className="expenses-page animate-fade">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Trésorerie & Journal des Dépenses</h1>
          <p className="page-subtitle">
            Saisissez les dépenses autorisées, suivez les entrées et le solde de caisse liquide.
          </p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn btn-warning flex-center gap-2">
          <Plus className="w-4 h-4" /> Saisir une Dépense
        </button>
      </div>

      {/* Cash Flow Summary Cards */}
      <div className="kpi-grid mt-4">
        <div className="stat-card stat-card-emerald">
          <div className="stat-card-header">
            <span className="stat-card-title">Encaissements Espèces (Ventes)</span>
            <ArrowUpRight className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="stat-card-value text-emerald-400">{formatMoney(totalCashCollected)}</span>
        </div>

        <div className="stat-card stat-card-orange">
          <div className="stat-card-header">
            <span className="stat-card-title">Encaissements Orange Money</span>
            <Smartphone className="w-5 h-5 text-orange-400" />
          </div>
          <span className="stat-card-value text-orange-400">{formatMoney(totalOMCollected)}</span>
        </div>

        <div className="stat-card stat-card-amber">
          <div className="stat-card-header">
            <span className="stat-card-title">Sorties Dépenses Totales</span>
            <ArrowDownLeft className="w-5 h-5 text-amber-400" />
          </div>
          <span className="stat-card-value text-amber-400">{formatMoney(totalExpensesSum)}</span>
        </div>

        <div className="stat-card stat-card-indigo">
          <div className="stat-card-header">
            <span className="stat-card-title">Solde Net Espèces en Caisse</span>
            <Wallet className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="stat-card-value text-indigo-300">{formatMoney(netCashInHand)}</span>
          <span className="stat-card-subtext">Espèces collectées - Dépenses</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="inventory-filters-bar glass-panel mt-6">
        <div className="search-input-wrap">
          <Search className="w-4 h-4 search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer par description de dépense..."
            className="search-input"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">Toutes les catégories</option>
          <option value="Transport">Transport</option>
          <option value="Électricité / Factures">Électricité / Factures</option>
          <option value="Loyer Magasin">Loyer Magasin</option>
          <option value="Salaires">Salaires</option>
          <option value="Achats Stock">Achats Stock</option>
          <option value="Fournitures & Emballages">Fournitures & Emballages</option>
          <option value="Divers">Divers</option>
        </select>
      </div>

      {/* Expenses Table */}
      <div className="glass-panel table-container mt-4">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Réf / Date</th>
                <th>Boutique</th>
                <th>Catégorie</th>
                <th>Motif / Description</th>
                <th>Saisi par</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-table-cell">
                    Aucune dépense enregistrée.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => {
                  const boutique = boutiques.find((b) => b.id === expense.boutiqueId);

                  return (
                    <tr key={expense.id}>
                      <td>
                        <div>
                          <span className="font-bold text-slate-200">{expense.id}</span>
                          <div className="text-xs text-slate-400">
                            {formatDateTime(expense.date)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-indigo-300">
                          {boutique?.name}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-warning flex-center gap-1">
                          <Tag className="w-3 h-3" /> {expense.category}
                        </span>
                      </td>
                      <td className="text-slate-200 font-medium">{expense.description}</td>
                      <td className="text-slate-400 text-sm">{expense.recordedBy}</td>
                      <td>
                        <span className="font-bold text-amber-400 text-base">
                          -{formatMoney(expense.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && <ExpenseModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};
