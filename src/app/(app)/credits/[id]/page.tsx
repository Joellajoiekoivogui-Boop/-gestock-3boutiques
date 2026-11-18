import { ArrowLeft, CheckCircle2, NotebookPen, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DayLine } from '@/components/app/day-line';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { getSettings, requireUser } from '@/lib/auth';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { isAdmin } from '@/lib/permissions';
import { shopNames } from '@/lib/shop';
import { createClient } from '@/lib/supabase/server';
import { idSchema } from '@/lib/validation';
import { CustomerFormButton } from '../customer-form';
import { SettleCreditButton } from '../settle-button';

export const metadata: Metadata = { title: 'Dossier client' };

// Dossier d'un client : ce qu'il doit, puis chacune de ses ventes à crédit
// (à payer, avec « Encaisser », ou réglée, avec la date et le mode).
export default async function CustomerPage({ params }: PageProps<'/credits/[id]'>) {
  const session = await requireUser();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const money = (v: number) => formatMoney(v, settings?.currency ?? 'GNF');
  const supabase = await createClient();

  const names = await shopNames();
  const [customer, sales, methods] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('sales')
      .select('*')
      .eq('customer_id', id)
      .eq('payment_method', 'credit')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('payment_methods').select('code, label').eq('is_active', true).neq('code', 'credit').order('sort_order'),
  ]);
  if (!customer.data) notFound();
  if (sales.error) throw new Error(sales.error.message);

  const client = customer.data;
  const rows = sales.data ?? [];
  const due = (s: (typeof rows)[number]) => Number(s.total_amount) - Number(s.refunded_amount);
  const open = rows.filter((s) => s.payment_status === 'pending' && s.sale_status !== 'cancelled');
  const settled = rows.filter((s) => s.payment_status === 'paid' && s.sale_status !== 'cancelled');
  const owed = open.reduce((sum, s) => sum + due(s), 0);
  const paid = settled.reduce((sum, s) => sum + due(s), 0);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3 text-muted-foreground">
        <Link href="/credits">
          <ArrowLeft aria-hidden /> Tous les clients
        </Link>
      </Button>
      <PageHeader
        title={client.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {client.phone ? (
              <span className="flex items-center gap-1.5 select-all">
                <Phone className="size-4" aria-hidden /> {client.phone}
              </span>
            ) : (
              <span>Pas de téléphone</span>
            )}
            <span>Dossier ouvert le {formatDate(client.created_at.slice(0, 10))}</span>
          </span>
        }
        actions={isAdmin(session.profile) ? <CustomerFormButton customer={client} /> : undefined}
      />
      {client.note && <p className="max-w-2xl rounded-xl bg-card px-5 py-3 text-muted-foreground shadow-card">{client.note}</p>}

      <DayLine
        label={owed > 0 ? 'Doit encore' : 'Tout est réglé'}
        value={money(owed)}
        facts={[
          { label: 'Ventes à payer', value: open.length },
          { label: 'Déjà réglé', value: money(paid) },
          { label: 'Ventes à crédit', value: rows.length },
        ]}
      />

      <section className="rounded-xl bg-card shadow-card">
        <h2 className="border-b px-5 py-4 font-serif text-xl font-bold">Historique des crédits</h2>
        {rows.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Aucune vente à crédit"
            description="À la caisse, choisissez « Crédit » puis ce dossier pour y inscrire une vente."
          />
        ) : (
          <ul className="divide-y">
            {rows.map((sale) => {
              const pending = sale.payment_status === 'pending' && sale.sale_status !== 'cancelled';
              return (
                <li key={sale.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      <Link href={`/receipts/${sale.id}`} className="hover:underline">
                        {sale.receipt_number}
                      </Link>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(sale.created_at, tz)} · {sale.cashier_name}
                      {names.size > 1 && sale.shop_id ? ` · ${names.get(sale.shop_id) ?? ''}` : ''}
                    </p>
                    {sale.sale_status === 'cancelled' ? (
                      <p className="text-sm font-semibold text-destructive-strong">Vente annulée</p>
                    ) : (
                      !pending &&
                      sale.paid_at && (
                        <p className="flex items-center gap-1.5 text-sm text-forest">
                          <CheckCircle2 className="size-4" aria-hidden /> Réglé le {formatDateTime(sale.paid_at, tz)}
                          {sale.settled_payment_label ? ` en ${sale.settled_payment_label}` : ''}
                        </p>
                      )
                    )}
                  </div>
                  <p className="font-bold whitespace-nowrap tabular-nums">{money(due(sale))}</p>
                  {pending && (
                    <SettleCreditButton
                      saleId={sale.id}
                      receiptNumber={sale.receipt_number}
                      customer={client.name}
                      amount={money(due(sale))}
                      methods={methods.data ?? []}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
