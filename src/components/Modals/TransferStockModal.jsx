import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, ArrowRightLeft, Check } from 'lucide-react';

export const TransferStockModal = ({ preselectedProduct, onClose }) => {
  const { products, boutiques, transferStock } = useApp();

  const [productId, setProductId] = useState(preselectedProduct ? preselectedProduct.id : products[0]?.id || '');
  const [fromBoutiqueId, setFromBoutiqueId] = useState('b1');
  const [toBoutiqueId, setToBoutiqueId] = useState('b2');
  const [quantity, setQuantity] = useState('5');

  const selectedProduct = products.find((p) => p.id === productId);
  const maxAvailable = selectedProduct?.stocks[fromBoutiqueId] || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (fromBoutiqueId === toBoutiqueId) {
      alert('La boutique d\'origine et de destination doivent être différentes.');
      return;
    }
    const qty = Number(quantity);
    if (qty <= 0 || qty > maxAvailable) return;

    transferStock({ productId, fromBoutiqueId, toBoutiqueId, quantity: qty });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-pop">
        <div className="modal-header">
          <div className="flex-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
            <h2 className="modal-title">Transfert Inter-Boutiques</h2>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Sélectionner le Produit</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="form-input"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="transfer-route-grid">
            <div className="form-group">
              <label className="form-label">Boutique Source (Départ)</label>
              <select
                value={fromBoutiqueId}
                onChange={(e) => setFromBoutiqueId(e.target.value)}
                className="form-input"
              >
                {boutiques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (Stock: {selectedProduct?.stocks[b.id] || 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="transfer-arrow-divider">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
            </div>

            <div className="form-group">
              <label className="form-label">Boutique Cible (Arrivée)</label>
              <select
                value={toBoutiqueId}
                onChange={(e) => setToBoutiqueId(e.target.value)}
                className="form-input"
              >
                {boutiques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (Stock: {selectedProduct?.stocks[b.id] || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Quantité à Transférer (Dispo: {maxAvailable})</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              max={maxAvailable}
              min="1"
              required
              className="form-input text-lg font-bold"
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button
              type="submit"
              disabled={maxAvailable < 1}
              className="btn btn-primary flex-center gap-2"
            >
              <Check className="w-4 h-4" /> Valider le Transfert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
