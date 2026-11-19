import Link from 'next/link';
import { EmptyState } from '@/components/app/empty-state';
import { SaleStatusBadge } from '@/components/app/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SaleRow } from '@/lib/database.types';
import { cn } from '@/lib/utils';
import { formatDateTime, formatMoney } from '@/lib/format';

export function SalesTable({
  rows,
  currency,
  timeZone,
  detailBase,
  showCashier = true,
  compact = false,
  shopNames,
}: {
  rows: SaleRow[];
  currency: string;
  timeZone: string;
  detailBase: string;
  showCashier?: boolean;
  // Version courte pour le tableau de bord : reçu, date, montant, statut.
  compact?: boolean;
  /** Nom des boutiques : affiché sous le numéro de reçu (vue « toutes les boutiques »). */
  shopNames?: Map<string, string>;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Aucune vente" description="Aucune vente ne correspond à ces critères." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reçu</TableHead>
          <TableHead className="hidden sm:table-cell">Date</TableHead>
          {showCashier && !compact && <TableHead className="hidden lg:table-cell">Caissier</TableHead>}
          {!compact && <TableHead className="hidden text-right md:table-cell">Articles</TableHead>}
          <TableHead className="text-right">Montant</TableHead>
          <TableHead className={compact ? 'hidden sm:table-cell' : 'hidden md:table-cell'}>Paiement</TableHead>
          <TableHead className="hidden sm:table-cell">Statut</TableHead>
          {!compact && <TableHead className="hidden text-right sm:table-cell">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="font-medium whitespace-nowrap">
              <Link href={`${detailBase}/${sale.id}`} className="hover:underline">
                {sale.receipt_number}
              </Link>
              {shopNames && <p className="text-xs font-semibold text-gold-strong">{shopNames.get(sale.shop_id) ?? ''}</p>}
              <p className="text-xs font-normal text-muted-foreground sm:hidden">
                {formatDateTime(sale.created_at, timeZone)}
              </p>
            </TableCell>
            <TableCell className="hidden whitespace-nowrap sm:table-cell">{formatDateTime(sale.created_at, timeZone)}</TableCell>
            {showCashier && !compact && <TableCell className="hidden lg:table-cell">{sale.cashier_name}</TableCell>}
            {!compact && <TableCell className="hidden text-right tabular-nums md:table-cell">{sale.item_count}</TableCell>}
            <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
              {formatMoney(sale.total_amount, currency)}
              {/* Téléphone : le statut passe sous le montant (la colonne Statut ne tiendrait pas). */}
              <span className="mt-1 block sm:hidden">
                <SaleStatusBadge status={sale.sale_status} unpaid={sale.payment_status === 'pending'} />
              </span>
            </TableCell>
            <TableCell className={cn('hidden whitespace-nowrap', compact ? 'sm:table-cell' : 'md:table-cell')}>{sale.payment_method_label}</TableCell>
            <TableCell className="hidden sm:table-cell">
              <SaleStatusBadge status={sale.sale_status} unpaid={sale.payment_status === 'pending'} />
            </TableCell>
            {!compact && (
              <TableCell className="hidden text-right whitespace-nowrap sm:table-cell">
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
