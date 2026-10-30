// Génération du reçu en PDF dans le navigateur (jsPDF chargé à la demande).
// Formats : ticket 80 mm, ticket 58 mm (hauteur ajustée au contenu) et A4.
import type { ReceiptFormat } from '@/lib/database.types';
import { formatAmount, formatDateTime } from '@/lib/format';
import { pdfSafe, RECEIPT_STATUS_LABELS } from '@/lib/receipt';
import type { ReceiptData } from '@/lib/sales';

type Op =
  | { kind: 'text'; text: string; align: 'left' | 'center'; bold?: boolean; size?: number }
  | { kind: 'pair'; left: string; right: string; bold?: boolean; size?: number }
  | { kind: 'rule' }
  | { kind: 'gap' };

function receiptOps(data: ReceiptData): Op[] {
  const { sale, items, settings } = data;
  const amount = (v: number) => pdfSafe(formatAmount(v));
  const money = (v: number) => `${amount(v)} ${settings.currency}`;
  const ops: Op[] = [];

  ops.push({ kind: 'text', text: settings.name.toUpperCase(), align: 'center', bold: true, size: 1.2 });
  if (settings.tagline) ops.push({ kind: 'text', text: settings.tagline.toUpperCase(), align: 'center' });
  if (settings.address) ops.push({ kind: 'text', text: `Adresse : ${settings.address}`, align: 'center' });
  if (settings.phone) ops.push({ kind: 'text', text: `Téléphone : ${settings.phone}`, align: 'center' });
  if (settings.email) ops.push({ kind: 'text', text: settings.email, align: 'center' });
  ops.push({ kind: 'rule' });
  ops.push({ kind: 'pair', left: 'Reçu n° :', right: sale.receipt_number, bold: true });
  ops.push({ kind: 'pair', left: 'Date :', right: pdfSafe(formatDateTime(sale.created_at, settings.timezone)) });
  ops.push({ kind: 'pair', left: 'Caissier :', right: sale.cashier_name });
  ops.push({ kind: 'rule' });
  for (const item of items) {
    ops.push({ kind: 'text', text: item.product_name, align: 'left' });
    ops.push({ kind: 'pair', left: `${item.quantity} x ${amount(item.unit_price)}`, right: amount(item.line_total) });
  }
  ops.push({ kind: 'rule' });
  ops.push({ kind: 'pair', left: 'Sous-total :', right: money(sale.subtotal) });
  ops.push({ kind: 'pair', left: 'Remise :', right: money(sale.discount_amount) });
  ops.push({ kind: 'pair', left: 'TOTAL :', right: money(sale.total_amount), bold: true, size: 1.2 });
  if (Number(sale.refunded_amount) > 0) {
    ops.push({ kind: 'pair', left: 'Remboursé :', right: `-${money(sale.refunded_amount)}` });
  }
  ops.push({ kind: 'rule' });
  ops.push({ kind: 'pair', left: 'Mode de paiement :', right: sale.payment_method_label });
  ops.push({ kind: 'pair', left: 'Statut :', right: RECEIPT_STATUS_LABELS[sale.sale_status], bold: true });
  if (sale.sale_status === 'cancelled' && sale.cancel_reason) {
    ops.push({ kind: 'text', text: `Motif d’annulation : ${sale.cancel_reason}`, align: 'left' });
  }
  if (settings.receipt_footer) {
    ops.push({ kind: 'rule' });
    ops.push({ kind: 'text', text: settings.receipt_footer, align: 'center', bold: true });
  }
  return ops;
}

export async function downloadReceiptPdf(data: ReceiptData, format: ReceiptFormat): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const ops = receiptOps(data);

  const thermal = format !== 'a4';
  const pageWidth = format === '58mm' ? 58 : format === '80mm' ? 80 : 210;
  const margin = format === '58mm' ? 3 : format === '80mm' ? 4 : 20;
  const baseSize = format === '58mm' ? 7.5 : format === '80mm' ? 8.5 : 10.5;
  const lineHeight = (size: number) => size * 0.42;
  const contentWidth = (thermal ? pageWidth : 120) - 2 * (thermal ? margin : 0);
  const left = thermal ? margin : (pageWidth - 120) / 2;
  const right = left + contentWidth;

  // Première passe : mesure de la hauteur nécessaire (tickets).
  const measure = new jsPDF({ unit: 'mm', format: [pageWidth, 300] });
  measure.setFont(thermal ? 'courier' : 'helvetica');
  let height = margin;
  for (const op of ops) {
    const size = baseSize * ('size' in op && op.size ? op.size : 1);
    measure.setFontSize(size);
    if (op.kind === 'text') height += measure.splitTextToSize(pdfSafe(op.text), contentWidth).length * lineHeight(size);
    else if (op.kind === 'pair') height += lineHeight(size);
    else height += 2.5;
  }
  height += margin;

  const doc = thermal
    ? new jsPDF({ unit: 'mm', format: [pageWidth, Math.max(height, 60)] })
    : new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont(thermal ? 'courier' : 'helvetica');
  doc.setProperties({ title: `Reçu ${data.sale.receipt_number}`, creator: data.settings.name });

  let y = thermal ? margin : 25;
  for (const op of ops) {
    const size = baseSize * ('size' in op && op.size ? op.size : 1);
    doc.setFontSize(size);
    doc.setFont(thermal ? 'courier' : 'helvetica', 'bold' in op && op.bold ? 'bold' : 'normal');
    if (op.kind === 'text') {
      const lines: string[] = doc.splitTextToSize(pdfSafe(op.text), contentWidth);
      for (const line of lines) {
        y += lineHeight(size);
        if (op.align === 'center') doc.text(line, left + contentWidth / 2, y, { align: 'center' });
        else doc.text(line, left, y);
      }
    } else if (op.kind === 'pair') {
      y += lineHeight(size);
      doc.text(pdfSafe(op.left), left, y);
      doc.text(pdfSafe(op.right), right, y, { align: 'right' });
    } else {
      y += 1.25;
      doc.setLineDashPattern([0.8, 0.8], 0);
      doc.setLineWidth(0.2);
      doc.line(left, y, right, y);
      y += 1.25;
    }
  }

  doc.save(`recu-${data.sale.receipt_number}.pdf`);
}
