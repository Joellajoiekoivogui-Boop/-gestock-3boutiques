import Link from 'next/link';
import { EmptyState } from '@/components/app/empty-state';
import { SaleStatusBadge } from '@/components/app/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SaleRow } from '@/lib/database.types';
import { formatDateTime, formatMoney } from '@/lib/format';

export function SalesTable({
  rows,
  currency,
  timeZone,
  detailBase,
  showCashier = true,
  compact = false,
}: {
  rows: SaleRow[];
  currency: string;
  timeZone: string;
  detailBase: string;
  showCashier?: boolean;
  // Version courte pour le tableau de bord : reçu, date, montant, statut.
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Aucune vente" description="Aucune vente ne correspond à ces critères." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reçu</TableHead>
          <TableHead>Date</TableHead>
          {showCashier && !compact && <TableHead>Caissier</TableHead>}
          {!compact && <TableHead className="text-right">Articles</TableHead>}
          <TableHead className="text-right">Montant</TableHead>
          <TableHead>Paiement</TableHead>
          <TableHead>Statut</TableHead>
          {!compact && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="font-medium whitespace-nowrap">
              <Link href={`${detailBase}/${sale.id}`} className="hover:underline">
                {sale.receipt_number}
              </Link>
            </TableCell>
            <TableCell className="whitespace-nowrap">{formatDateTime(sale.created_at, timeZone)}</TableCell>
            {showCashier && !compact && <TableCell>{sale.cashier_name}</TableCell>}
            {!compact && <TableCell className="text-right tabular-nums">{sale.item_count}</TableCell>}
            <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
              {formatMoney(sale.total_amount, currency)}
            </TableCell>
            <TableCell className="whitespace-nowrap">{sale.payment_method_label}</TableCell>
            <TableCell>
              <SaleStatusBadge status={sale.sale_status} />
            </TableCell>
            {!compact && (
              <TableCell className="text-right whitespace-nowrap">
                <Link href={`${detailBase}/${sale.id}`} className="text-sm font-medium text-primary-strong hover:underline">
                  Détail
                </Link>
                <span className="mx-2 text-border">|</span>
                <Link href={`/receipts/${sale.id}?print=1`} className="text-sm font-medium text-primary-strong hover:underline">
                  Réimprimer
                </Link>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
