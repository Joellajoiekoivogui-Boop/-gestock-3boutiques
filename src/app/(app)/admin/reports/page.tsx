import { Download, FileSpreadsheet } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { PeriodFilter } from '@/components/app/period-filter';
import { DayLine, FactRow } from '@/components/app/day-line';
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
import { getShopScope } from '@/lib/shop';
import { bestDays, weekdayAverages } from '@/lib/report-insights';
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
  const [report, scope] = await Promise.all([getSalesReport(range.from, range.to), getShopScope()]);
  const query = new URLSearchParams({ period: range.period, from: range.from, to: range.to }).toString();
  // Les ventes annulées sont déjà résumées dans leur carte : sans vente valide
  // ni remboursement, il n'y a rien à tracer.
  const empty = report.sales_count === 0 && Number(report.refunds_total) === 0;
  const activeDays = report.by_day.filter((d) => Number(d.count) > 0 || Number(d.refunds) > 0);
  const shops = report.by_shop ?? [];
  const best = bestDays(report);
  const weekdays = weekdayAverages(report);
  const margin = report.margin;
  const marginRate =
    margin && Number(margin.revenue_with_cost) > 0
      ? Math.round((Number(margin.margin) / Number(margin.revenue_with_cost)) * 100)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports"
        description={`${scope.current ? `${scope.current.name} · ` : scope.shops.length > 1 ? 'Toutes les boutiques · ' : ''}Du ${formatDate(range.from)} au ${formatDate(range.to)}`}
        actions={
          <>
            <Button asChild>
              <a href={`/admin/reports/export?${query}&format=xlsx`}>
                <FileSpreadsheet /> Exporter en Excel
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/admin/reports/export?${query}`}>
                <Download /> CSV
              </a>
            </Button>
            <ReportPdfButton report={report} currency={currency} businessName={settings?.name ?? 'MassaGui Fils SARL.U'} />
          </>
        }
      />

      <PeriodFilter basePath="/admin/reports" period={range.period} from={range.from} to={range.to} />

      <DayLine
        label="Chiffre d’affaires net de la période"
        value={<AnimatedMoney value={report.net_revenue} currency={currency} />}
        facts={[
          { label: 'Ventes', value: <AnimatedCount value={report.sales_count} /> },
          { label: 'Panier moyen', value: money(report.average_basket) },
          { label: 'Articles vendus', value: <AnimatedCount value={report.items_sold} /> },
        ]}
      />
      <Card>
        <CardContent>
          <FactRow
            facts={[
              { label: 'Ventes brutes', value: money(report.gross_sales), hint: `Remises accordées : ${money(report.discount_total)}` },
              { label: 'Remboursements', value: money(report.refunds_total), hint: `${report.refunds_count} remboursement(s)` },
              {
                label: 'Ventes annulées (exclues du CA)',
                value: money(report.cancelled_amount),
                hint: `${report.cancelled_count} vente(s) annulée(s)`,
              },
            ]}
          />
        </CardContent>
      </Card>

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

          {shops.length > 1 && (
            <Card className="py-0">
              <CardHeader className="pt-5">
                <CardTitle>Boutiques côte à côte</CardTitle>
                <CardDescription>Même période, chaque boutique avec ses propres ventes</CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Boutique</TableHead>
                      <TableHead className="text-right">Ventes</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Panier moyen</TableHead>
                      <TableHead className="text-right">CA net</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Part</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shops.map((sh) => (
                      <TableRow key={sh.shop_id}>
                        <TableCell className="font-medium">{sh.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{sh.count}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {Number(sh.count) ? money(Math.round(Number(sh.gross) / Number(sh.count))) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(sh.net)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {Number(report.net_revenue) > 0
                            ? `${Math.round((Number(sh.net) / Number(report.net_revenue)) * 100)} %`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {margin && (
            <Card>
              <CardHeader>
                <CardTitle>Marge</CardTitle>
                <CardDescription>
                  Prix de vente − prix d’achat des produits vendus (avant remise globale). Visible seulement par
                  l’administrateur.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FactRow
                  facts={[
                    { label: 'Marge', value: money(margin.margin), hint: marginRate !== null ? `${marginRate} % des ventes concernées` : undefined },
                    { label: 'Ventes concernées', value: money(margin.revenue_with_cost) },
                    { label: 'Coût d’achat', value: money(margin.cost_total) },
                  ]}
                />
                {Number(margin.revenue_without_cost) > 0 && (
                  <p className="rounded-lg bg-warning px-4 py-3 text-sm text-warning-foreground">
                    {money(margin.revenue_without_cost)} de ventes portent sur des produits sans prix d’achat : ils ne
                    sont pas comptés dans la marge. Ajoutez le prix d’achat dans la fiche du produit (Produits →
                    Modifier).
                  </p>
                )}
                {(report.top_margin?.length ?? 0) > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produits qui rapportent le plus</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">Coût</TableHead>
                        <TableHead className="text-right">Marge</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.top_margin!.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{money(p.cost)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{money(p.margin)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {best.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Meilleurs jours</CardTitle>
                  <CardDescription>Les journées de vente au plus fort CA net</CardDescription>
                </CardHeader>
                <CardContent>
                  <BarList
                    emptyLabel="Aucune vente."
                    items={best.map((d) => ({
                      key: d.day,
                      label: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
                        new Date(`${d.day}T12:00:00Z`),
                      ),
                      value: d.net,
                      display: money(d.net),
                      detail: `${d.count} vente(s)`,
                    }))}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Par jour de la semaine</CardTitle>
                  <CardDescription>
                    {weekdays ? 'CA net moyen de chaque jour de la semaine sur la période' : 'Choisissez une période d’au moins une semaine'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {weekdays ? (
                    <BarList
                      emptyLabel="Aucune vente."
                      items={weekdays.map((w) => ({
                        key: w.label,
                        label: w.label,
                        value: w.average,
                        display: money(w.average),
                        detail: `${w.averageCount} vente(s) en moyenne`,
                      }))}
                    />
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      La comparaison des jours de la semaine demande au moins 7 jours.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

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
            Journées de vente de 7h à 7h le lendemain, dans le fuseau {settings?.timezone ?? 'Africa/Conakry'}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
