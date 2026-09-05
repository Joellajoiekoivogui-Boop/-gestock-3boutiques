import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { generateRepaymentReceiptPDF } from '../../utils/pdfGenerator';
import { formatMoney } from '../../utils/formatters';
import { X, Wallet, Smartphone, Check } from 'lucide-react';

export const RepayDebtModal = ({ debt, onClose }) => {
  const { repayDebt, boutiques } = useApp();
  const [amount, setAmount] = useState(debt ? debt.remainingAmount : '');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'orange_money'
  const [omRef, setOmRef] = useState('');
  const [receivedBy, setReceivedBy] = useState('Gérant');

  if (!debt) return null;

  const boutique = boutiques.find((b) => b.id === debt.boutiqueId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0 || numAmount > debt.remainingAmount) return;

    const updatedDebt = await repayDebt({
      debtId: debt.id,
      amount: numAmount,
      paymentMethod,
      omRef: paymentMethod === 'orange_money' ? omRef : null,
      receivedBy
    });

    if (!updatedDebt) return;

    // Auto generate receipt PDF
    const repayment = {
      id: `R-${Date.now()}`,
      date: new Date().toISOString(),
      amount: numAmount,
      paymentMethod,
      omRef,
      receivedBy
    };
    generateRepaymentReceiptPDF(
      { ...debt, remainingAmount: Math.max(0, debt.remainingAmount - numAmount) },
      repayment,
      boutique
    );

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-pop">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Enregistrer un Remboursement</h2>
            <p className="modal-subtitle">Client : {debt.customerName} ({boutique?.name})</p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="debt-summary-box">
            <div>
              <span>Dette totale d'origine :</span>
              <strong>{formatMoney(debt.originalAmount)}</strong>
            </div>
            <div>
              <span>Solde actuel à payer :</span>
              <strong className="text-red-400">{formatMoney(debt.remainingAmount)}</strong>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Montant à rembourser (FCFA)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={debt.remainingAmount}
              min={1}
              required
              className="form-input text-lg font-bold"
            />
            <div className="quick-amount-tags">
              <button type="button" onClick={() => setAmount(debt.remainingAmount)} className="tag-btn">
                Règlement Total ({formatMoney(debt.remainingAmount)})
              </button>
              {debt.remainingAmount >= 10000 && (
                <button type="button" onClick={() => setAmount(5000)} className="tag-btn">
                  5 000 FCFA
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mode de Règlement</label>
            <div className="payment-select-grid">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`payment-opt-btn ${paymentMethod === 'cash' ? 'opt-active-cash' : ''}`}
              >
                <Wallet className="w-5 h-5" />
                <span>Espèces</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('orange_money')}
                className={`payment-opt-btn ${paymentMethod === 'orange_money' ? 'opt-active-om' : ''}`}
              >
                <Smartphone className="w-5 h-5 text-orange-400" />
                <span>Orange Money</span>
              </button>
            </div>
          </div>

          {paymentMethod === 'orange_money' && (
            <div className="form-group animate-fade">
              <label className="form-label">Référence Transaction Orange Money</label>
              <input
                type="text"
                value={omRef}
                onChange={(e) => setOmRef(e.target.value)}
                placeholder="ex: OM-99201482"
                required
                className="form-input"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Reçu par (Nom du Gérant / Caissier)</label>
            <input
              type="text"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn btn-emerald flex-center gap-2">
              <Check className="w-4 h-4" /> Valider & Imprimer Reçu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
