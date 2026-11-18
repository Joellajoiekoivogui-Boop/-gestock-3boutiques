import { AlertTriangle, ShoppingCart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { PeriodFilter } from '@/components/app/period-filter';
import { DayPicker, parseDay } from '@/components/app/day-picker';
import { DayLine, FactRow } from '@/components/app/day-line';
import { BarList } from '@/components/charts/bar-list';
import { RevenueTrendChart } from '@/components/charts/revenue-trend-chart';
import { AnimatedCount, AnimatedMoney } from '@/components/motion/animated-number';
import { SalesTable } from '@/components/sales/sales-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSettings, requireAdmin } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { dayRangeUtc, PERIOD_LABELS, resolvePeriod, todayIn } from '@/lib/dates';
import { getDayCredit } from '@/lib/credit-day';
import { getShopScope } from '@/lib/shop';
import { getDashboardSummary, getSalesReport } from '@/lib/reports';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default async function DashboardPage({ searchParams }: PageProps<'/admin/dashboard'>) {
  await requireAdmin();
  const params = await searchParams;
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const currency = settings?.currency ?? 'GNF';
  const money = (v: number) => formatMoney(v, currency);

  const range = resolvePeriod(
    typeof params.period === 'string' ? params.period : 'month',
    typeof params.from === 'string' ? params.from : undefined,
    typeof params.to === 'string' ? params.to : undefined,
    tz,
  );

  // Journée affichée en haut : aujourd'hui, ou une date passée choisie.
  const todayDay = todayIn(tz);
  const day = parseDay(params.jour, todayDay);
  const isToday = day === todayDay;
  const dayRange = dayRangeUtc(day, day, tz);
  const dayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));

  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(new Date());

  const supabase = await createClient();
  const scope = await getShopScope();
  const shopId = scope.current?.id ?? null;
  // Chaque requête suit la boutique choisie en haut de l'écran.
  let latestQuery = supabase.from('sales').select('*');
  // Jour passé : ses ventes à lui, au lieu des dernières.
  if (!isToday) latestQuery = latestQuery.gte('created_at', dayRange.start).lt('created_at', dayRange.end);
  let lowStockQuery = supabase
    .from('products')
    .select('id, name, stock_quantity, minimum_stock')
    .eq('track_stock', true)
    .eq('is_archived', false);
  let creditsQuery = supabase
    .from('sales')
    .select('total_amount, refunded_amount')
    .eq('payment_status', 'pending')
    .neq('sale_status', 'cancelled');
  if (shopId) {
    latestQuery = latestQuery.eq('shop_id', shopId);
    lowStockQuery = lowStockQuery.eq('shop_id', shopId);
    creditsQuery = creditsQuery.eq('shop_id', shopId);
  }
  const [summary, report, latest, lowStock, credits, pastDay] = await Promise.all([
    getDashboardSummary(),
    getSalesReport(range.from, range.to),
    latestQuery.order('created_at', { ascending: false }).limit(8),
    lowStockQuery.order('stock_quantity').limit(50),
    creditsQuery.limit(2000),
    isToday ? Promise.resolve(null) : getSalesReport(day, day),
  ]);

  const creditTotal = (credits.data ?? []).reduce(
    (sum, c) => sum + Number(c.total_amount) - Number(c.refunded_amount),
    0,
  );
  const dayCredit = await getDayCredit(supabase, tz, undefined, shopId, day);
  // Chiffres de la journée affichée (aujourd'hui ou une date passée).
  const dayNet = pastDay ? Number(pastDay.net_revenue) : summary.periods.today.net;
  const dayCount = pastDay ? pastDay.sales_count : summary.periods.today.count;
  // Argent réellement entré ce jour-là : ventes du jour − crédits non payés + crédits d'avant réglés.
  const cashedToday = dayNet - dayCredit.unpaidToday + dayCredit.settledToday;
  const dayWord = isToday ? 'aujourd’hui' : 'ce jour-là';
  const lowStockItems = settings?.stock_enabled
    ? (lowStock.data ?? []).filter((p) => p.stock_quantity <= p.minimum_stock).slice(0, 6)
    : [];
  const periodLabel =
    range.period === 'custom'
      ? `du ${formatDate(range.from)} au ${formatDate(range.to)}`
      : PERIOD_LABELS[range.period].toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description={
          <span className="inline-block first-letter:uppercase">
            {today} ·{' '}
            {scope.current
              ? scope.current.name
              : scope.shops.length > 1
                ? 'toutes les boutiques'
                : 'chiffres en temps réel'}
          </span>
        }
        actions={
          <Button asChild size="lg">
            <Link href="/pos">
              <ShoppingCart aria-hidden /> Ouvrir la caisse
            </Link>
          </Button>
        }
      />

      <section aria-label="Journée" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold first-letter:uppercase">
            {isToday ? 'Aujourd’hui' : dayLabel}
          </h2>
          <DayPicker
            basePath="/admin/dashboard"
            day={day}
            today={todayDay}
            keep={{
              period: typeof params.period === 'string' ? params.period : undefined,
              from: typeof params.from === 'string' ? params.from : undefined,
              to: typeof params.to === 'string' ? params.to : undefined,
            }}
          />
        </div>
        <DayLine
          label={isToday ? 'Encaissé aujourd’hui' : 'Encaissé ce jour-là'}
          value={<AnimatedMoney value={cashedToday} currency={currency} />}
          facts={[
            { label: 'CA net du jour', value: money(dayNet) },
            {
              label: `À crédit ${dayWord}`,
              value: dayCredit.unpaidToday > 0 ? `− ${money(dayCredit.unpaidToday)}` : money(0),
            },
            ...(dayCredit.settledToday > 0
              ? [{ label: `Crédits réglés ${dayWord}`, value: `+ ${money(dayCredit.settledToday)}` }]
              : []),
            { label: `Ventes ${dayWord}`, value: dayCount },
            ...(creditTotal > 0 ? [{ label: 'Reste à encaisser (tous)', value: money(creditTotal) }] : []),
            {
              label: 'Stock faible',
              value: summary.low_stock_products > 0 ? `${summary.low_stock_products} produit(s)` : 'Aucun',
            },
          ]}
        />
      </section>

      <Card>
        <CardContent className="space-y-6">
          <PeriodFilter basePath="/admin/dashboard" period={range.period} from={range.from} to={range.to} />
          <FactRow
            facts={[
              {
                label: `CA net (${periodLabel})`,
                value: <AnimatedMoney value={report.net_revenue} currency={currency} />,
              },
              {
                label: 'Ventes réalisées',
                value: <AnimatedCount value={report.sales_count} />,
                hint: `${report.items_sold} article(s) vendus`,
              },
              { label: 'Panier moyen', value: <AnimatedMoney value={report.average_basket} currency={currency} /> },
              { label: 'Produits actifs', value: <AnimatedCount value={summary.active_products} /> },
            ]}
          />
          {(Number(report.refunds_total) > 0 || report.cancelled_count > 0) && (
            <p className="text-muted-foreground">
              Ventes brutes {money(report.gross_sales)} − remboursements {money(report.refunds_total)} ={' '}
              <strong className="text-foreground">CA net {money(report.net_revenue)}</strong>. {report.cancelled_count}{' '}
              vente(s) annulée(s) ({money(report.cancelled_amount)}) exclue(s).
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Évolution des ventes</CardTitle>
            <CardDescription>CA net par jour, {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {report.sales_count === 0 && Number(report.refunds_total) === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Aucune vente sur cette période.</p>
            ) : (
              <RevenueTrendChart data={report.by_day} currency={currency} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Répartition des paiements</CardTitle>
            <CardDescription>Ventes brutes par mode de paiement</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              emptyLabel="Aucun paiement sur cette période."
              items={report.by_payment_method.map((m) => ({
                key: m.code,
                label: m.label,
                value: Number(m.gross),
                display: money(m.gross),
                detail: `${m.count} vente(s) · ${
                  Number(report.gross_sales) > 0 ? Math.round((Number(m.gross) / Number(report.gross_sales)) * 100) : 0
                } %`,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Produits les plus vendus</CardTitle>
            <CardDescription>Par quantité, {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              emptyLabel="Aucun produit vendu sur cette période."
              items={report.top_products.slice(0, 6).map((p) => ({
                key: p.product_id,
                label: p.name,
                value: Number(p.quantity),
                display: `${p.quantity} vendu(s)`,
                detail: money(p.revenue),
              }))}
            />
          </CardContent>
        </Card>

        <Card className="py-0 xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between pt-5">
            <div>
              <CardTitle className="first-letter:uppercase">
                {isToday ? 'Dernières transactions' : `Ventes du ${dayLabel}`}
              </CardTitle>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={isToday ? '/admin/sales' : `/admin/sales?from=${day}&to=${day}`}>Tout voir</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <SalesTable
              rows={latest.data ?? []}
              currency={currency}
              timeZone={tz}
              detailBase="/admin/sales"
              compact
              shopNames={
                !shopId && scope.shops.length > 1 ? new Map(scope.shops.map((s) => [s.id, s.name])) : undefined
              }
            />
          </CardContent>
        </Card>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-warning-foreground/30">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning-foreground" aria-hidden />
              <CardTitle>Stock faible</CardTitle>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/inventory">Gérer les stocks</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lowStockItems.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground"
                >
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {p.stock_quantity} / min. {p.minimum_stock}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
