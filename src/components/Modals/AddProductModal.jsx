import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CATEGORIES } from '../../utils/initialData';
import { X, Package, Save } from 'lucide-react';

export const AddProductModal = ({ productToEdit, onClose }) => {
  const { addProduct, updateProduct, boutiques, activeRole } = useApp();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('charbon');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [minAlertStock, setMinAlertStock] = useState('10');
  const [stocks, setStocks] = useState({ b1: 0, b2: 0, b3: 0 });
  const [image, setImage] = useState('');

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setCategory(productToEdit.category);
      setBuyPrice(productToEdit.buyPrice);
      setSellPrice(productToEdit.sellPrice);
      setMinAlertStock(productToEdit.minAlertStock);
      setStocks(productToEdit.stocks || { b1: 0, b2: 0, b3: 0 });
      setImage(productToEdit.image || '');
    }
  }, [productToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !buyPrice || !sellPrice) return;

    const payload = {
      name,
      category,
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      minAlertStock: Number(minAlertStock),
      stocks: {
        b1: Number(stocks.b1 || 0),
        b2: Number(stocks.b2 || 0),
        b3: Number(stocks.b3 || 0)
      },
      image: image || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80'
    };

    if (productToEdit) {
      await updateProduct(productToEdit.id, payload);
    } else {
      await addProduct(payload);
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-lg animate-pop">
        <div className="modal-header">
          <div className="flex-center gap-2">
            <Package className="w-6 h-6 text-indigo-400" />
            <h2 className="modal-title">
              {productToEdit ? 'Modifier le Produit' : 'Nouveau Produit au Catalogue'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Désignation du Produit</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Charbon Coconut 1kg"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Prix d'Achat Unitaire (FCFA)</label>
              <input
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="ex: 2500"
                min="0"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Prix de Vente Unitaire (FCFA)</label>
              <input
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="ex: 4500"
                min="0"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Seuil d'Alerte Stock Bas (Unites)</label>
              <input
                type="number"
                value={minAlertStock}
                onChange={(e) => setMinAlertStock(e.target.value)}
                min="1"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">URL Image (Optionnel)</label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://..."
                className="form-input"
              />
            </div>
          </div>

          <div className="stocks-per-boutique-box">
            <h4 className="box-subheading">Stock Initial par Boutique</h4>
            <div className="stocks-inputs-grid">
              {boutiques.map((b) => (
                <div key={b.id} className="stock-store-input">
                  <span className="store-badge-label">{b.name}</span>
                  <input
                    type="number"
                    value={stocks[b.id] ?? 0}
                    onChange={(e) =>
                      setStocks({ ...stocks, [b.id]: Math.max(0, Number(e.target.value)) })
                    }
                    min="0"
                    className="form-input text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn btn-primary flex-center gap-2">
              <Save className="w-4 h-4" /> Enregistrer le Produit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
