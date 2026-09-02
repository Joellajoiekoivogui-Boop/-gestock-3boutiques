import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney, formatDate, getDebtStatusInfo } from '../utils/formatters';
import { RepayDebtModal } from '../components/Modals/RepayDebtModal';
import { generateDebtReportPDF } from '../utils/pdfGenerator';
import {
  Receipt,
  Search,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  FileDown,
  ChevronDown,
  History,
  Phone
} from 'lucide-react';

export const Debts = () => {
  const { debts, activeBoutiqueId, boutiques } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'overdue' | 'paid'
  const [selectedDebtForRepay, setSelectedDebtForRepay] = useState(null);
  const [expandedDebtId, setExpandedDebtId] = useState(null);

  // Filter debts
  const filteredDebts = debts.filter((d) => {
    const matchesBoutique = activeBoutiqueId === 'all' || d.boutiqueId === activeBoutiqueId;
    const matchesSearch =
      d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.phone && d.phone.includes(searchQuery));

    const statusInfo = getDebtStatusInfo(d.status, d.dueDate);
    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = d.status === 'pending' || d.status === 'partial';
    if (statusFilter === 'overdue') matchesStatus = statusInfo.label === 'En Retard';
    if (statusFilter === 'paid') matchesStatus = d.status === 'paid';

    return matchesBoutique && matchesSearch && matchesStatus;
  });

  // Aggregated KPIs
  const totalDebtsAmount = filteredDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const overdueDebtsCount = filteredDebts.filter(
    (d) => getDebtStatusInfo(d.status, d.dueDate).label === 'En Retard'
  ).length;

  const handleExportPDF = () => {
    const boutiqueName =
      activeBoutiqueId === 'all'
        ? 'Toutes Boutiques'
        : boutiques.find((b) => b.id === activeBoutiqueId)?.name || 'Boutique';
    generateDebtReportPDF(filteredDebts, boutiqueName);
  };

  return (
    <div className="debts-page animate-fade">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Carnet des Dettes & Créances Clients</h1>
          <p className="page-subtitle">
            Suivez les ventes à crédit, enregistrez les remboursements et relancez les retards.
          </p>
        </div>

        <button onClick={handleExportPDF} className="btn btn-secondary flex-center gap-2">
          <FileDown className="w-4 h-4 text-red-400" /> Export PDF Dettes
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid mt-4">
        <div className="stat-card stat-card-red">
          <div className="stat-card-header">
            <span className="stat-card-title">Encours Total à Recouvrer</span>
            <Receipt className="w-5 h-5 text-red-400" />
          </div>
          <span className="stat-card-value text-red-400">{formatMoney(totalDebtsAmount)}</span>
        </div>

        <div className="stat-card stat-card-amber">
          <div className="stat-card-header">
            <span className="stat-card-title">Créances en Retard</span>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <span className="stat-card-value text-amber-400">{overdueDebtsCount} dossiers</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="inventory-filters-bar glass-panel mt-4">
        <div className="search-input-wrap">
          <Search className="w-4 h-4 search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom de client ou téléphone..."
            className="search-input"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En cours / Partiel</option>
          <option value="overdue">⚠️ En Retard</option>
          <option value="paid">✅ Soldé</option>
        </select>
      </div>

      {/* Debts Table */}
      <div className="glass-panel table-container mt-4">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Réf / Client</th>
                <th>Boutique</th>
                <th>Contact</th>
                <th>Date Prêt</th>
                <th>Date Échéance</th>
                <th>Montant Initial</th>
                <th>Reste à Payer</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-table-cell">
                    Aucune dette trouvée.
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt) => {
                  const statusInfo = getDebtStatusInfo(debt.status, debt.dueDate);
                  const boutique = boutiques.find((b) => b.id === debt.boutiqueId);
                  const isExpanded = expandedDebtId === debt.id;

                  return (
                    <React.Fragment key={debt.id}>
                      <tr>
                        <td>
                          <div>
                            <span className="font-bold text-slate-100">{debt.customerName}</span>
                            <div className="text-xs text-slate-400">Réf: {debt.id}</div>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-indigo-300 font-semibold">
                            {boutique?.name}
                          </span>
                        </td>
                        <td>
                          <span className="text-slate-300 flex-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {debt.phone || '-'}
                          </span>
                        </td>
                        <td className="text-slate-400">{formatDate(debt.date)}</td>
                        <td className="font-medium text-slate-200">{formatDate(debt.dueDate)}</td>
                        <td className="text-slate-400">{formatMoney(debt.originalAmount)}</td>
                        <td>
                          <span className="font-extrabold text-red-400 text-base">
                            {formatMoney(debt.remainingAmount)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td>
                          <div className="flex-center gap-2">
                            {debt.remainingAmount > 0 && (
                              <button
                                onClick={() => setSelectedDebtForRepay(debt)}
                                className="btn-xs btn-emerald"
                              >
                                Rembourser
                              </button>
                            )}

                            {debt.repayments && debt.repayments.length > 0 && (
                              <button
                                onClick={() =>
                                  setExpandedDebtId(isExpanded ? null : debt.id)
                                }
                                className="btn-icon"
                                title="Voir l'historique des règlements"
                              >
                                <History className="w-4 h-4 text-indigo-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Repayment History Accordion */}
                      {isExpanded && debt.repayments && (
                        <tr className="bg-slate-900/60">
                          <td colSpan="9" className="p-4">
                            <div className="repayment-history-box">
                              <h5 className="text-xs font-bold uppercase text-indigo-400 mb-2">
                                📜 Historique des Versations de Remboursement ({debt.repayments.length})
                              </h5>
                              <div className="space-y-1">
                                {debt.repayments.map((rep) => (
                                  <div key={rep.id} className="history-item-row">
                                    <span>{formatDate(rep.date)}</span>
                                    <strong className="text-emerald-400">
                                      +{formatMoney(rep.amount)}
                                    </strong>
                                    <span className="text-slate-400 text-xs">
                                      Mode: {rep.paymentMethod} {rep.omRef ? `(Réf: ${rep.omRef})` : ''}
                                    </span>
                                    <span className="text-slate-500 text-xs">
                                      Reçu par: {rep.receivedBy}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Repay Modal */}
      {selectedDebtForRepay && (
        <RepayDebtModal
          debt={selectedDebtForRepay}
          onClose={() => setSelectedDebtForRepay(null)}
        />
      )}
    </div>
  );
};
