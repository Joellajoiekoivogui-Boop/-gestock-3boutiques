import 'server-only';
import { addDays, dayRangeUtc, todayIn } from '@/lib/dates';
import { shiftMonth } from '@/lib/months';

export { parseMonth, shiftMonth } from '@/lib/months';
import { getSalesReport } from '@/lib/reports';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

export type MonthSummary = {
  month: string; // AAAA-MM
  from: string;
  to: string;
  /** Ventes du mois (CA net : ventes − remboursements, annulations exclues). */
  sales: number;
  salesCount: number;
  /** Dépenses et achats payés avec l'argent de la caisse. */
  expenses: number;
  /** Dettes : ventes à crédit du mois que les clients n'ont pas encore payées. */
  debts: number;
  /** Bénéfice du mois = ventes − dépenses et achats − dettes. */
  profit: number;
};

/**
 * Bilan d'un mois (journées de vente de 7h à 7h), pour une boutique ou les
 * deux (shopId null). Le mois en cours s'arrête à aujourd'hui.
 */
export async function getMonthSummary(
  supabase: Client,
  timeZone: string,
  month: string,
  shopId: string | null,
): Promise<MonthSummary> {
  const today = todayIn(timeZone);
  const from = `${month}-01`;
  const lastDay = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const to = lastDay < today ? lastDay : today;
  const range = dayRangeUtc(from, to, timeZone);

  let expensesQuery = supabase
    .from('expenses')
    .select('amount')
    .gte('business_date', from)
    .lte('business_date', to)
    .limit(10000);
  let debtsQuery = supabase
    .from('sales')
    .select('total_amount, refunded_amount')
    .eq('payment_method', 'credit')
    .eq('payment_status', 'pending')
    .neq('sale_status', 'cancelled')
    .gte('created_at', range.start)
    .lt('created_at', range.end)
    .limit(10000);
  if (shopId) {
    expensesQuery = expensesQuery.eq('shop_id', shopId);
    debtsQuery = debtsQuery.eq('shop_id', shopId);
  }

  const [report, expenses, debts] = await Promise.all([getSalesReport(from, to), expensesQuery, debtsQuery]);
  const sales = Number(report.net_revenue);
  // Base sans les dépenses ou les crédits : rien à déduire.
  const expensesTotal = expenses.error ? 0 : (expenses.data ?? []).reduce((t, e) => t + Number(e.amount), 0);
  const debtsTotal = debts.error
    ? 0
    : (debts.data ?? []).reduce((t, s) => t + Number(s.total_amount) - Number(s.refunded_amount), 0);
  return {
    month,
    from,
    to,
    sales,
    salesCount: report.sales_count,
    expenses: expensesTotal,
    debts: debtsTotal,
    profit: sales - expensesTotal - debtsTotal,
  };
}
