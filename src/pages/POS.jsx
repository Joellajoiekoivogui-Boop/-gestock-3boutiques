import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney } from '../utils/formatters';
import { SaleSuccessModal } from '../components/Modals/SaleSuccessModal';
import { FeuillVente } from './FeuillVente';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Wallet,
  Smartphone,
  CreditCard,
  User,
  CheckCircle,
  AlertCircle,
  Package,
  Calendar,
  ClipboardList,
  LayoutGrid
} from 'lucide-react';

export const POS = () => {
  const {
    products,
    activeBoutiqueId,
    activeBoutique,
    addSale,
    customers,
    addToast
  } = useApp();

  const [viewMode, setViewMode] = useState('sheet'); // 'sheet' (Feuille de vente) | 'pos' (Caisse classique)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);

  // Customer & Payment Form State
  const [customerName, setCustomerName] = useState('Client Passant');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'orange_money' | 'credit'
  const [omReference, setOmReference] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );

  // Success Modal
  const [completedSale, setCompletedSale] = useState(null);

  const currentStoreId = activeBoutiqueId === 'all' ? 'b1' : activeBoutiqueId;

  // Le catalogue de la Caisse est celui de la Feuille de Vente, pour la boutique active
  const storeProducts = useMemo(
    () => products.filter((p) => p.boutiqueId === currentStoreId),
    [products, currentStoreId]
  );

  const categories = useMemo(() => {
    const seen = [];
    for (const p of storeProducts) {
      if (p.category && !seen.includes(p.category)) seen.push(p.category);
    }
    return seen;
  }, [storeProducts]);

  // Filter products by search & category
  const filteredProducts = storeProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Cart operations
  const addToCart = (product) => {
    const stockAvail = product.stock || 0;
    const existingIndex = cart.findIndex((item) => item.productId === product.id);

    if (existingIndex > -1) {
      const existingItem = cart[existingIndex];
      if (existingItem.quantity >= stockAvail) {
        addToast(`Stock max atteint pour ${product.name} (${stockAvail} dispo)`, 'error');
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      if (stockAvail <= 0) {
        addToast(`Produit ${product.name} épuisé dans cette boutique !`, 'error');
        return;
      }
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.sellPrice,
          quantity: 1,
          image: product.image
        }
      ]);
    }
  };

  const updateQuantity = (productId, delta) => {
    const product = storeProducts.find((p) => p.id === productId);
    const stockAvail = product ? product.stock || 0 : 999;

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty > stockAvail) {
              addToast(`Stock max atteint (${stockAvail} dispo)`, 'error');
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  // La somme totale est toujours calculée automatiquement depuis le panier
  const totalCartAmount = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Submit Sale
  const handleCompleteSale = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      addToast('Votre panier est vide !', 'error');
      return;
    }

    if (paymentMethod === 'orange_money' && !omReference) {
      addToast('Veuillez renseigner la référence Orange Money', 'error');
      return;
    }

    if (paymentMethod === 'credit' && (!customerName || customerName === 'Client Passant')) {
      addToast('Veuillez renseigner le nom du client pour une vente à crédit', 'error');
      return;
    }

    const saleResult = await addSale({
      items: cart,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? totalCartAmount : 0,
      cashChange: 0,
      omReference,
      customerName,
      dueDate
    });

    if (!saleResult) return;

    setCompletedSale(saleResult);
    // Reset cart
    setCart([]);
    setOmReference('');
    setCustomerName('Client Passant');
  };

  return (
    <div className="pos-page animate-fade">
      <div className="pos-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">
            {viewMode === 'sheet' ? 'Feuille de Vente Journalière' : 'Terminal de Vente (Caisse POS)'}
          </h1>
          <p className="page-subtitle">
            Boutique active :{' '}
            <strong className="text-indigo-400 font-bold">
              {activeBoutique ? activeBoutique.name : 'Toutes les Boutiques'}
            </strong>
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="role-switcher">
          <button
            onClick={() => setViewMode('sheet')}
            className={`role-btn ${viewMode === 'sheet' ? 'active-role-admin' : ''}`}
            title="Feuille de vente en tableau"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Feuille de Vente</span>
          </button>
          <button
            onClick={() => setViewMode('pos')}
            className={`role-btn ${viewMode === 'pos' ? 'active-role-admin' : ''}`}
            title="Caisse POS avec panier"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Caisse / Catalogue</span>
          </button>
        </div>
      </div>

      {/* Render Feuille de Vente or Classic POS */}
      {viewMode === 'sheet' ? (
        <FeuillVente />
      ) : (
        <div className="pos-layout-grid mt-4">
        {/* Left Column: Product Selection Catalog */}
        <div className="pos-catalog-column">
          {/* Search & Category Filter Bar */}
          <div className="pos-filter-box glass-panel">
            <div className="search-input-wrap">
              <Search className="w-4 h-4 search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom de produit ou code..."
                className="search-input"
              />
            </div>

            <div className="category-pills">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`cat-pill ${selectedCategory === 'all' ? 'pill-active' : ''}`}
              >
                Tous les Articles
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`cat-pill ${selectedCategory === cat ? 'pill-active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="pos-products-grid mt-4">
            {filteredProducts.map((p) => {
              const stockInCurrentStore = p.stock || 0;
              const isOut = stockInCurrentStore === 0;
              const isLow = stockInCurrentStore > 0 && stockInCurrentStore <= p.minAlertStock;

              return (
                <div
                  key={p.id}
                  onClick={() => !isOut && addToCart(p)}
                  className={`pos-product-card glass-panel ${isOut ? 'card-disabled' : ''}`}
                >
                  <div className="pos-product-img-wrap">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="pos-product-img" />
                    ) : (
                      <div className="pos-product-img pos-product-img-placeholder">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    <span
                      className={`stock-badge ${
                        isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-ok'
                      }`}
                    >
                      {isOut ? 'ÉPUISÉ' : `${stockInCurrentStore} dispo`}
                    </span>
                  </div>

                  <div className="pos-product-details">
                    <h4 className="pos-product-title">{p.name}</h4>
                    <div className="pos-product-price-row">
                      <span className="price-tag">{formatMoney(p.sellPrice)}</span>
                      <button disabled={isOut} className="btn-add-cart">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Cart & Checkout Panel */}
        <div className="pos-cart-column glass-panel">
          <div className="cart-header">
            <div className="flex-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-400" />
              <h3 className="cart-title">Panier d'Achat ({cart.length})</h3>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="link-btn-red text-xs">
                Vider le panier
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="cart-items-wrapper">
            {cart.length === 0 ? (
              <div className="empty-cart-state">
                <Package className="w-12 h-12 text-slate-500 mb-2 opacity-50" />
                <p>Votre panier est vide.</p>
                <span className="text-xs text-slate-400">Cliquez sur un article pour l'ajouter.</span>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="cart-item-row">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-price">{formatMoney(item.unitPrice)}</span>
                  </div>

                  <div className="cart-item-controls">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="qty-btn"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="qty-val">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="qty-btn"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="qty-btn-remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Payment Form */}
          <form onSubmit={handleCompleteSale} className="cart-checkout-form">
            <div className="cart-total-box">
              <span>TOTAL À PAYER</span>
              <span className="cart-total-num">{formatMoney(totalCartAmount)}</span>
            </div>

            {/* Customer Input */}
            <div className="form-group">
              <label className="form-label flex-center gap-1">
                <User className="w-3.5 h-3.5" /> Nom du Client / Débiteur
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Client Passant..."
                className="form-input"
              />
            </div>

            {/* Payment Method Selector */}
            <div className="form-group">
              <label className="form-label">Mode de Règlement</label>
              <div className="payment-grid-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`pay-mode-btn ${paymentMethod === 'cash' ? 'pay-active-cash' : ''}`}
                >
                  <Wallet className="w-4 h-4" /> Espèces
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('orange_money')}
                  className={`pay-mode-btn ${paymentMethod === 'orange_money' ? 'pay-active-om' : ''}`}
                >
                  <Smartphone className="w-4 h-4 text-orange-400" /> Orange Money
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`pay-mode-btn ${paymentMethod === 'credit' ? 'pay-active-credit' : ''}`}
                >
                  <CreditCard className="w-4 h-4 text-red-400" /> Crédit
                </button>
              </div>
            </div>

            {/* Conditional Payment Method Controls */}
            {paymentMethod === 'cash' && (
              <div className="change-result-box animate-fade">
                <span>Montant encaissé en espèces :</span>
                <strong className="text-emerald-400">{formatMoney(totalCartAmount)}</strong>
              </div>
            )}

            {paymentMethod === 'orange_money' && (
              <div className="form-group animate-fade">
                <label className="form-label">Référence Transaction Orange Money</label>
                <input
                  type="text"
                  value={omReference}
                  onChange={(e) => setOmReference(e.target.value)}
                  placeholder="Code de validation OM (ex: OM-99281)"
                  required
                  className="form-input"
                />
              </div>
            )}

            {paymentMethod === 'credit' && (
              <div className="form-group animate-fade">
                <label className="form-label flex-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date Limite d'Échéance du Paiement
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={cart.length === 0}
              className="btn btn-emerald w-full py-3 text-base font-bold flex-center gap-2 mt-4"
            >
              <CheckCircle className="w-5 h-5" /> Valider la Vente ({formatMoney(totalCartAmount)})
            </button>
          </form>
        </div>
      </div>
      )}

      {/* Printable Receipt Popup Modal */}
      {completedSale && (
        <SaleSuccessModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
          onNewSale={() => {
            setCompletedSale(null);
            setCart([]);
          }}
        />
      )}
    </div>
  );
};
