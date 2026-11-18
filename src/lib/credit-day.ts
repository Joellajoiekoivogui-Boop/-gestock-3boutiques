import 'server-only';
import { dayRangeUtc, todayIn } from '@/lib/dates';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Crédits de la journée, pour passer des ventes du jour à l'argent
 * réellement encaissé : ventes du jour − crédits non payés du jour
 * + crédits d'avant réglés aujourd'hui.
 * `cashierId` limite le calcul aux ventes d'un caissier (et aux crédits qu'il
 * a lui-même encaissés).
 */
export async function getDayCredit(
  supabase: Client,
  timeZone: string,
  cashierId?: string,
  shopId?: string | null,
): Promise<{ unpaidToday: number; settledToday: number }> {
  const today = todayIn(timeZone);
  const { start, end } = dayRangeUtc(today, today, timeZone);
  const due = (rows: { total_amount: number; refunded_amount: number }[] | null) =>
    (rows ?? []).reduce((sum, s) => sum + Number(s.total_amount) - Number(s.refunded_amount), 0);

  let unpaid = supabase
    .from('sales')
    .select('total_amount, refunded_amount')
    .eq('payment_method', 'credit')
    .eq('payment_status', 'pending')
    .neq('sale_status', 'cancelled')
    .gte('created_at', start)
    .lt('created_at', end)
    .limit(2000);
  let settled = supabase
    .from('sales')
    .select('total_amount, refunded_amount')
    .eq('payment_method', 'credit')
    .eq('payment_status', 'paid')
    .neq('sale_status', 'cancelled')
    .gte('paid_at', start)
    .lt('paid_at', end)
    // Un crédit fait et réglé aujourd'hui est déjà compté dans les ventes du jour.
    .lt('created_at', start)
    .limit(2000);
  if (shopId) {
    unpaid = unpaid.eq('shop_id', shopId);
    settled = settled.eq('shop_id', shopId);
  }
  if (cashierId) {
    unpaid = unpaid.eq('cashier_id', cashierId);
    settled = settled.eq('settled_by', cashierId);
  }
  const [a, b] = await Promise.all([unpaid, settled]);
  // Base sans la migration des crédits : rien à déduire.
  if (a.error || b.error) return { unpaidToday: 0, settledToday: 0 };
  return { unpaidToday: due(a.data), settledToday: due(b.data) };
}
