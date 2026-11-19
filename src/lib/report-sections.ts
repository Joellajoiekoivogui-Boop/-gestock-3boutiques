import type { SalesReport } from '@/lib/database.types';
import { formatDate } from '@/lib/format';
import { bestDays, weekdayAverages } from '@/lib/report-insights';

export type ReportSection = {
  title: string;
  /** Nom court de l'onglet Excel. */
  sheet: string;
  headers: string[];
  rows: (string | number)[][];
};

// Mise en forme commune des rapports pour l'export CSV et PDF.
export function reportSections(report: SalesReport, currency: string): ReportSection[] {
  const n = (v: number) => Number(v);
  const sections: ReportSection[] = [
    {
      title: `Synthèse du ${formatDate(report.from)} au ${formatDate(report.to)} (${currency})`,
      sheet: 'Synthèse',
      headers: ['Indicateur', 'Valeur'],
      rows: [
        ['Ventes brutes (hors annulations)', n(report.gross_sales)],
        ['Remboursements de la période', n(report.refunds_total)],
        ['Chiffre d’affaires net', n(report.net_revenue)],
        ['Nombre de ventes', n(report.sales_count)],
        ['Panier moyen', n(report.average_basket)],
        ['Articles vendus', n(report.items_sold)],
        ['Remises accordées', n(report.discount_total)],
        ['Ventes annulées (nombre)', n(report.cancelled_count)],
        ['Ventes annulées (montant)', n(report.cancelled_amount)],
      ],
    },
    {
      title: 'Ventes par jour',
      sheet: 'Par jour',
      headers: ['Jour', 'Ventes brutes', 'Remboursements', 'CA net', 'Nombre de ventes'],
      rows: report.by_day.map((d) => [formatDate(d.day), n(d.gross), n(d.refunds), n(d.net), n(d.count)]),
    },
    {
      title: 'Chiffre d’affaires par catégorie (montants des lignes, avant remise)',
      sheet: 'Catégories',
      headers: ['Catégorie', 'Quantité', 'Montant'],
      rows: report.by_category.map((c) => [c.name, n(c.quantity), n(c.revenue)]),
    },
    {
      title: 'Produits les plus vendus',
      sheet: 'Produits',
      headers: ['Produit', 'Quantité', 'Montant'],
      rows: report.top_products.map((p) => [p.name, n(p.quantity), n(p.revenue)]),
    },
    {
      title: 'Ventes par caissier',
      sheet: 'Caissiers',
      headers: ['Caissier', 'Ventes', 'Ventes brutes', 'Remboursements', 'CA net', 'Annulations'],
      rows: report.by_cashier.map((c) => [c.name, n(c.count), n(c.gross), n(c.refunds), n(c.net), n(c.cancelled_count)]),
    },
    {
      title: 'Modes de paiement',
      sheet: 'Paiements',
      headers: ['Mode', 'Ventes', 'Ventes brutes', 'Remboursements', 'Net'],
      rows: report.by_payment_method.map((m) => [m.label, n(m.count), n(m.gross), n(m.refunds), n(m.net)]),
    },
  ];

  if ((report.by_shop?.length ?? 0) > 1) {
    sections.splice(1, 0, {
      title: 'Boutiques côte à côte',
      sheet: 'Boutiques',
      headers: ['Boutique', 'Ventes', 'Ventes brutes', 'Remboursements', 'CA net', 'Panier moyen'],
      rows: report.by_shop!.map((s) => [
        s.name,
        n(s.count),
        n(s.gross),
        n(s.refunds),
        n(s.net),
        n(s.count) ? Math.round(n(s.gross) / n(s.count)) : 0,
      ]),
    });
  }
  if (report.margin) {
    const m = report.margin;
    sections.push({
      title: 'Marge (prix de vente − prix d’achat, avant remise globale)',
      sheet: 'Marge',
      headers: ['Indicateur', 'Valeur'],
      rows: [
        ['Ventes des produits au prix d’achat connu', n(m.revenue_with_cost)],
        ['Coût d’achat de ces produits', n(m.cost_total)],
        ['Marge', n(m.margin)],
        ['Taux de marge (%)', n(m.revenue_with_cost) ? Math.round((n(m.margin) / n(m.revenue_with_cost)) * 100) : 0],
        ['Ventes sans prix d’achat (non comptées)', n(m.revenue_without_cost)],
      ],
    });
    if (report.top_margin?.length) {
      sections.push({
        title: 'Produits qui rapportent le plus',
        sheet: 'Marge par produit',
        headers: ['Produit', 'Quantité', 'Ventes', 'Coût', 'Marge'],
        rows: report.top_margin.map((p) => [p.name, n(p.quantity), n(p.revenue), n(p.cost), n(p.margin)]),
      });
    }
  }
  const best = bestDays(report);
  if (best.length) {
    sections.push({
      title: 'Meilleurs jours',
      sheet: 'Meilleurs jours',
      headers: ['Jour', 'CA net', 'Nombre de ventes'],
      rows: best.map((d) => [formatDate(d.day), d.net, d.count]),
    });
  }
  const weekdays = weekdayAverages(report);
  if (weekdays) {
    sections.push({
      title: 'Moyenne par jour de la semaine',
      sheet: 'Jours de la semaine',
      headers: ['Jour', 'CA net moyen', 'Ventes en moyenne'],
      rows: weekdays.map((w) => [w.label, w.average, w.averageCount]),
    });
  }
  return sections;
}
