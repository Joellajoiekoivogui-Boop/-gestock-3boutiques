import 'server-only';
import type { DashboardSummary, SalesReport } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';

export async function getSalesReport(from: string, to: string): Promise<SalesReport> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_sales_report', { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data as unknown as SalesReport;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_dashboard_summary');
  if (error) throw new Error(error.message);
  return data as unknown as DashboardSummary;
}
