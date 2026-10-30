import { getSession, getSettings } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import type { SaleRow } from '@/lib/database.types';
import { formatDateTime, SALE_STATUS_LABELS } from '@/lib/format';
import { can } from '@/lib/permissions';
import { listSales, parseSalesFilters } from '@/lib/sales-query';
import { createClient } from '@/lib/supabase/server';

const MAX_ROWS = 10_000;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !can(session.profile, 'view_all_sales')) {
    return new Response('Accès refusé', { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseSalesFilters(Object.fromEntries(url.searchParams));
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const supabase = await createClient();
  const { rows } = await listSales(supabase, filters, tz, { offset: 0, limit: MAX_ROWS });

  const csv = toCsv<SaleRow>(rows, [
    { header: 'N° de reçu', value: (s) => s.receipt_number },
    { header: 'Date', value: (s) => formatDateTime(s.created_at, tz) },
    { header: 'Caissier', value: (s) => s.cashier_name },
    { header: 'Articles', value: (s) => s.item_count },
    { header: 'Sous-total', value: (s) => Number(s.subtotal) },
    { header: 'Remise', value: (s) => Number(s.discount_amount) },
    { header: 'Total', value: (s) => Number(s.total_amount) },
    { header: 'Remboursé', value: (s) => Number(s.refunded_amount) },
    { header: 'Mode de paiement', value: (s) => s.payment_method_label },
    { header: 'Statut', value: (s) => SALE_STATUS_LABELS[s.sale_status] },
    { header: 'Motif annulation', value: (s) => s.cancel_reason },
    { header: 'Devise', value: () => settings?.currency ?? 'GNF' },
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `ventes-${stamp}.csv`);
}
