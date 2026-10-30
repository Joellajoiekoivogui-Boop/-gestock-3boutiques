import type { SaleStatus, StockMovementType } from '@/lib/database.types';

const NBSP = '\u00a0';

// 60000 → "60 000" (espaces insécables, pas de décimales : le GNF n'en a pas).
export function formatAmount(value: number | string | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return '0';
  const sign = n < 0 ? '-' : '';
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

// 60000 → "60 000 GNF"
export function formatMoney(value: number | string | null | undefined, currency = 'GNF'): string {
  return `${formatAmount(value)}${NBSP}${currency}`;
}

// Pour les PDF (polices standard) et le CSV : espaces ordinaires.
export function plainText(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, ' ');
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(isoOrDay: string, timeZone = 'UTC'): string {
  // Une date seule (AAAA-MM-JJ) est un jour calendaire : pas de conversion.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDay) ? new Date(`${isoOrDay}T12:00:00Z`) : new Date(isoOrDay);
  const tz = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDay) ? 'UTC' : timeZone;
  return new Intl.DateTimeFormat('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatShortDay(day: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  completed: 'Payée',
  partially_refunded: 'Partiellement remboursée',
  refunded: 'Remboursée',
  cancelled: 'Annulée',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  sale: 'Vente',
  sale_cancel: 'Annulation de vente',
  restock: 'Approvisionnement',
  adjustment: 'Ajustement',
};
