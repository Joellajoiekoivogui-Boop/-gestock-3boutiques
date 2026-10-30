import type { SalesReport } from '@/lib/database.types';
import { formatDate } from '@/lib/format';

export type ReportSection = { title: string; headers: string[]; rows: (string | number)[][] };

// Mise en forme commune des rapports pour l'export CSV et PDF.
export function reportSections(report: SalesReport, currency: string): ReportSection[] {
  const n = (v: number) => Number(v);
  return [
    {
      title: `Synthèse du ${formatDate(report.from)} au ${formatDate(report.to)} (${currency})`,
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
      headers: ['Jour', 'Ventes brutes', 'Remboursements', 'CA net', 'Nombre de ventes'],
      rows: report.by_day.map((d) => [formatDate(d.day), n(d.gross), n(d.refunds), n(d.net), n(d.count)]),
    },
    {
      title: 'Chiffre d’affaires par catégorie (montants des lignes, avant remise)',
      headers: ['Catégorie', 'Quantité', 'Montant'],
      rows: report.by_category.map((c) => [c.name, n(c.quantity), n(c.revenue)]),
    },
    {
      title: 'Produits les plus vendus',
      headers: ['Produit', 'Quantité', 'Montant'],
      rows: report.top_products.map((p) => [p.name, n(p.quantity), n(p.revenue)]),
    },
    {
      title: 'Ventes par caissier',
      headers: ['Caissier', 'Ventes', 'Ventes brutes', 'Remboursements', 'CA net', 'Annulations'],
      rows: report.by_cashier.map((c) => [c.name, n(c.count), n(c.gross), n(c.refunds), n(c.net), n(c.cancelled_count)]),
    },
    {
      title: 'Modes de paiement',
      headers: ['Mode', 'Ventes', 'Ventes brutes', 'Remboursements', 'Net'],
      rows: report.by_payment_method.map((m) => [m.label, n(m.count), n(m.gross), n(m.refunds), n(m.net)]),
    },
  ];
}
