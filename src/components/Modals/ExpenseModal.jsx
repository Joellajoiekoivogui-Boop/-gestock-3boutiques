import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Wallet, Plus } from 'lucide-react';

export const ExpenseModal = ({ onClose }) => {
  const { addExpense, boutiques, activeBoutiqueId } = useApp();

  const [category, setCategory] = useState('Transport');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [targetBoutiqueId, setTargetBoutiqueId] = useState(
    activeBoutiqueId === 'all' ? 'b1' : activeBoutiqueId
  );

  const categories = [
    'Transport',
    'Électricité / Factures',
    'Loyer Magasin',
    'Salaires',
    'Achats Stock',
    'Fournitures & Emballages',
    'Maintenance / Entretien',
    'Divers'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !description) return;

    addExpense({
      category,
      description,
      amount,
      boutiqueId: targetBoutiqueId
    });

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-pop">
        <div className="modal-header">
          <div className="flex-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            <h2 className="modal-title">Saisir une Dépense</h2>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Boutique Concernée</label>
            <select
              value={targetBoutiqueId}
              onChange={(e) => setTargetBoutiqueId(e.target.value)}
              className="form-input"
            >
              {boutiques.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Catégorie de Dépense</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Description / Motif</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex: Facture CIE mois de juillet, Taxi achat cartons..."
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Montant de la Dépense (FCFA)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ex: 5000"
              min="1"
              required
              className="form-input text-lg font-bold"
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn btn-warning flex-center gap-2">
              <Plus className="w-4 h-4" /> Enregistrer la Dépense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
