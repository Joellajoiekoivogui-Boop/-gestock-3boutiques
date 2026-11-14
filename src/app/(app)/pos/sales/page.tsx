import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CollapsibleFilters } from '@/components/app/collapsible-filters';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { SalesFiltersForm } from '@/components/sales/sales-filters';
import { DayLine } from '@/components/app/day-line';
import { SalesTable } from '@/components/sales/sales-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSettings, requireUser } from '@/lib/auth';
import { dayRangeUtc, todayIn } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
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
  const currency = settings?.currency ?? 'GNF';
  const supabase = await createClient();
  const today = todayIn(tz);
  const todayRange = dayRangeUtc(today, today, tz);

  const [{ rows, count }, methods, todaySales] = await Promise.all([
    listSales(supabase, filters, tz, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, cashierId: session.userId }),
    supabase.from('payment_methods').select('code, label').order('sort_order'),
    // Ma journée : mes ventes d'aujourd'hui (hors ventes annulées), nettes des remboursements.
    supabase
      .from('sales')
      .select('total_amount, refunded_amount, payment_method, sale_status')
      .eq('cashier_id', session.userId)
      .gte('created_at', todayRange.start)
      .lt('created_at', todayRange.end)
      .neq('sale_status', 'cancelled')
      .limit(2000),
  ]);

  const day = (todaySales.data ?? []).reduce(
    (acc, sale) => {
      const net = Number(sale.total_amount) - Number(sale.refunded_amount);
      acc.count += 1;
      acc.total += net;
      if (sale.payment_method === 'cash') acc.cash += net;
      return acc;
    },
    { count: 0, total: 0, cash: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Mes ventes"
        description="Vos ventes et leurs reçus, à réimprimer si besoin."
        actions={
          <Button asChild size="lg">
            <Link href="/pos">
              <Plus aria-hidden /> Nouvelle vente
            </Link>
          </Button>
        }
      />
      <section aria-label="Ma journée" className="mb-4">
        <DayLine
          label="Encaissé aujourd’hui"
          value={formatMoney(day.total, currency)}
          facts={[
            { label: 'Ventes', value: day.count },
            { label: 'Panier moyen', value: day.count > 0 ? formatMoney(Math.round(day.total / day.count), currency) : '—' },
            { label: 'Dont espèces', value: formatMoney(day.cash, currency) },
          ]}
        />
        <p className="mt-2 text-sm text-muted-foreground">Hors ventes annulées, remboursements déduits.</p>
      </section>
      <Card className="mb-4">
        <CardContent>
          <CollapsibleFilters activeCount={Object.values(filters).filter(Boolean).length}>
            <SalesFiltersForm action="/pos/sales" filters={filters} methods={methods.data ?? []} />
          </CollapsibleFilters>
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="px-0 pb-4">
          <SalesTable
            rows={rows}
            currency={currency}
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
