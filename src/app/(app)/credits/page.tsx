import { NotebookPen, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DayLine } from '@/components/app/day-line';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { getSettings, requireUser } from '@/lib/auth';
import { formatDateTime, formatMoney } from '@/lib/format';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { SettleCreditButton } from './settle-button';

export const metadata: Metadata = { title: 'Crédits à encaisser' };

type CreditSale = {
  id: string;
  receipt_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  refunded_amount: number;
  created_at: string;
  cashier_name: string;
};

// Crédits en cours, regroupés par client. Un caissier ne voit que ses propres
// ventes (règles de la base) ; l'administrateur et qui voit toutes les ventes
// voient tous les crédits.
export default async function CreditsPage() {
  const session = await requireUser();
  const settings = await getSettings();
  const currency = settings?.currency ?? 'GNF';
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const money = (v: number) => formatMoney(v, currency);
  const supabase = await createClient();

  const [credits, methods] = await Promise.all([
    supabase
      .from('sales')
      .select('id, receipt_number, customer_name, customer_phone, total_amount, refunded_amount, created_at, cashier_name')
      .eq('payment_status', 'pending')
      .neq('sale_status', 'cancelled')
      .order('created_at', { ascending: true })
      .limit(500),
    supabase.from('payment_methods').select('code, label').eq('is_active', true).neq('code', 'credit').order('sort_order'),
  ]);
  // Base pas encore mise à jour pour les crédits (colonnes absentes).
  if (credits.error?.code === '42703' || /customer_name/.test(credits.error?.message ?? '')) {
    return (
      <div className="space-y-6">
        <PageHeader title="Crédits à encaisser" />
        <div className="rounded-xl bg-card shadow-card">
          <EmptyState
            icon={NotebookPen}
            title="Mise à jour de la base nécessaire"
            description="Les ventes à crédit seront disponibles dès que l’administrateur aura exécuté le script SQL des crédits dans Supabase."
          />
        </div>
      </div>
    );
  }
  if (credits.error) throw new Error(credits.error.message);

  const rows = (credits.data ?? []) as CreditSale[];
  const due = (s: CreditSale) => Number(s.total_amount) - Number(s.refunded_amount);
  const groups = new Map<string, { name: string; phone: string | null; sales: CreditSale[]; total: number }>();
  for (const sale of rows) {
    const name = sale.customer_name || 'Client sans nom';
    const key = name.trim().toLowerCase();
    const group = groups.get(key) ?? { name, phone: sale.customer_phone, sales: [], total: 0 };
    group.sales.push(sale);
    group.total += due(sale);
    if (!group.phone && sale.customer_phone) group.phone = sale.customer_phone;
    groups.set(key, group);
  }
  const clients = [...groups.values()].sort((a, b) => b.total - a.total);
  const total = clients.reduce((sum, c) => sum + c.total, 0);
  const allSales = can(session.profile, 'view_all_sales');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crédits à encaisser"
        description={allSales ? 'Ventes à crédit pas encore payées, par client.' : 'Vos ventes à crédit pas encore payées, par client.'}
      />

      <DayLine
        label="Reste à encaisser"
        value={money(total)}
        facts={[
          { label: 'Clients', value: clients.length },
          { label: 'Ventes à crédit', value: rows.length },
        ]}
      />

      {clients.length === 0 ? (
        <div className="rounded-xl bg-card shadow-card">
          <EmptyState
            icon={NotebookPen}
            title="Aucun crédit en cours"
            description="À la caisse, choisissez « Crédit » comme mode de paiement pour noter une vente que le client paiera plus tard."
          />
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {clients.map((client) => (
            <li key={client.name}>
              <article className="flex h-full flex-col rounded-xl bg-card shadow-card">
                <header className="flex items-start justify-between gap-4 border-b p-5">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{client.name}</h2>
                    {client.phone ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground select-all">
                        <Phone className="size-4" aria-hidden /> {client.phone}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-muted-foreground">Pas de téléphone noté</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm text-muted-foreground">Doit</p>
                    <p className="text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums">{money(client.total)}</p>
                  </div>
                </header>
                <ul className="divide-y">
                  {client.sales.map((sale) => (
                    <li key={sale.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          <Link href={`/receipts/${sale.id}`} className="hover:underline">
                            {sale.receipt_number}
                          </Link>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(sale.created_at, tz)} · {sale.cashier_name}
                        </p>
                      </div>
                      <p className="font-bold whitespace-nowrap tabular-nums">{money(due(sale))}</p>
                      <SettleCreditButton
                        saleId={sale.id}
                        receiptNumber={sale.receipt_number}
                        customer={client.name}
                        amount={money(due(sale))}
                        methods={methods.data ?? []}
                      />
                    </li>
                  ))}
                </ul>
                {client.sales.length > 1 && (
                  <p className="mt-auto border-t px-5 py-2.5 text-sm text-muted-foreground">
                    <Badge variant="warning">{client.sales.length} ventes</Badge> à encaisser une par une, avec le reçu.
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
