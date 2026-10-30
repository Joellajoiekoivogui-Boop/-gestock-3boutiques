import { Ban, Download, ShoppingBag, TrendingUp, Undo2, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { PeriodFilter } from '@/components/app/period-filter';
import { StatCard } from '@/components/app/stat-card';
import { BarList } from '@/components/charts/bar-list';
import { RevenueTrendChart } from '@/components/charts/revenue-trend-chart';
import { AnimatedCount, AnimatedMoney } from '@/components/motion/animated-number';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSettings, requirePermission } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { resolvePeriod } from '@/lib/dates';
import { getSalesReport } from '@/lib/reports';
import { ReportPdfButton } from './report-pdf-button';

export const metadata: Metadata = { title: 'Rapports' };

export default async function ReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  await requirePermission('view_reports');
  const params = await searchParams;
  const settings = await getSettings();
  const currency = settings?.currency ?? 'GNF';
  const money = (v: number) => formatMoney(v, currency);
  const range = resolvePeriod(
    typeof params.period === 'string' ? params.period : 'month',
    typeof params.from === 'string' ? params.from : undefined,
    typeof params.to === 'string' ? params.to : undefined,
    settings?.timezone ?? 'Africa/Conakry',
  );
  const report = await getSalesReport(range.from, range.to);
  const query = new URLSearchParams({ period: range.period, from: range.from, to: range.to }).toString();
  // Les ventes annulées sont déjà résumées dans leur carte : sans vente valide
  // ni remboursement, il n'y a rien à tracer.
  const empty = report.sales_count === 0 && Number(report.refunds_total) === 0;
  const activeDays = report.by_day.filter((d) => Number(d.count) > 0 || Number(d.refunds) > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports"
        description={`Du ${formatDate(range.from)} au ${formatDate(range.to)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/admin/reports/export?${query}`}>
                <Download /> Exporter en CSV
              </a>
            </Button>
            <ReportPdfButton report={report} currency={currency} businessName={settings?.name ?? 'MassaGui Fils SARL.U'} />
          </>
        }
      />

      <PeriodFilter basePath="/admin/reports" period={range.period} from={range.from} to={range.to} />

      <div className="mg-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chiffre d’affaires net" value={<AnimatedMoney value={report.net_revenue} currency={currency} />} icon={TrendingUp} tone="positive" hint="Ventes brutes − remboursements" />
        <StatCard label="Ventes brutes" value={<AnimatedMoney value={report.gross_sales} currency={currency} />} icon={Wallet} hint={`Remises accordées : ${money(report.discount_total)}`} />
        <StatCard label="Nombre de ventes" value={<AnimatedCount value={report.sales_count} />} icon={ShoppingBag} hint={`Panier moyen : ${money(report.average_basket)}`} />
        <StatCard
          label="Remboursements"
          value={<AnimatedMoney value={report.refunds_total} currency={currency} />}
          icon={Undo2}
          hint={`${report.refunds_count} remboursement(s)`}
        />
      </div>
      <div className="mg-stagger grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Ventes annulées (exclues du CA)"
          value={<AnimatedMoney value={report.cancelled_amount} currency={currency} />}
          icon={Ban}
          hint={`${report.cancelled_count} vente(s) annulée(s)`}
        />
        <StatCard label="Articles vendus" value={<AnimatedCount value={report.items_sold} />} icon={ShoppingBag} />
      </div>

      {empty ? (
        <Card>
          <CardContent>
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune vente ni remboursement sur cette période.
              {report.cancelled_count > 0 ? ' Les ventes annulées sont comptées à part ci-dessus.' : ''}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Évolution des ventes</CardTitle>
              <CardDescription>CA net par jour</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueTrendChart data={report.by_day} currency={currency} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Chiffre d’affaires par catégorie</CardTitle>
                <CardDescription>Montant des lignes vendues, avant remise globale</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList
                  emptyLabel="Aucune vente."
                  items={report.by_category.map((c) => ({
                    key: c.name,
                    label: c.name,
                    value: Number(c.revenue),
                    display: money(c.revenue),
                    detail: `${c.quantity} article(s)`,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Modes de paiement</CardTitle>
                <CardDescription>Ventes brutes et remboursements par mode</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList
                  emptyLabel="Aucun paiement."
                  items={report.by_payment_method.map((m) => ({
                    key: m.code,
                    label: m.label,
                    value: Number(m.gross),
                    display: money(m.gross),
                    detail: `${m.count} vente(s)${Number(m.refunds) > 0 ? ` · remboursé ${money(m.refunds)} · net ${money(m.net)}` : ''}`,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="py-0">
              <CardHeader className="pt-5">
                <CardTitle>Produits les plus vendus</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.top_products.map((p) => (
                      <TableRow key={p.product_id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="py-0">
              <CardHeader className="pt-5">
                <CardTitle>Ventes par caissier</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Caissier</TableHead>
                      <TableHead className="text-right">Ventes</TableHead>
                      <TableHead className="text-right">CA net</TableHead>
                      <TableHead className="text-right">Annulations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.by_cashier.map((c) => (
                      <TableRow key={c.cashier_id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(c.net)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.cancelled_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card className="py-0">
            <CardHeader className="pt-5">
              <CardTitle>Détail par jour</CardTitle>
              <CardDescription>Jours avec au moins une vente ou un remboursement</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jour</TableHead>
                    <TableHead className="text-right">Ventes</TableHead>
                    <TableHead className="text-right">Ventes brutes</TableHead>
                    <TableHead className="text-right">Remboursements</TableHead>
                    <TableHead className="text-right">CA net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeDays.map((d) => (
                    <TableRow key={d.day}>
                      <TableCell>{formatDate(d.day)}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(d.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(d.refunds)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{money(d.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Définition des indicateurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Ventes brutes</strong> : total des ventes datées dans la période, remises
            déduites, ventes annulées exclues.
          </p>
          <p>
            <strong className="text-foreground">Remboursements</strong> : remboursements effectués pendant la période
            (quelle que soit la date de la vente d’origine).
          </p>
          <p>
            <strong className="text-foreground">CA net</strong> = ventes brutes − remboursements.{' '}
            <strong className="text-foreground">Panier moyen</strong> = ventes brutes ÷ nombre de ventes non annulées.
          </p>
          <p>
            <strong className="text-foreground">Ventes annulées</strong> : jamais comptées comme revenu ; affichées à part.
            Jours calculés dans le fuseau {settings?.timezone ?? 'Africa/Conakry'}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
