import 'server-only';
import type { ExpenseRow } from '@/lib/database.types';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

export type DayExpenses = {
  /** La base connaît les dépenses (migration exécutée). */
  available: boolean;
  total: number;
  rows: Pick<ExpenseRow, 'id' | 'label' | 'amount' | 'created_by_name' | 'created_at' | 'shop_id'>[];
};

/**
 * Dépenses d'une journée de vente. Sans filtre, RLS limite déjà ce que
 * l'utilisateur voit (ses propres dépenses, ou celles de sa boutique).
 */
export async function getDayExpenses(
  supabase: Client,
  day: string,
  options: { shopId?: string | null; createdBy?: string } = {},
): Promise<DayExpenses> {
  let query = supabase
    .from('expenses')
    .select('id, label, amount, created_by_name, created_at, shop_id')
    .eq('business_date', day)
    .order('created_at', { ascending: false })
    .limit(500);
  if (options.shopId) query = query.eq('shop_id', options.shopId);
  if (options.createdBy) query = query.eq('created_by', options.createdBy);
  const { data, error } = await query;
  if (error) return { available: false, total: 0, rows: [] };
  const rows = data ?? [];
  return { available: true, total: rows.reduce((sum, r) => sum + Number(r.amount), 0), rows };
}
