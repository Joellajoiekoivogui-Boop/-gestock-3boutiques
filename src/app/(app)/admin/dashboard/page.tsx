import { AlertTriangle, CalendarDays, CalendarRange, ShoppingBag, TrendingUp, UtensilsCrossed, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { PeriodFilter } from '@/components/app/period-filter';
import { StatCard } from '@/components/app/stat-card';
import { BarList } from '@/components/charts/bar-list';
import { RevenueTrendChart } from '@/components/charts/revenue-trend-chart';
import { AnimatedCount, AnimatedMoney } from '@/components/motion/animated-number';
import { SalesTable } from '@/components/sales/sales-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSettings, requireAdmin } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { PERIOD_LABELS, resolvePeriod } from '@/lib/dates';
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

  const supabase = await createClient();
  const [summary, report, latest, lowStock] = await Promise.all([
    getDashboardSummary(),
    getSalesReport(range.from, range.to),
    supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(8),
    supabase
      .from('products')
      .select('id, name, stock_quantity, minimum_stock')
      .eq('track_stock', true)
      .eq('is_archived', false)
      .order('stock_quantity')
      .limit(50),
  ]);

  const lowStockItems = settings?.stock_enabled
    ? (lowStock.data ?? []).filter((p) => p.stock_quantity <= p.minimum_stock).slice(0, 6)
    : [];
  const periodLabel =
    range.period === 'custom'
      ? `du ${formatDate(range.from)} au ${formatDate(range.to)}`
      : PERIOD_LABELS[range.period].toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader title="Tableau de bord" description="Chiffres calculés en temps réel à partir des ventes enregistrées." />

      <div className="mg-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="CA net du jour"
          value={<AnimatedMoney value={summary.periods.today.net} currency={currency} />}
          hint={`${summary.periods.today.count} vente(s) aujourd’hui`}
          icon={Wallet}
          tone="positive"
        />
        <StatCard
          label="CA net de la semaine"
          value={<AnimatedMoney value={summary.periods.week.net} currency={currency} />}
          hint={`${summary.periods.week.count} vente(s) depuis lundi`}
          icon={CalendarDays}
        />
        <StatCard
          label="CA net du mois"
          value={<AnimatedMoney value={summary.periods.month.net} currency={currency} />}
          hint={`${summary.periods.month.count} vente(s) ce mois-ci`}
          icon={CalendarRange}
        />
      </div>

      <Card>
        <CardContent className="space-y-5">
          <PeriodFilter basePath="/admin/dashboard" period={range.period} from={range.from} to={range.to} />
          <div className="mg-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={`CA net (${periodLabel})`} value={<AnimatedMoney value={report.net_revenue} currency={currency} />} icon={TrendingUp} tone="positive" />
            <StatCard label="Ventes réalisées" value={<AnimatedCount value={report.sales_count} />} hint={`${report.items_sold} article(s) vendus`} icon={ShoppingBag} />
            <StatCard label="Panier moyen" value={<AnimatedMoney value={report.average_basket} currency={currency} />} icon={Wallet} />
            <StatCard
              label="Produits actifs"
              value={<AnimatedCount value={summary.active_products} />}
              hint={summary.low_stock_products > 0 ? `${summary.low_stock_products} en stock faible` : 'Aucun stock faible'}
              icon={UtensilsCrossed}
              tone={summary.low_stock_products > 0 ? 'warning' : 'default'}
            />
          </div>
          {(Number(report.refunds_total) > 0 || report.cancelled_count > 0) && (
            <p className="text-sm text-muted-foreground">
              Ventes brutes {money(report.gross_sales)} − remboursements {money(report.refunds_total)} ={' '}
              <strong className="text-foreground">CA net {money(report.net_revenue)}</strong>. {report.cancelled_count} vente(s)
              annulée(s) ({money(report.cancelled_amount)}) exclue(s).
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
              <CardTitle>Dernières transactions</CardTitle>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/sales">Tout voir</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <SalesTable rows={latest.data ?? []} currency={currency} timeZone={tz} detailBase="/admin/sales" compact />
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
                <li key={p.id} className="flex items-center justify-between rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
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
