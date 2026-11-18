import 'server-only';
import { dayRangeUtc, todayIn } from '@/lib/dates';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Crédits d'une journée, pour passer des ventes du jour à l'argent
 * réellement encaissé ce jour-là :
 *   ventes du jour − crédits du jour encore impayés à la fin de la journée
 *   + crédits des jours précédents réglés pendant la journée.
 * `day` vaut aujourd'hui par défaut (AAAA-MM-JJ, fuseau de l'établissement).
 * `cashierId` limite le calcul aux ventes d'un caissier (et aux crédits qu'il
 * a lui-même encaissés).
 */
export async function getDayCredit(
  supabase: Client,
  timeZone: string,
  cashierId?: string,
  shopId?: string | null,
  day?: string,
): Promise<{ unpaidToday: number; settledToday: number }> {
  const date = day ?? todayIn(timeZone);
  const { start, end } = dayRangeUtc(date, date, timeZone);
  const due = (rows: { total_amount: number; refunded_amount: number }[]) =>
    rows.reduce((sum, s) => sum + Number(s.total_amount) - Number(s.refunded_amount), 0);

  let created = supabase
    .from('sales')
    .select('total_amount, refunded_amount, paid_at')
    .eq('payment_method', 'credit')
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
    // Un crédit fait et réglé le même jour est déjà compté dans les ventes du jour.
    .lt('created_at', start)
    .limit(2000);
  if (shopId) {
    created = created.eq('shop_id', shopId);
    settled = settled.eq('shop_id', shopId);
  }
  if (cashierId) {
    created = created.eq('cashier_id', cashierId);
    settled = settled.eq('settled_by', cashierId);
  }
  const [a, b] = await Promise.all([created, settled]);
  // Base sans la migration des crédits : rien à déduire.
  if (a.error || b.error) return { unpaidToday: 0, settledToday: 0 };
  // Encore impayé à la fin de la journée : pas réglé, ou réglé un jour suivant.
  const endTime = Date.parse(end);
  const unpaid = (a.data ?? []).filter((s) => !s.paid_at || Date.parse(s.paid_at) >= endTime);
  return { unpaidToday: due(unpaid), settledToday: due(b.data ?? []) };
}
