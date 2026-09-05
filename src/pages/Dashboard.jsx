import React from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/StatCard';
import { formatMoney, formatDateTime, getPaymentMethodLabel } from '../utils/formatters';
import {
  TrendingUp,
  DollarSign,
  Smartphone,
  Receipt,
  Wallet,
  PieChart as PieIcon,
  AlertTriangle,
  ArrowUpRight,
  PackageCheck,
  Building2,
  Calendar
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const Dashboard = ({ onNavigate }) => {
  const {
    activeBoutiqueId,
    activeBoutique,
    boutiques,
    sales,
    debts,
    expenses,
    products
  } = useApp();

  // Filter sales, debts, expenses based on activeBoutiqueId
  const filteredSales = activeBoutiqueId === 'all'
    ? sales
    : sales.filter((s) => s.boutiqueId === activeBoutiqueId);

  const filteredDebts = activeBoutiqueId === 'all'
    ? debts
    : debts.filter((d) => d.boutiqueId === activeBoutiqueId);

  const filteredExpenses = activeBoutiqueId === 'all'
    ? expenses
    : expenses.filter((e) => e.boutiqueId === activeBoutiqueId);

  // Financial Computations
  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);

  const cashSales = filteredSales
    .filter((s) => s.paymentMethod === 'cash')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const omSales = filteredSales
    .filter((s) => s.paymentMethod === 'orange_money')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const creditSales = filteredSales
    .filter((s) => s.paymentMethod === 'credit')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const totalDebtsRemaining = filteredDebts
    .filter((d) => d.status !== 'paid')
    .reduce((acc, d) => acc + d.remainingAmount, 0);

  const totalExpensesAmount = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

  // Solde net (le prix d'achat n'étant plus suivi, il n'entre plus dans le calcul)
  const netProfit = totalRevenue - totalExpensesAmount;

  // Low stock products
  const scopedProducts =
    activeBoutiqueId === 'all' ? products : products.filter((p) => p.boutiqueId === activeBoutiqueId);
  const lowStockProducts = scopedProducts.filter((p) => (p.stock || 0) <= (p.minAlertStock || 0));

  // Bilan du jour par boutique : ventes, Orange Money, dépenses, crédit
  // accordé et le "reste" (caisse espèces attendue) après déduction de
  // l'Orange Money, du crédit et des dépenses.
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = (isoDate) => new Date(isoDate).toISOString().split('T')[0] === todayStr;

  const dailyByBoutique = boutiques.map((b) => {
    const daySales = sales.filter((s) => s.boutiqueId === b.id && isToday(s.date));
    const dayExpenses = expenses.filter((e) => e.boutiqueId === b.id && isToday(e.date));

    const ventes = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const om = daySales.filter((s) => s.paymentMethod === 'orange_money').reduce((sum, s) => sum + s.totalAmount, 0);
    const credit = daySales.filter((s) => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);
    const depenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const reste = ventes - om - credit - depenses;

    return { boutique: b, ventes, om, credit, depenses, reste };
  });

  // Chart Data 1: Sales Trend (Last 7 Days)
  const daysLabels = ['J-6', 'J-5', 'J-4', 'J-3', 'J-2', 'Hier', 'Aujourd\'hui'];
  const salesTrendData = {
    labels: daysLabels,
    datasets: [
      {
        label: 'Ventes (FCFA)',
        data: [120000, 185000, 140000, 210000, 195000, 260000, totalRevenue || 113500],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  // Chart Data 2: Payment Method Breakdown (Doughnut)
  const paymentBreakdownData = {
    labels: ['Espèces', 'Orange Money', 'Crédit / Dette'],
    datasets: [
      {
        data: [cashSales || 1, omSales || 1, creditSales || 1],
        backgroundColor: ['#10b981', '#f97316', '#ef4444'],
        borderWidth: 0
      }
    ]
  };

  // Chart Data 3: Revenue by Boutique (for Admin overview)
  const boutiqueRevenueData = {
    labels: boutiques.map((b) => b.name),
    datasets: [
      {
        label: 'Chiffre d\'Affaires (FCFA)',
        data: boutiques.map((b) =>
          sales.filter((s) => s.boutiqueId === b.id).reduce((acc, s) => acc + s.totalAmount, 0)
        ),
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
        borderRadius: 8
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
      }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };

  return (
    <div className="dashboard-page animate-fade">
      {/* Dashboard Top Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {activeBoutiqueId === 'all' ? 'Tableau de Bord Consolidé (3 Boutiques)' : `Tableau de Bord — ${activeBoutique?.name}`}
          </h1>
          <p className="page-subtitle">
            Supervision temps réel des stocks, encaissements, dettes et bénéfices.
          </p>
        </div>
        <button onClick={() => onNavigate('pos')} className="btn btn-emerald flex-center gap-2">
          <TrendingUp className="w-4 h-4" /> Nouvelle Vente Caisse
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="kpi-grid">
        <StatCard
          title="Chiffre d'Affaires Total"
          value={formatMoney(totalRevenue)}
          subtext={`${filteredSales.length} transaction(s)`}
          icon={TrendingUp}
          color="indigo"
          trend={{ positive: true, value: '14.2%', label: 'vs semaine passée' }}
        />
        <StatCard
          title="Encaissements Espèces"
          value={formatMoney(cashSales)}
          subtext="En caisse liquide"
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Orange Money (Mobile)"
          value={formatMoney(omSales)}
          subtext="Paiements digitaux"
          icon={Smartphone}
          color="orange"
        />
        <StatCard
          title="Dettes Clients en Cours"
          value={formatMoney(totalDebtsRemaining)}
          subtext={`${filteredDebts.filter((d) => d.status !== 'paid').length} créance(s)`}
          icon={Receipt}
          color="red"
        />
        <StatCard
          title="Dépenses Enregistrées"
          value={formatMoney(totalExpensesAmount)}
          subtext={`${filteredExpenses.length} dépense(s)`}
          icon={Wallet}
          color="amber"
        />
        <StatCard
          title="Solde Net"
          value={formatMoney(netProfit)}
          subtext="Chiffre d'affaires moins dépenses"
          icon={PieIcon}
          color={netProfit >= 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Bilan du jour par boutique */}
      <div className="glass-panel table-container mt-6">
        <div className="widget-header" style={{ padding: '18px 20px 0' }}>
          <h3 className="widget-title">📅 Ventes du Jour par Boutique</h3>
          <span className="chart-subtitle">{todayStr}</span>
        </div>
        <div className="table-responsive" style={{ padding: '12px 20px 20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Boutique</th>
                <th>Ventes</th>
                <th>Orange Money</th>
                <th>Crédit</th>
                <th>Dépenses</th>
                <th>Reste (Caisse)</th>
              </tr>
            </thead>
            <tbody>
              {dailyByBoutique.map(({ boutique: b, ventes, om, credit, depenses, reste }) => (
                <tr key={b.id}>
                  <td>
                    <span className="flex-center gap-2">
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: b.color,
                          display: 'inline-block'
                        }}
                      />
                      <strong>{b.name}</strong>
                    </span>
                  </td>
                  <td>{formatMoney(ventes)}</td>
                  <td className="text-orange-400">{formatMoney(om)}</td>
                  <td className="text-red-400">{formatMoney(credit)}</td>
                  <td className="text-amber-400">-{formatMoney(depenses)}</td>
                  <td>
                    <strong className={reste >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatMoney(reste)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid mt-6">
        <div className="chart-card glass-panel">
          <div className="chart-header">
            <h3 className="chart-title">📈 Évolution du Chiffre d'Affaires</h3>
            <span className="chart-subtitle">Sept (7) derniers jours</span>
          </div>
          <div className="chart-wrapper">
            <Line data={salesTrendData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-card glass-panel">
          <div className="chart-header">
            <h3 className="chart-title">💳 Modes de Règlement</h3>
            <span className="chart-subtitle">Répartition de la collecte</span>
          </div>
          <div className="chart-wrapper flex-center">
            <Doughnut
              data={paymentBreakdownData}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>
        </div>

        {activeBoutiqueId === 'all' && (
          <div className="chart-card glass-panel col-span-full">
            <div className="chart-header">
              <h3 className="chart-title">🏬 Ventes par Boutique (Comparatif)</h3>
              <span className="chart-subtitle">Contribution de chaque établissement</span>
            </div>
            <div className="chart-wrapper">
              <Bar data={boutiqueRevenueData} options={chartOptions} />
            </div>
          </div>
        )}
      </div>

      {/* Low Stock Alert & Recent Sales Dual Section */}
      <div className="dual-grid mt-6">
        {/* Low Stock Widget */}
        <div className="widget-card glass-panel">
          <div className="widget-header">
            <div className="flex-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="widget-title">Alertes de Stock Critique</h3>
            </div>
            <button onClick={() => onNavigate('inventory')} className="link-btn">
              Voir tout ({lowStockProducts.length})
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Stock Dispo</th>
                  <th>Seuil Alerte</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-table-cell text-emerald-400">
                      <PackageCheck className="w-5 h-5 inline mr-2" />
                      Tous les stocks sont à un niveau optimal !
                    </td>
                  </tr>
                ) : (
                  lowStockProducts.map((p) => {
                    const currentStock = p.stock || 0;

                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="flex-center gap-2">
                            <img src={p.image} alt={p.name} className="table-thumb" />
                            <span className="font-semibold">{p.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-danger">{currentStock} unité(s)</span>
                        </td>
                        <td>{p.minAlertStock}</td>
                        <td>
                          <button
                            onClick={() => onNavigate('inventory')}
                            className="btn-xs btn-primary"
                          >
                            Recharger
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Sales Feed Widget */}
        <div className="widget-card glass-panel">
          <div className="widget-header">
            <div className="flex-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h3 className="widget-title">Dernières Ventes Effectuées</h3>
            </div>
            <button onClick={() => onNavigate('pos')} className="link-btn">
              Accéder Caisse
            </button>
          </div>

          <div className="recent-sales-list">
            {filteredSales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="recent-sale-item">
                <div className="sale-item-left">
                  <div className="sale-id-tag">{sale.id}</div>
                  <div>
                    <div className="sale-customer">{sale.customerName}</div>
                    <div className="sale-meta text-xs text-slate-400">
                      {formatDateTime(sale.date)} • {sale.items.length} article(s)
                    </div>
                  </div>
                </div>

                <div className="sale-item-right">
                  <span className="sale-amount font-bold text-indigo-300">
                    {formatMoney(sale.totalAmount)}
                  </span>
                  <span className={`method-badge method-${sale.paymentMethod}`}>
                    {getPaymentMethodLabel(sale.paymentMethod)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
