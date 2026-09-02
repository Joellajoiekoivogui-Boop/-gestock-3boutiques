import React from 'react';
import { CheckCircle, Printer, Download, PlusCircle, X } from 'lucide-react';
import { generateSaleReceiptPDF } from '../../utils/pdfGenerator';
import { formatMoney, getPaymentMethodLabel } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

export const SaleSuccessModal = ({ sale, onClose, onNewSale }) => {
  const { boutiques } = useApp();
  if (!sale) return null;

  const boutique = boutiques.find((b) => b.id === sale.boutiqueId);

  const handleDownloadPDF = () => {
    generateSaleReceiptPDF(sale, boutique);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-success-content animate-pop">
        <div className="modal-header text-center">
          <div className="success-icon-badge">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold mt-2">Vente Enregistrée avec Succès !</h2>
          <p className="text-sm text-slate-400">Reçu N° {sale.id}</p>
        </div>

        <div className="sale-receipt-preview">
          <div className="receipt-row">
            <span>Boutique :</span>
            <strong>{boutique?.name}</strong>
          </div>
          <div className="receipt-row">
            <span>Client :</span>
            <strong>{sale.customerName}</strong>
          </div>
          <div className="receipt-row">
            <span>Mode de Règlement :</span>
            <span className="badge badge-info">{getPaymentMethodLabel(sale.paymentMethod)}</span>
          </div>

          {sale.paymentMethod === 'orange_money' && sale.omReference && (
            <div className="receipt-row">
              <span>Réf. Orange Money :</span>
              <strong className="text-orange-400">{sale.omReference}</strong>
            </div>
          )}

          {sale.paymentMethod === 'cash' && (
            <>
              <div className="receipt-row">
                <span>Montant Reçu :</span>
                <span>{formatMoney(sale.cashReceived)}</span>
              </div>
              <div className="receipt-row">
                <span>Monnaie Rendue :</span>
                <strong className="text-emerald-400">{formatMoney(sale.cashChange)}</strong>
              </div>
            </>
          )}

          <hr className="divider" />

          <div className="items-list-preview">
            {sale.items.map((item, idx) => (
              <div key={idx} className="item-row">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span>{formatMoney(item.quantity * item.unitPrice)}</span>
              </div>
            ))}
          </div>

          <hr className="divider" />

          <div className="receipt-total-row">
            <span>TOTAL PAYÉ :</span>
            <span className="total-price-text">{formatMoney(sale.totalAmount)}</span>
          </div>
        </div>

        <div className="modal-actions-grid">
          <button onClick={handleDownloadPDF} className="btn btn-primary flex-center gap-2">
            <Download className="w-4 h-4" /> Télécharger Reçu PDF
          </button>
          <button onClick={onNewSale} className="btn btn-secondary flex-center gap-2">
            <PlusCircle className="w-4 h-4" /> Nouvelle Vente
          </button>
        </div>

        <button onClick={onClose} className="modal-close-corner">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
