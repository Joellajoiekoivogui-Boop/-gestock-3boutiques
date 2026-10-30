import type { ReceiptFormat } from '@/lib/database.types';
import { formatAmount, formatDateTime, formatMoney } from '@/lib/format';
import { RECEIPT_STATUS_LABELS } from '@/lib/receipt';
import type { ReceiptData } from '@/lib/sales';
import { cn } from '@/lib/utils';

const WIDTHS: Record<ReceiptFormat, string> = {
  '80mm': 'w-[80mm] px-[4mm] text-[12px]',
  '58mm': 'w-[58mm] px-[2.5mm] text-[10.5px]',
  a4: 'w-full max-w-[190mm] px-[10mm] text-[13px]',
};

function Rule() {
  return <div className="my-2 border-t border-dashed border-black/60" aria-hidden />;
}

// Reçu imprimable. Toutes les valeurs proviennent de la vente enregistrée
// (noms et prix figés au moment de la vente).
export function ReceiptView({ data, format }: { data: ReceiptData; format: ReceiptFormat }) {
  const { sale, items, settings } = data;
  const thermal = format !== 'a4';
  const money = (v: number) => formatMoney(v, settings.currency);
  const cancelled = sale.sale_status === 'cancelled';

  return (
    <article
      id="receipt"
      aria-label={`Reçu ${sale.receipt_number}`}
      className={cn(
        'print-area relative mx-auto bg-white py-[5mm] leading-snug text-black',
        thermal ? 'font-mono' : 'font-sans',
        WIDTHS[format],
      )}
    >
      {cancelled && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-12 rounded border-4 border-red-600 px-3 py-1 text-3xl font-black tracking-widest text-red-600/70">
            ANNULÉ
          </span>
        </div>
      )}

      <header className="text-center">
        <p className={cn('font-bold uppercase', format === 'a4' ? 'text-xl' : 'text-[1.15em]')}>{settings.name}</p>
        {settings.tagline && <p className="uppercase">{settings.tagline}</p>}
        {settings.address && <p>Adresse : {settings.address}</p>}
        {settings.phone && <p>Téléphone : {settings.phone}</p>}
        {settings.email && <p>{settings.email}</p>}
      </header>

      <Rule />

      <dl className="grid grid-cols-[auto_1fr] gap-x-2">
        <dt>Reçu n° :</dt>
        <dd className="text-right font-bold">{sale.receipt_number}</dd>
        <dt>Date :</dt>
        <dd className="text-right">{formatDateTime(sale.created_at, settings.timezone)}</dd>
        <dt>Caissier :</dt>
        <dd className="text-right">{sale.cashier_name}</dd>
      </dl>

      <Rule />

      {thermal ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <p className="break-words">{item.product_name}</p>
              <p className="flex justify-between gap-2 tabular-nums">
                <span>
                  {item.quantity} x {formatAmount(item.unit_price)}
                </span>
                <span>{formatAmount(item.line_total)}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/60 text-left">
              <th className="py-1 font-semibold">Désignation</th>
              <th className="py-1 text-right font-semibold">Qté</th>
              <th className="py-1 text-right font-semibold">Prix</th>
              <th className="py-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-black/15">
                <td className="py-1 pr-2">{item.product_name}</td>
                <td className="py-1 text-right tabular-nums">{item.quantity}</td>
                <td className="py-1 text-right tabular-nums">{formatAmount(item.unit_price)}</td>
                <td className="py-1 text-right tabular-nums">{money(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Rule />

      <dl className={cn('grid grid-cols-[1fr_auto] gap-x-2 tabular-nums', format === 'a4' && 'ml-auto w-72')}>
        <dt>Sous-total :</dt>
        <dd className="text-right">{money(sale.subtotal)}</dd>
        <dt>Remise :</dt>
        <dd className="text-right">{money(sale.discount_amount)}</dd>
        <dt className="text-[1.2em] font-bold">TOTAL :</dt>
        <dd className="text-right text-[1.2em] font-bold">{money(sale.total_amount)}</dd>
        {Number(sale.refunded_amount) > 0 && (
          <>
            <dt>Remboursé :</dt>
            <dd className="text-right">−{money(sale.refunded_amount)}</dd>
          </>
        )}
      </dl>

      <Rule />

      <dl className="grid grid-cols-[auto_1fr] gap-x-2">
        <dt>Mode de paiement :</dt>
        <dd className="text-right">{sale.payment_method_label}</dd>
        <dt>Statut :</dt>
        <dd className="text-right font-bold">{RECEIPT_STATUS_LABELS[sale.sale_status]}</dd>
      </dl>
      {cancelled && sale.cancel_reason && <p className="mt-1">Motif d’annulation : {sale.cancel_reason}</p>}

      {settings.receipt_footer && (
        <>
          <Rule />
          <p className="text-center font-semibold">{settings.receipt_footer}</p>
        </>
      )}
    </article>
  );
}
