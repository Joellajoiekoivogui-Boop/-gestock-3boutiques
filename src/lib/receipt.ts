import type { ReceiptFormat, SaleStatus } from '@/lib/database.types';

export const RECEIPT_FORMATS: { value: ReceiptFormat; label: string }[] = [
  { value: '80mm', label: 'Ticket 80 mm' },
  { value: '58mm', label: 'Ticket 58 mm' },
  { value: 'a4', label: 'Page A4' },
];

export const RECEIPT_STATUS_LABELS: Record<SaleStatus, string> = {
  completed: 'Payé',
  partially_refunded: 'Payé — partiellement remboursé',
  refunded: 'Remboursé',
  cancelled: 'ANNULÉ',
};

export function isReceiptFormat(value: unknown): value is ReceiptFormat {
  return value === '80mm' || value === '58mm' || value === 'a4';
}

// Polices standard des PDF (WinAnsi) : on remplace ce qui n'y figure pas.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
export function pdfSafe(text: string): string {
  return Array.from(text.replace(/[\u00a0\u202f]/g, ' '))
    .map((ch) => (ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(ch) ? ch : '?'))
    .join('');
}
