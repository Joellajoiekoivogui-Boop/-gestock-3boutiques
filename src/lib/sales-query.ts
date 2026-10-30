import 'server-only';
import type { SaleRow, SaleStatus } from '@/lib/database.types';
import { dayRangeUtc, isDay } from '@/lib/dates';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;
type SearchParams = Record<string, string | string[] | undefined>;

export type SalesFilters = {
  q?: string;
  from?: string;
  to?: string;
  cashier?: string;
  method?: string;
  status?: SaleStatus;
};

const STATUSES: SaleStatus[] = ['completed', 'partially_refunded', 'refunded', 'cancelled'];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export function parseSalesFilters(params: SearchParams): SalesFilters {
  const q = first(params.q)?.replace(/[^A-Za-z0-9-]/g, '').slice(0, 30);
  const from = first(params.from);
  const to = first(params.to);
  const cashier = first(params.cashier);
  const method = first(params.method);
  const status = first(params.status);
  return {
    q: q || undefined,
    from: isDay(from) ? from : undefined,
    to: isDay(to) ? to : undefined,
    cashier: cashier && /^[0-9a-f-]{36}$/i.test(cashier) ? cashier : undefined,
    method: method && /^[a-z0-9_]{2,32}$/.test(method) ? method : undefined,
    status: STATUSES.includes(status as SaleStatus) ? (status as SaleStatus) : undefined,
  };
}

export function filtersToParams(filters: SalesFilters): Record<string, string | undefined> {
  return { ...filters };
}

// Liste paginée des ventes selon les filtres. RLS restreint en plus ce que
// l'utilisateur peut voir.
export async function listSales(
  supabase: Client,
  filters: SalesFilters,
  timeZone: string,
  options: { offset: number; limit: number; cashierId?: string },
): Promise<{ rows: SaleRow[]; count: number }> {
  let query = supabase.from('sales').select('*', { count: 'exact' });

  if (filters.q) query = query.ilike('receipt_number', `%${filters.q}%`);
  if (filters.from) query = query.gte('created_at', dayRangeUtc(filters.from, filters.from, timeZone).start);
  if (filters.to) query = query.lt('created_at', dayRangeUtc(filters.to, filters.to, timeZone).end);
  if (filters.method) query = query.eq('payment_method', filters.method);
  if (filters.status) query = query.eq('sale_status', filters.status);
  const cashier = options.cashierId ?? filters.cashier;
  if (cashier) query = query.eq('cashier_id', cashier);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(options.offset, options.offset + options.limit - 1);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], count: count ?? 0 };
}
