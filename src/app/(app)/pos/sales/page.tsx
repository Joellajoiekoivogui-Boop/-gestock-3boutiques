import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { SalesFiltersForm } from '@/components/sales/sales-filters';
import { SalesTable } from '@/components/sales/sales-table';
import { Card, CardContent } from '@/components/ui/card';
import { getSettings, requireUser } from '@/lib/auth';
import { listSales, parseSalesFilters } from '@/lib/sales-query';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mes ventes' };

const PAGE_SIZE = 25;

export default async function MySalesPage({ searchParams }: PageProps<'/pos/sales'>) {
  const session = await requireUser();
  const params = await searchParams;
  const filters = parseSalesFilters(params);
  const page = parsePage(params.page);
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const supabase = await createClient();

  const [{ rows, count }, methods] = await Promise.all([
    listSales(supabase, filters, tz, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, cashierId: session.userId }),
    supabase.from('payment_methods').select('code, label').order('sort_order'),
  ]);

  return (
    <div>
      <PageHeader title="Mes ventes" description="Vos ventes et leurs reçus, à réimprimer si besoin." />
      <Card className="mb-4">
        <CardContent>
          <SalesFiltersForm action="/pos/sales" filters={filters} methods={methods.data ?? []} />
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="px-0 pb-4">
          <SalesTable
            rows={rows}
            currency={settings?.currency ?? 'GNF'}
            timeZone={tz}
            detailBase="/pos/sales"
            showCashier={false}
          />
          <div className="px-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={count} basePath="/pos/sales" params={filters} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
