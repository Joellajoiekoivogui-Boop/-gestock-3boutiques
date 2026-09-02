import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  generateDailyReportPDF,
  generateStockReportPDF,
  generateDebtReportPDF
} from '../utils/pdfGenerator';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Store,
  CheckCircle,
  FileText,
  Boxes,
  Receipt
} from 'lucide-react';

export const Reports = () => {
  const {
    sales,
    expenses,
    debts,
    products,
    boutiques,
    activeBoutiqueId
  } = useApp();

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reportBoutiqueId, setReportBoutiqueId] = useState(
    activeBoutiqueId === 'all' ? 'b1' : activeBoutiqueId
  );

  // Compute daily stats for selected boutique and date
  const computeDailyStats = () => {
    const targetBoutique = boutiques.find((b) => b.id === reportBoutiqueId);
    const daySales = sales.filter((s) => {
      const saleDate = new Date(s.date).toISOString().split('T')[0];
      const matchBoutique = reportBoutiqueId === 'all' || s.boutiqueId === reportBoutiqueId;
      return matchBoutique && saleDate === selectedDate;
    });

    const dayExpenses = expenses.filter((e) => {
      const expDate = new Date(e.date).toISOString().split('T')[0];
      const matchBoutique = reportBoutiqueId === 'all' || e.boutiqueId === reportBoutiqueId;
      return matchBoutique && expDate === selectedDate;
    });

    const totalRevenue = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const cashTotal = daySales
      .filter((s) => s.paymentMethod === 'cash')
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const omTotal = daySales
      .filter((s) => s.paymentMethod === 'orange_money')
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const creditTotal = daySales
      .filter((s) => s.paymentMethod === 'credit')
      .reduce((sum, s) => sum + s.totalAmount, 0);

    const expensesTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Repayments recovered on that day
    const recoveredDebtsTotal = debts.reduce((sum, d) => {
      if (reportBoutiqueId !== 'all' && d.boutiqueId !== reportBoutiqueId) return sum;
      const dayRepayments = d.repayments.filter((r) => {
        const rDate = new Date(r.date).toISOString().split('T')[0];
        return rDate === selectedDate;
      });
      return sum + dayRepayments.reduce((rSum, r) => rSum + r.amount, 0);
    }, 0);

    // COGS estimation
    const totalCOGS = daySales.reduce((sum, sale) => {
      return (
        sum +
        sale.items.reduce((iSum, item) => {
          const prod = products.find((p) => p.id === item.productId);
          return iSum + item.quantity * (prod ? prod.buyPrice : item.unitPrice * 0.6);
        }, 0)
      );
    }, 0);

    const netProfit = totalRevenue - totalCOGS - expensesTotal;

    return {
      boutiqueName: targetBoutique ? targetBoutique.name : 'Toutes Boutiques',
      totalRevenue,
      cashTotal,
      omTotal,
      creditTotal,
      expensesTotal,
      recoveredDebtsTotal,
      netProfit,
      salesCount: daySales.length
    };
  };

  const dailyStats = computeDailyStats();

  const handleDownloadDailyPDF = () => {
    generateDailyReportPDF(dailyStats, dailyStats.boutiqueName, selectedDate);
  };

  const handleDownloadStockPDF = () => {
    const targetBoutique = boutiques.find((b) => b.id === reportBoutiqueId);
    const boutiqueName = targetBoutique ? targetBoutique.name : 'Toutes Boutiques';

    const mappedProducts = products.map((p) => ({
      ...p,
      currentStock:
        reportBoutiqueId === 'all'
          ? Object.values(p.stocks).reduce((a, b) => a + b, 0)
          : p.stocks[reportBoutiqueId] || 0
    }));

    generateStockReportPDF(mappedProducts, boutiqueName);
  };

  const handleDownloadDebtsPDF = () => {
    const targetBoutique = boutiques.find((b) => b.id === reportBoutiqueId);
    const boutiqueName = targetBoutique ? targetBoutique.name : 'Toutes Boutiques';
    const targetDebts =
      reportBoutiqueId === 'all'
        ? debts
        : debts.filter((d) => d.boutiqueId === reportBoutiqueId);

    generateDebtReportPDF(targetDebts, boutiqueName);
  };

  return (
    <div className="reports-page animate-fade">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Centre d'Exportation & Rapports PDF</h1>
          <p className="page-subtitle">
            Générez les procès-verbaux de clôture de caisse et les bilans comptables d'un clic.
          </p>
        </div>
      </div>

      {/* Report Configuration Controls */}
      <div className="glass-panel p-6 mt-4">
        <h3 className="text-lg font-bold mb-4 flex-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" /> Configuration du Rapport à Générer
        </h3>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label flex-center gap-1">
              <Store className="w-4 h-4 text-indigo-400" /> Sélectionner la Boutique
            </label>
            <select
              value={reportBoutiqueId}
              onChange={(e) => setReportBoutiqueId(e.target.value)}
              className="form-input"
            >
              {boutiques.map((b) => (
                <option key={b.id} value={b.id}>
                  📍 {b.name} ({b.manager})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label flex-center gap-1">
              <Calendar className="w-4 h-4 text-indigo-400" /> Date du Rapport
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </div>

      {/* Live Preview Box for Selected Date */}
      <div className="glass-panel p-6 mt-6">
        <div className="flex-between mb-4">
          <h4 className="font-bold text-slate-100 flex-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" /> Synthèse de Caisse du {formatDate(selectedDate)} ({dailyStats.boutiqueName})
          </h4>
          <button onClick={handleDownloadDailyPDF} className="btn btn-emerald flex-center gap-2">
            <Download className="w-4 h-4" /> Télécharger Rapport de Clôture PDF
          </button>
        </div>

        <div className="report-summary-grid">
          <div className="rep-stat-box">
            <span>Chiffre d'Affaires</span>
            <strong className="text-indigo-400">{formatMoney(dailyStats.totalRevenue)}</strong>
          </div>
          <div className="rep-stat-box">
            <span>Ventes Espèces</span>
            <strong className="text-emerald-400">{formatMoney(dailyStats.cashTotal)}</strong>
          </div>
          <div className="rep-stat-box">
            <span>Orange Money</span>
            <strong className="text-orange-400">{formatMoney(dailyStats.omTotal)}</strong>
          </div>
          <div className="rep-stat-box">
            <span>Crédits Accordés</span>
            <strong className="text-red-400">{formatMoney(dailyStats.creditTotal)}</strong>
          </div>
          <div className="rep-stat-box">
            <span>Dépenses Effectuées</span>
            <strong className="text-amber-400">-{formatMoney(dailyStats.expensesTotal)}</strong>
          </div>
          <div className="rep-stat-box">
            <span>Bénéfice Net Estimé</span>
            <strong className="text-purple-400">{formatMoney(dailyStats.netProfit)}</strong>
          </div>
        </div>
      </div>

      {/* Other Printable Reports Grid */}
      <div className="reports-cards-grid mt-6">
        <div className="report-card glass-panel">
          <div className="report-card-icon bg-indigo-500/20 text-indigo-400">
            <Boxes className="w-6 h-6" />
          </div>
          <h4 className="report-card-title">Inventaire Valorisé des Stocks</h4>
          <p className="report-card-desc">
            Export PDF complet de la liste des produits avec quantités, prix d'achat, prix de vente et statut d'alerte.
          </p>
          <button onClick={handleDownloadStockPDF} className="btn btn-secondary w-full mt-4 flex-center gap-2">
            <Download className="w-4 h-4" /> Télécharger Inventaire PDF
          </button>
        </div>

        <div className="report-card glass-panel">
          <div className="report-card-icon bg-red-500/20 text-red-400">
            <Receipt className="w-6 h-6" />
          </div>
          <h4 className="report-card-title">Rapport Global des Dettes Clients</h4>
          <p className="report-card-desc">
            Document PDF récapitulant les créances non soldées, dates d'échéance et retards pour relances clients.
          </p>
          <button onClick={handleDownloadDebtsPDF} className="btn btn-secondary w-full mt-4 flex-center gap-2">
            <Download className="w-4 h-4" /> Télécharger État Dettes PDF
          </button>
        </div>
      </div>
    </div>
  );
};
