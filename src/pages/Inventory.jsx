import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CATEGORIES } from '../utils/initialData';
import { formatMoney } from '../utils/formatters';
import { AddProductModal } from '../components/Modals/AddProductModal';
import { TransferStockModal } from '../components/Modals/TransferStockModal';
import {
  Boxes,
  Plus,
  ArrowRightLeft,
  Search,
  AlertTriangle,
  Edit2,
  TrendingUp,
  PackageCheck,
  Building
} from 'lucide-react';

export const Inventory = () => {
  const {
    products,
    boutiques,
    activeBoutiqueId,
    activeRole,
    updateProduct
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockAlertFilter, setStockAlertFilter] = useState('all'); // 'all' | 'alert'

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [transferProduct, setTransferProduct] = useState(null);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;

    let isAlert = false;
    if (activeBoutiqueId === 'all') {
      const tot = Object.values(p.stocks).reduce((a, b) => a + b, 0);
      isAlert = tot <= p.minAlertStock * 2;
    } else {
      isAlert = (p.stocks[activeBoutiqueId] || 0) <= p.minAlertStock;
    }

    const matchesAlert = stockAlertFilter === 'all' || (stockAlertFilter === 'alert' && isAlert);

    return matchesSearch && matchesCat && matchesAlert;
  });

  // Calculate totals
  const totalItemsCount = filteredProducts.reduce((acc, p) => {
    if (activeBoutiqueId === 'all') {
      return acc + Object.values(p.stocks).reduce((a, b) => a + b, 0);
    }
    return acc + (p.stocks[activeBoutiqueId] || 0);
  }, 0);

  const totalBuyValuation = filteredProducts.reduce((acc, p) => {
    const qty =
      activeBoutiqueId === 'all'
        ? Object.values(p.stocks).reduce((a, b) => a + b, 0)
        : p.stocks[activeBoutiqueId] || 0;
    return acc + qty * p.buyPrice;
  }, 0);

  const totalSellValuation = filteredProducts.reduce((acc, p) => {
    const qty =
      activeBoutiqueId === 'all'
        ? Object.values(p.stocks).reduce((a, b) => a + b, 0)
        : p.stocks[activeBoutiqueId] || 0;
    return acc + qty * p.sellPrice;
  }, 0);

  const handleQuickRestock = (product, boutiqueId) => {
    const currentQty = product.stocks[boutiqueId] || 0;
    const addQty = prompt(`Ajouter du stock pour ${product.name} dans cette boutique :`, '10');
    if (!addQty || isNaN(addQty)) return;

    const newStock = currentQty + Number(addQty);
    updateProduct(product.id, {
      stocks: {
        ...product.stocks,
        [boutiqueId]: newStock
      }
    });
  };

  return (
    <div className="inventory-page animate-fade">
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion des Stocks & Inventaires</h1>
          <p className="page-subtitle">
            Consultez les niveaux de stock, réalisez des réapprovisionnements et transferts.
          </p>
        </div>

        <div className="flex-center gap-2">
          {activeRole === 'admin' && (
            <button
              onClick={() => setTransferProduct(products[0])}
              className="btn btn-secondary flex-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" /> Transfert Inter-Boutiques
            </button>
          )}

          {activeRole === 'admin' && (
            <button
              onClick={() => {
                setProductToEdit(null);
                setIsAddModalOpen(true);
              }}
              className="btn btn-primary flex-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nouveau Produit
            </button>
          )}
        </div>
      </div>

      {/* Valuation & Stock Metrics */}
      <div className="valuation-grid mt-4">
        <div className="val-card glass-panel">
          <span className="val-label">Nombre total d'articles</span>
          <span className="val-num text-indigo-400">{totalItemsCount} unités</span>
        </div>

        {activeRole === 'admin' && (
          <div className="val-card glass-panel">
            <span className="val-label">Valeur du Stock (Prix d'Achat)</span>
            <span className="val-num text-emerald-400">{formatMoney(totalBuyValuation)}</span>
          </div>
        )}

        <div className="val-card glass-panel">
          <span className="val-label">Valeur du Stock (Prix de Vente)</span>
          <span className="val-num text-amber-400">{formatMoney(totalSellValuation)}</span>
        </div>

        {activeRole === 'admin' && (
          <div className="val-card glass-panel">
            <span className="val-label">Marge Brute Potentielle</span>
            <span className="val-num text-purple-400">
              {formatMoney(totalSellValuation - totalBuyValuation)}
            </span>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="inventory-filters-bar glass-panel mt-4">
        <div className="search-input-wrap">
          <Search className="w-4 h-4 search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par libellé..."
            className="search-input"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        <button
          onClick={() =>
            setStockAlertFilter(stockAlertFilter === 'all' ? 'alert' : 'all')
          }
          className={`filter-btn-alert ${
            stockAlertFilter === 'alert' ? 'alert-active' : ''
          }`}
        >
          <AlertTriangle className="w-4 h-4 mr-1 inline" /> Stocks Critique Seul
        </button>
      </div>

      {/* Main Stock Table */}
      <div className="glass-panel table-container mt-4">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                {activeRole === 'admin' && <th>Prix Achat</th>}
                <th>Prix Vente</th>
                <th>Stock Boutique Centre</th>
                <th>Stock Boutique Port</th>
                <th>Stock Palmeraie</th>
                <th>Stock Total</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-table-cell">
                    Aucun produit ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const b1Stock = p.stocks.b1 || 0;
                  const b2Stock = p.stocks.b2 || 0;
                  const b3Stock = p.stocks.b3 || 0;
                  const totalStock = b1Stock + b2Stock + b3Stock;

                  const isTotalLow = totalStock <= p.minAlertStock * 2;

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex-center gap-3">
                          <img src={p.image} alt={p.name} className="table-thumb" />
                          <span className="font-semibold text-slate-100">{p.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info">{p.category}</span>
                      </td>
                      {activeRole === 'admin' && (
                        <td className="text-slate-400">{formatMoney(p.buyPrice)}</td>
                      )}
                      <td className="font-bold text-indigo-300">{formatMoney(p.sellPrice)}</td>

                      {/* Stock per store with quick restock buttons */}
                      <td>
                        <span
                          onClick={() => handleQuickRestock(p, 'b1')}
                          className={`clickable-stock-badge ${
                            b1Stock <= p.minAlertStock ? 'badge-danger' : 'badge-ok'
                          }`}
                          title="Cliquer pour réapprovisionner"
                        >
                          {b1Stock} u.
                        </span>
                      </td>
                      <td>
                        <span
                          onClick={() => handleQuickRestock(p, 'b2')}
                          className={`clickable-stock-badge ${
                            b2Stock <= p.minAlertStock ? 'badge-danger' : 'badge-ok'
                          }`}
                          title="Cliquer pour réapprovisionner"
                        >
                          {b2Stock} u.
                        </span>
                      </td>
                      <td>
                        <span
                          onClick={() => handleQuickRestock(p, 'b3')}
                          className={`clickable-stock-badge ${
                            b3Stock <= p.minAlertStock ? 'badge-danger' : 'badge-ok'
                          }`}
                          title="Cliquer pour réapprovisionner"
                        >
                          {b3Stock} u.
                        </span>
                      </td>

                      <td className="font-extrabold text-slate-100">{totalStock}</td>

                      <td>
                        {isTotalLow ? (
                          <span className="badge badge-danger flex-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Stock Bas
                          </span>
                        ) : (
                          <span className="badge badge-success">OK</span>
                        )}
                      </td>

                      <td>
                        <div className="table-actions-cell">
                          {activeRole === 'admin' && (
                            <button
                              onClick={() => {
                                setProductToEdit(p);
                                setIsAddModalOpen(true);
                              }}
                              className="btn-icon"
                              title="Modifier Produit"
                            >
                              <Edit2 className="w-4 h-4 text-indigo-400" />
                            </button>
                          )}
                          <button
                            onClick={() => setTransferProduct(p)}
                            className="btn-icon"
                            title="Transférer"
                          >
                            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isAddModalOpen && (
        <AddProductModal
          productToEdit={productToEdit}
          onClose={() => {
            setIsAddModalOpen(false);
            setProductToEdit(null);
          }}
        />
      )}

      {transferProduct && (
        <TransferStockModal
          preselectedProduct={transferProduct}
          onClose={() => setTransferProduct(null)}
        />
      )}
    </div>
  );
};
