import { ChevronRight, NotebookPen, Phone, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoSubmitForm } from '@/components/app/auto-submit-form';
import { DayLine } from '@/components/app/day-line';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSettings, requireUser } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { CustomerFormButton } from './customer-form';

export const metadata: Metadata = { title: 'Clients à crédit' };

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Un dossier par client : ce qu'il doit, combien de ventes à crédit, la
// dernière. Un caissier voit les montants de ses propres ventes uniquement.
export default async function CreditsPage({ searchParams }: PageProps<'/credits'>) {
  const session = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 60) : '';
  const settings = await getSettings();
  const money = (v: number) => formatMoney(v, settings?.currency ?? 'GNF');
  const supabase = await createClient();

  const [customers, sales] = await Promise.all([
    supabase.from('customers').select('id, name, phone, created_at').eq('is_active', true).order('name').limit(2000),
    supabase
      .from('sales')
      .select('customer_id, total_amount, refunded_amount, payment_status, created_at')
      .eq('payment_method', 'credit')
      .neq('sale_status', 'cancelled')
      .not('customer_id', 'is', null)
      .limit(5000),
  ]);

  // Base pas encore mise à jour pour les dossiers clients.
  if (customers.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clients à crédit" />
        <div className="rounded-xl bg-card shadow-card">
          <EmptyState
            icon={NotebookPen}
            title="Mise à jour de la base nécessaire"
            description="Les dossiers clients seront disponibles dès que l’administrateur aura exécuté le script SQL des dossiers clients dans Supabase."
          />
        </div>
      </div>
    );
  }
  if (sales.error) throw new Error(sales.error.message);

  const stats = new Map<string, { owed: number; open: number; count: number; last: string }>();
  for (const sale of sales.data ?? []) {
    if (!sale.customer_id) continue;
    const entry = stats.get(sale.customer_id) ?? { owed: 0, open: 0, count: 0, last: sale.created_at };
    entry.count += 1;
    if (sale.created_at > entry.last) entry.last = sale.created_at;
    if (sale.payment_status === 'pending') {
      entry.owed += Number(sale.total_amount) - Number(sale.refunded_amount);
      entry.open += 1;
    }
    stats.set(sale.customer_id, entry);
  }

  const query = normalize(q);
  const digits = q.replace(/\D/g, '');
  const rows = (customers.data ?? [])
    .filter((c) => !q || normalize(c.name).includes(query) || (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)))
    .map((c) => ({ ...c, ...(stats.get(c.id) ?? { owed: 0, open: 0, count: 0, last: c.created_at }) }))
    .sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name, 'fr'));
  const totalOwed = [...stats.values()].reduce((sum, s) => sum + s.owed, 0);
  const debtors = [...stats.values()].filter((s) => s.owed > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients à crédit"
        description={
          can(session.profile, 'view_all_sales')
            ? 'Un dossier par client : ce qu’il doit et toutes ses ventes à crédit.'
            : 'Un dossier par client ; les montants portent sur vos propres ventes.'
        }
        actions={<CustomerFormButton />}
      />

      <DayLine
        label="Reste à encaisser"
        value={money(totalOwed)}
        facts={[
          { label: 'Clients qui doivent', value: debtors },
          { label: 'Dossiers', value: customers.data?.length ?? 0 },
        ]}
      />

      <AutoSubmitForm method="get" action="/credits" className="relative">
        <Label htmlFor="q" className="sr-only">
          Rechercher un client
        </Label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un client (nom ou téléphone)"
          className="h-12 rounded-full border-transparent bg-card pl-12 shadow-card"
        />
      </AutoSubmitForm>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-card shadow-card">
          <EmptyState
            icon={NotebookPen}
            title={q ? 'Aucun client trouvé' : 'Aucun dossier client'}
            description={
              q
                ? 'Vérifiez le nom ou le numéro, ou ouvrez un nouveau dossier.'
                : 'Un dossier s’ouvre à la première vente à crédit, ou avec « Nouveau dossier ».'
            }
          />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/credits/${c.id}`}
                className="group flex h-full items-center gap-4 rounded-xl bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-full font-serif text-lg font-bold',
                    c.owed > 0 ? 'bg-warning text-warning-foreground' : 'bg-forest-soft text-forest',
                  )}
                >
                  {c.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w.charAt(0).toUpperCase())
                    .join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold">{c.name}</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {c.phone ? (
                      <>
                        <Phone className="size-3.5" aria-hidden /> {c.phone}
                      </>
                    ) : (
                      'Pas de téléphone'
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {c.count} vente{c.count > 1 ? 's' : ''} à crédit · depuis le {formatDate(c.created_at.slice(0, 10))}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {c.owed > 0 ? (
                    <>
                      <span className="block text-sm text-muted-foreground">Doit</span>
                      <span className="block font-bold whitespace-nowrap tabular-nums">{money(c.owed)}</span>
                    </>
                  ) : (
                    <Badge className="border-transparent bg-forest-soft text-forest">À jour</Badge>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
