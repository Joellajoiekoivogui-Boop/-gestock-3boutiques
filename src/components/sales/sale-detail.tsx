import { Printer } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { SaleStatusBadge } from '@/components/app/status-badge';
import { CancelSaleButton, RefundSaleButton } from '@/components/sales/sale-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProfileRow } from '@/lib/database.types';
import { formatAmount, formatDateTime, formatMoney } from '@/lib/format';
import { can } from '@/lib/permissions';
import type { ReceiptData } from '@/lib/sales';

export function SaleDetail({
  data,
  profile,
  backHref,
}: {
  data: ReceiptData;
  profile: Pick<ProfileRow, 'role' | 'permissions' | 'is_active'>;
  backHref: string;
}) {
  const { sale, items, refunds, settings } = data;
  const money = (v: number) => formatMoney(v, settings.currency);
  const remaining = Number(sale.total_amount) - Number(sale.refunded_amount);
  const canCancel = can(profile, 'cancel_sales') && sale.sale_status === 'completed';
  const canRefund =
    can(profile, 'refund_sales') && (sale.sale_status === 'completed' || sale.sale_status === 'partially_refunded') && remaining > 0;

  return (
    <div>
      <PageHeader
        title={`Vente ${sale.receipt_number}`}
        description={formatDateTime(sale.created_at, settings.timezone)}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={backHref}>Retour à la liste</Link>
            </Button>
            {canRefund && (
              <RefundSaleButton saleId={sale.id} receiptNumber={sale.receipt_number} remaining={remaining} currency={settings.currency} />
            )}
            {canCancel && <CancelSaleButton saleId={sale.id} receiptNumber={sale.receipt_number} />}
            <Button asChild>
              <Link href={`/receipts/${sale.id}`}>
                <Printer /> Reçu
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="py-0">
          <CardHeader className="pt-5">
            <CardTitle>Articles</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.product_name}</p>
                      {item.category_name && <p className="text-xs text-muted-foreground">{item.category_name}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Statut</dt>
                <dd className="text-right">
                  <SaleStatusBadge status={sale.sale_status} />
                </dd>
                <dt className="text-muted-foreground">Caissier</dt>
                <dd className="text-right">{sale.cashier_name}</dd>
                <dt className="text-muted-foreground">Paiement</dt>
                <dd className="text-right">{sale.payment_method_label}</dd>
                <dt className="text-muted-foreground">Articles</dt>
                <dd className="text-right tabular-nums">{sale.item_count}</dd>
                <dt className="text-muted-foreground">Sous-total</dt>
                <dd className="text-right tabular-nums">{money(sale.subtotal)}</dd>
                <dt className="text-muted-foreground">Remise</dt>
                <dd className="text-right tabular-nums">{money(sale.discount_amount)}</dd>
                <dt className="font-semibold">Total</dt>
                <dd className="text-right text-lg font-bold tabular-nums">{money(sale.total_amount)}</dd>
                {Number(sale.refunded_amount) > 0 && (
                  <>
                    <dt className="text-muted-foreground">Remboursé</dt>
                    <dd className="text-right tabular-nums text-destructive">−{money(sale.refunded_amount)}</dd>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          {sale.sale_status === 'cancelled' && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive">Vente annulée</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {sale.cancelled_at && <p>Le {formatDateTime(sale.cancelled_at, settings.timezone)}</p>}
                <p>Motif : {sale.cancel_reason}</p>
              </CardContent>
            </Card>
          )}

          {refunds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Remboursements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {refunds.map((r) => (
                    <li key={r.id} className="border-b pb-2 last:border-0 last:pb-0">
                      <p className="flex justify-between font-medium">
                        <span>{formatDateTime(r.created_at, settings.timezone)}</span>
                        <span className="tabular-nums">−{money(r.amount)}</span>
                      </p>
                      <p className="text-muted-foreground">{r.reason}</p>
                      {r.user_name && <p className="text-xs text-muted-foreground">Par {r.user_name}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
