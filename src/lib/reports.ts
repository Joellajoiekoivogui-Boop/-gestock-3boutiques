import 'server-only';
import type { DashboardSummary, SalesReport } from '@/lib/database.types';
import { getShopScope } from '@/lib/shop';
import { createClient } from '@/lib/supabase/server';

// Boutique des chiffres : celle choisie par l'administrateur (aucune = les deux).
// Pour les autres comptes, la base impose toujours leur propre boutique.
// Le paramètre n'est envoyé que si la base connaît les boutiques.
async function shopArg(): Promise<{ p_shop_id?: string | null }> {
  const scope = await getShopScope();
  return scope.shops.length ? { p_shop_id: scope.canChoose ? (scope.current?.id ?? null) : null } : {};
}

export async function getSalesReport(from: string, to: string): Promise<SalesReport> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_sales_report', { p_from: from, p_to: to, ...(await shopArg()) });
  if (error) throw new Error(error.message);
  return data as unknown as SalesReport;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_dashboard_summary', await shopArg());
  if (error) throw new Error(error.message);
  return data as unknown as DashboardSummary;
}
