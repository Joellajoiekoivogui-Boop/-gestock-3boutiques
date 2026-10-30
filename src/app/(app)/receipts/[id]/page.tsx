import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReceiptToolbar } from '@/components/receipt/receipt-toolbar';
import { ReceiptView } from '@/components/receipt/receipt-view';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { isReceiptFormat } from '@/lib/receipt';
import { getSaleDetails } from '@/lib/sales';

export const metadata: Metadata = { title: 'Reçu' };

export default async function ReceiptPage({ params, searchParams }: PageProps<'/receipts/[id]'>) {
  const session = await requireUser();
  const { id } = await params;
  const query = await searchParams;

  const data = await getSaleDetails(id);
  if (!data) notFound();

  const format = isReceiptFormat(query.format) ? query.format : data.settings.receipt_format;
  const backHref = can(session.profile, 'view_all_sales') ? `/admin/sales/${id}` : `/pos/sales/${id}`;

  return (
    <div className="mx-auto max-w-3xl">
      <ReceiptToolbar data={data} format={format} backHref={backHref} autoPrint={query.print === '1'} />
      <div className="mg-receipt-in overflow-x-auto rounded-xl border bg-white py-4 shadow-xs print:overflow-visible print:border-0 print:py-0 print:shadow-none">
        <ReceiptView data={data} format={format} />
      </div>
      <p className="no-print mt-3 text-center text-xs text-muted-foreground">
        Les montants d’un reçu validé ne sont pas modifiables. Toute correction passe par une annulation ou un
        remboursement tracé.
      </p>
    </div>
  );
}
