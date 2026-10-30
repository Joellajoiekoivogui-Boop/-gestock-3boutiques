import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { SalesFiltersForm } from '@/components/sales/sales-filters';
import { SalesTable } from '@/components/sales/sales-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSettings, requirePermission } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { listSales, parseSalesFilters } from '@/lib/sales-query';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Historique des ventes' };

const PAGE_SIZE = 25;

export default async function SalesPage({ searchParams }: PageProps<'/admin/sales'>) {
  const session = await requirePermission('view_all_sales');
  const params = await searchParams;
  const filters = parseSalesFilters(params);
  const page = parsePage(params.page);
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const supabase = await createClient();

  const [{ rows, count }, methods, cashiers] = await Promise.all([
    listSales(supabase, filters, tz, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
    supabase.from('payment_methods').select('code, label').order('sort_order'),
    isAdmin(session.profile)
      ? supabase.from('profiles').select('id, full_name').order('full_name')
      : Promise.resolve({ data: null }),
  ]);

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) exportParams.set(k, v);

  return (
    <div>
      <PageHeader
        title="Historique des ventes"
        description="Toutes les ventes enregistrées, avec leurs reçus."
        actions={
          <Button asChild variant="outline">
            <a href={`/admin/sales/export?${exportParams.toString()}`}>
              <Download /> Exporter en CSV
            </a>
          </Button>
        }
      />
      <Card className="mb-4">
        <CardContent>
          <SalesFiltersForm
            action="/admin/sales"
            filters={filters}
            methods={methods.data ?? []}
            cashiers={cashiers.data ?? undefined}
          />
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="px-0 pb-4">
          <SalesTable rows={rows} currency={settings?.currency ?? 'GNF'} timeZone={tz} detailBase="/admin/sales" />
          <div className="px-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={count} basePath="/admin/sales" params={filters} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
