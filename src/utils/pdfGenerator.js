import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatMoney, formatDateTime, formatDate, getPaymentMethodLabel } from './formatters';

// Helper for Header Styling
const addHeader = (doc, title, subtitle = '') => {
  doc.setFillColor(15, 23, 42); // #0f172a Deep Dark Slate
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('GESTOCK 3B — GESTION MULTI-BOUTIQUES', 14, 16);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(title.toUpperCase(), 14, 25);

  if (subtitle) {
    doc.setFontSize(9);
    doc.text(subtitle, 140, 25);
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(99, 102, 241); // Indigo border
  doc.line(0, 35, 210, 35);
};

// 1. Ticket de Caisse / Reçu de Vente
export const generateSaleReceiptPDF = (sale, boutique) => {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 180] // Receipt thermal format width 80mm
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('GESTOCK 3B', 40, 10, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(boutique ? boutique.name.toUpperCase() : 'BOUTIQUE', 40, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(boutique ? boutique.location : '', 40, 19, { align: 'center' });
  doc.text(`Tél: ${boutique ? boutique.phone : ''}`, 40, 23, { align: 'center' });

  doc.line(5, 26, 75, 26);

  doc.setFontSize(8);
  doc.text(`Ticket N° : ${sale.id}`, 5, 31);
  doc.text(`Date : ${formatDateTime(sale.date)}`, 5, 35);
  doc.text(`Vendeur : ${sale.seller || 'Gérant'}`, 5, 39);
  doc.text(`Client : ${sale.customerName || 'Passant'}`, 5, 43);

  doc.line(5, 46, 75, 46);

  let y = 51;
  doc.setFont('helvetica', 'bold');
  doc.text('Article', 5, y);
  doc.text('Qté x PU', 45, y);
  doc.text('Total', 75, y, { align: 'right' });
  y += 3;

  doc.setFont('helvetica', 'normal');
  sale.items.forEach((item) => {
    y += 4;
    const nameTruncated = item.name.length > 22 ? item.name.substring(0, 22) + '...' : item.name;
    doc.text(nameTruncated, 5, y);
    doc.text(`${item.quantity} x ${item.unitPrice}`, 45, y);
    doc.text(`${item.quantity * item.unitPrice}`, 75, y, { align: 'right' });
  });

  y += 5;
  doc.line(5, y, 75, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL :', 5, y);
  doc.text(formatMoney(sale.totalAmount), 75, y, { align: 'right' });

  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Paiement : ${getPaymentMethodLabel(sale.paymentMethod)}`, 5, y);

  if (sale.paymentMethod === 'orange_money' && sale.omReference) {
    y += 4;
    doc.text(`Réf. OM : ${sale.omReference}`, 5, y);
  } else if (sale.paymentMethod === 'cash') {
    y += 4;
    doc.text(`Reçu : ${formatMoney(sale.cashReceived)} | Rendu : ${formatMoney(sale.cashChange)}`, 5, y);
  } else if (sale.paymentMethod === 'credit') {
    y += 4;
    doc.setTextColor(220, 38, 38);
    doc.text(`A payer avant le : ${formatDate(sale.dueDate)}`, 5, y);
    doc.setTextColor(0, 0, 0);
  }

  y += 8;
  doc.setFontSize(7);
  doc.text('Merci de votre visite et à bientôt !', 40, y, { align: 'center' });

  doc.save(`Ticket_${sale.id}.pdf`);
};

// 2. Reçu de Remboursement de Dette
export const generateRepaymentReceiptPDF = (debt, repayment, boutique) => {
  const doc = new jsPDF();
  addHeader(doc, 'REÇU DE REMBOURSEMENT DE DETTE', `Réf: ${repayment.id}`);

  let y = 45;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Boutique : ${boutique ? boutique.name : 'Toutes'}`, 14, y);
  doc.text(`Date : ${formatDateTime(repayment.date)}`, 140, y);

  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Client : ${debt.customerName}`, 14, y);
  doc.text(`Téléphone : ${debt.phone || '-'}`, 140, y);

  y += 8;
  doc.text(`Dette d'origine : ${formatMoney(debt.originalAmount)}`, 14, y);
  doc.text(`Reçu par : ${repayment.receivedBy || 'Gérant'}`, 140, y);

  y += 10;
  doc.autoTable({
    startY: y,
    head: [['Montant Payé', 'Mode de Règlement', 'Référence OM / Reçu', 'Nouveau Solde Restant']],
    body: [
      [
        formatMoney(repayment.amount),
        getPaymentMethodLabel(repayment.paymentMethod),
        repayment.omRef || 'N/A',
        formatMoney(debt.remainingAmount)
      ]
    ],
    theme: 'grid',
    headStyles: { fillStyle: 'F', fillColor: [79, 70, 229], textColor: [255, 255, 255] }
  });

  y = doc.lastAutoTable.finalY + 15;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text('Ce reçu atteste du versement effectué par le client pour l\'apurement de sa créance.', 14, y);

  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.text('Signature Gérant / Cachet :', 140, y);

  doc.save(`Recu_Remboursement_${repayment.id}.pdf`);
};

// 3. Rapport de Synthèse / Clôture Journalière
export const generateDailyReportPDF = (stats, boutiqueName, selectedDate) => {
  const doc = new jsPDF();
  addHeader(doc, `RAPPORT ET FERMETURE DE CAISSE`, `Date: ${formatDate(selectedDate)}`);

  let y = 45;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Boutique : ${boutiqueName}`, 14, y);

  y += 10;
  doc.autoTable({
    startY: y,
    head: [['Indicateur Financier', 'Montant (GNF)']],
    body: [
      ['Chiffre d\'Affaires Total', formatMoney(stats.totalRevenue)],
      ['Encaissements Espèces', formatMoney(stats.cashTotal)],
      ['Encaissements Orange Money', formatMoney(stats.omTotal)],
      ['Nouvelles Dettes Accordées', formatMoney(stats.creditTotal)],
      ['Remboursements Dettes Recouvrés', formatMoney(stats.recoveredDebtsTotal)],
      ['Dépenses Totales', formatMoney(stats.expensesTotal)],
      ['BÉNÉFICE NET ESTIMÉ', formatMoney(stats.netProfit)]
    ],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    columnStyles: { 1: { fontStyle: 'bold', halign: 'right' } }
  });

  y = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Document généré automatiquement par Gestock 3B.', 14, y);

  doc.save(`Rapport_Caisse_${boutiqueName.replace(/\s+/g, '_')}_${selectedDate}.pdf`);
};

// 4. Rapport d'Inventaire des Stocks
export const generateStockReportPDF = (products, boutiqueName) => {
  const doc = new jsPDF();
  addHeader(doc, 'RAPPORT VALORISÉ DE L\'INVENTAIRE DES STOCKS', `Boutique: ${boutiqueName}`);

  const rows = products.map((p) => {
    const qty = p.currentStock;
    const valBuy = qty * p.buyPrice;
    const valSell = qty * p.sellPrice;
    const status = qty <= p.minAlertStock ? 'ALERTE LOW' : 'OK';

    return [
      p.name,
      p.category,
      formatMoney(p.buyPrice),
      formatMoney(p.sellPrice),
      qty,
      formatMoney(valBuy),
      formatMoney(valSell),
      status
    ];
  });

  doc.autoTable({
    startY: 45,
    head: [['Produit', 'Catégorie', 'P. Achat', 'P. Vente', 'Stock', 'Val. Achat', 'Val. Vente', 'Statut']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
    columnStyles: {
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { fontStyle: 'bold', halign: 'center' }
    }
  });

  doc.save(`Inventaire_Stock_${boutiqueName.replace(/\s+/g, '_')}.pdf`);
};

// 5. Rapport des Dettes Clients
export const generateDebtReportPDF = (debts, boutiqueName) => {
  const doc = new jsPDF();
  addHeader(doc, 'ÉTAT GLOBAL DES DETTES ET CRÉANCES CLIENTS', `Boutique: ${boutiqueName}`);

  const rows = debts.map((d) => [
    d.customerName,
    d.phone || '-',
    formatDate(d.date),
    formatDate(d.dueDate),
    formatMoney(d.originalAmount),
    formatMoney(d.remainingAmount),
    d.remainingAmount === 0 ? 'SOLDÉ' : (new Date(d.dueDate) < new Date() ? 'EN RETARD' : 'EN COURS')
  ]);

  doc.autoTable({
    startY: 45,
    head: [['Client', 'Contact', 'Date Prêt', 'Échéance', 'Origine', 'Reste à Payer', 'Statut']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] },
    columnStyles: { 4: { halign: 'right' }, 5: { fontStyle: 'bold', halign: 'right' } }
  });

  doc.save(`Rapport_Dettes_${boutiqueName.replace(/\s+/g, '_')}.pdf`);
};
