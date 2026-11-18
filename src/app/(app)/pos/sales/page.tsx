import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CollapsibleFilters } from '@/components/app/collapsible-filters';
import { PageHeader } from '@/components/app/page-header';
import { Pagination, parsePage } from '@/components/app/pagination';
import { SalesFiltersForm } from '@/components/sales/sales-filters';
import { DayLine } from '@/components/app/day-line';
import { DayPicker, parseDay } from '@/components/app/day-picker';
import { SalesTable } from '@/components/sales/sales-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSettings, requireUser } from '@/lib/auth';
import { dayRangeUtc, todayIn } from '@/lib/dates';
import { getDayCredit } from '@/lib/credit-day';
import { getDayExpenses } from '@/lib/expenses';
import { ExpensesCard } from '@/components/app/expenses-card';
import { isAdmin } from '@/lib/permissions';
import { getShopScope } from '@/lib/shop';
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
  // Journée résumée en haut : aujourd'hui, ou une date passée choisie.
  const shownDay = parseDay(params.jour, today);
  const isToday = shownDay === today;
  const todayRange = dayRangeUtc(shownDay, shownDay, tz);
  const dayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${shownDay}T12:00:00Z`));

  const admin = isAdmin(session.profile);
  const [{ rows, count }, methods, todaySales, dayCredit, expenses, scope] = await Promise.all([
    listSales(supabase, filters, tz, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, cashierId: session.userId }),
    supabase.from('payment_methods').select('code, label').order('sort_order'),
    // Ma journée : mes ventes du jour affiché (hors ventes annulées), nettes des remboursements.
    supabase
      .from('sales')
      .select('total_amount, refunded_amount, payment_method, payment_status, sale_status, paid_at')
      .eq('cashier_id', session.userId)
      .gte('created_at', todayRange.start)
      .lt('created_at', todayRange.end)
      .neq('sale_status', 'cancelled')
      .limit(2000),
    getDayCredit(supabase, tz, session.userId, null, shownDay),
    // Mes dépenses du jour (condiments achetés avec l'argent de la caisse).
    getDayExpenses(supabase, shownDay, { createdBy: session.userId }),
    getShopScope(),
  ]);

  const day = (todaySales.data ?? []).reduce(
    (acc, sale) => {
      const net = Number(sale.total_amount) - Number(sale.refunded_amount);
      acc.count += 1;
      // Crédit encore impayé à la fin de la journée affichée.
      if (
        sale.payment_method === 'credit' &&
        (!sale.paid_at || Date.parse(sale.paid_at) >= Date.parse(todayRange.end))
      ) {
        acc.credit += net;
        return acc;
      }
      acc.total += net;
      if (sale.payment_method === 'cash') acc.cash += net;
      return acc;
    },
    { count: 0, total: 0, cash: 0, credit: 0 },
  );
  // Argent du jour : encaissé (ventes payées + anciens crédits réglés) − dépenses.
  const cashed = day.total + dayCredit.settledToday - expenses.total;

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
      <section aria-label="Ma journée" className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold first-letter:uppercase">
            {isToday ? 'Aujourd’hui' : dayLabel}
          </h2>
          <DayPicker basePath="/pos/sales" day={shownDay} today={today} />
        </div>
        <DayLine
          label={isToday ? 'Encaissé aujourd’hui' : 'Encaissé ce jour-là'}
          value={formatMoney(cashed, currency)}
          facts={[
            { label: 'Ventes du jour', value: formatMoney(day.total + day.credit, currency) },
            {
              label: 'À crédit (non payé)',
              value: day.credit > 0 ? `− ${formatMoney(day.credit, currency)}` : formatMoney(0, currency),
            },
            ...(dayCredit.settledToday > 0
              ? [
                  {
                    label: isToday ? 'Crédits réglés aujourd’hui' : 'Crédits réglés ce jour-là',
                    value: `+ ${formatMoney(dayCredit.settledToday, currency)}`,
                  },
                ]
              : []),
            ...(expenses.total > 0
              ? [{ label: 'Dépenses', value: `− ${formatMoney(expenses.total, currency)}` }]
              : []),
            { label: 'Nombre de ventes', value: day.count },
            {
              label: 'Panier moyen',
              value: day.count > 0 ? formatMoney(Math.round((day.total + day.credit) / day.count), currency) : '—',
            },
            { label: 'Dont espèces', value: formatMoney(day.cash, currency) },
          ]}
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Ventes du jour − crédits non payés + anciens crédits réglés − dépenses. La journée va de 7h à 7h le lendemain.
          Hors ventes annulées, remboursements déduits.
        </p>
        {expenses.available && (
          <ExpensesCard
            expenses={expenses.rows}
            total={expenses.total}
            currency={currency}
            timeZone={tz}
            canAdd={isToday && (!admin || !!scope.current)}
            addHint={
              !isToday
                ? 'Les dépenses se notent le jour même.'
                : 'Choisissez d’abord la boutique en haut de l’écran pour noter une dépense.'
            }
            canDelete={admin}
            day={shownDay}
          />
        )}
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
          <SalesTable rows={rows} currency={currency} timeZone={tz} detailBase="/pos/sales" showCashier={false} />
          <div className="px-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={count} basePath="/pos/sales" params={filters} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
