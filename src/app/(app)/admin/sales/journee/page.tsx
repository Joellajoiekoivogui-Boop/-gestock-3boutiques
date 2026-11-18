import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DayPicker, parseDay } from '@/components/app/day-picker';
import { PrintButton } from '@/components/app/print-button';
import { Button } from '@/components/ui/button';
import { getSettings, requireAdmin } from '@/lib/auth';
import { getDayCredit } from '@/lib/credit-day';
import { addDays, dayRangeUtc, DAY_START_HOUR, todayIn } from '@/lib/dates';
import { getDayExpenses } from '@/lib/expenses';
import { formatDateTime, formatMoney, SALE_STATUS_LABELS } from '@/lib/format';
import { getSalesReport } from '@/lib/reports';
import { getShopScope } from '@/lib/shop';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ventes du jour à imprimer' };

const longDay = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );

// Feuille des ventes d'une journée (de 7h à 7h le lendemain), à imprimer ou à
// enregistrer en PDF : résumé, modes de paiement, produits, ventes et dépenses.
// Réservée à l'administrateur ; suit la boutique choisie en haut de l'écran.
export default async function DaySalesPrintPage({ searchParams }: PageProps<'/admin/sales/journee'>) {
  const session = await requireAdmin();
  const params = await searchParams;
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Africa/Conakry';
  const currency = settings?.currency ?? 'GNF';
  const money = (v: number | string) => formatMoney(Number(v), currency);
  const today = todayIn(tz);
  const day = parseDay(params.jour, today);
  const range = dayRangeUtc(day, day, tz);

  const supabase = await createClient();
  const scope = await getShopScope();
  const shopId = scope.current?.id ?? null;
  const shopNames = new Map(scope.shops.map((s) => [s.id, s.name]));
  const showShop = !shopId && scope.shops.length > 1;

  let salesQuery = supabase
    .from('sales')
    .select('*')
    .gte('created_at', range.start)
    .lt('created_at', range.end)
    .order('created_at')
    .limit(5000);
  if (shopId) salesQuery = salesQuery.eq('shop_id', shopId);

  const [sales, report, credit, expenses] = await Promise.all([
    salesQuery,
    getSalesReport(day, day),
    getDayCredit(supabase, tz, undefined, shopId, day),
    getDayExpenses(supabase, day, { shopId }),
  ]);
  if (sales.error) throw new Error(sales.error.message);
  const rows = sales.data ?? [];
  const valid = rows.filter((s) => s.sale_status !== 'cancelled');

  // Produits vendus (ventes non annulées), par paquets pour garder des requêtes courtes.
  const sold = new Map<string, { name: string; quantity: number; amount: number }>();
  const ids = valid.map((s) => s.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('sale_items')
      .select('product_name, quantity, line_total')
      .in('sale_id', ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      const line = sold.get(item.product_name) ?? { name: item.product_name, quantity: 0, amount: 0 };
      line.quantity += Number(item.quantity);
      line.amount += Number(item.line_total);
      sold.set(item.product_name, line);
    }
  }
  const products = [...sold.values()].sort((a, b) => b.quantity - a.quantity || b.amount - a.amount);

  const net = Number(report.net_revenue);
  const cashed = net - credit.unpaidToday + credit.settledToday - expenses.total;
  const printedAt = formatDateTime(new Date().toISOString(), tz);
  const pad = (h: number) => `${String(h).padStart(2, '0')}h`;

  const th = 'border-b border-black/30 px-2 py-1.5 text-left text-xs font-semibold uppercase';
  const td = 'border-b border-black/10 px-2 py-1.5 align-top';
  const num = 'text-right tabular-nums whitespace-nowrap';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href={day === today ? '/admin/dashboard' : `/admin/dashboard?jour=${day}`}>
            <ArrowLeft aria-hidden /> Tableau de bord
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <DayPicker basePath="/admin/sales/journee" day={day} today={today} />
          <PrintButton label="Imprimer les ventes" />
        </div>
      </div>

      <article
        id="day-sheet"
        className="print-area rounded-xl bg-white p-6 text-[14px] text-black shadow-card sm:p-8 print:p-0 print:text-[12px]"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <p className="text-lg font-bold uppercase">{settings?.name ?? 'MassaGui Fils SARL.U'}</p>
            {settings?.tagline && <p className="text-xs uppercase">{settings.tagline}</p>}
            {settings?.address && <p className="text-xs">{settings.address}</p>}
            {settings?.phone && <p className="text-xs">Tél. {settings.phone}</p>}
          </div>
          <div className="text-right">
            <h1 className="font-serif text-2xl font-bold first-letter:uppercase">Ventes du {longDay(day)}</h1>
            <p className="font-semibold">{scope.current?.name ?? (scope.shops.length > 1 ? 'Toutes les boutiques' : '')}</p>
            <p className="text-xs">
              Journée de vente : du {day.split('-').reverse().join('/')} à {pad(DAY_START_HOUR)} au{' '}
              {addDays(day, 1).split('-').reverse().join('/')} à {pad(DAY_START_HOUR)}
            </p>
          </div>
        </header>

        <section aria-label="Résumé" className="mt-4 grid gap-x-8 sm:grid-cols-2 print:grid-cols-2">
          <table className="w-full">
            <tbody>
              <tr>
                <td className={td}>Ventes du jour (CA net)</td>
                <td className={`${td} ${num}`}>{money(net)}</td>
              </tr>
              <tr>
                <td className={td}>À crédit, non payé ce jour-là</td>
                <td className={`${td} ${num}`}>− {money(credit.unpaidToday)}</td>
              </tr>
              <tr>
                <td className={td}>Anciens crédits réglés ce jour-là</td>
                <td className={`${td} ${num}`}>+ {money(credit.settledToday)}</td>
              </tr>
              <tr>
                <td className={td}>Dépenses</td>
                <td className={`${td} ${num}`}>− {money(expenses.total)}</td>
              </tr>
              <tr className="text-base font-bold">
                <td className="px-2 py-2">Encaissé</td>
                <td className={`px-2 py-2 ${num}`} data-testid="sheet-cashed">
                  {money(cashed)}
                </td>
              </tr>
            </tbody>
          </table>
          <table className="w-full">
            <tbody>
              <tr>
                <td className={td}>Nombre de ventes</td>
                <td className={`${td} ${num}`}>{report.sales_count}</td>
              </tr>
              <tr>
                <td className={td}>Articles vendus</td>
                <td className={`${td} ${num}`}>{report.items_sold}</td>
              </tr>
              <tr>
                <td className={td}>Remises accordées</td>
                <td className={`${td} ${num}`}>{money(report.discount_total)}</td>
              </tr>
              <tr>
                <td className={td}>Remboursements</td>
                <td className={`${td} ${num}`}>{money(report.refunds_total)}</td>
              </tr>
              <tr>
                <td className={td}>Ventes annulées (non comptées)</td>
                <td className={`${td} ${num}`}>
                  {report.cancelled_count} · {money(report.cancelled_amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 print:grid-cols-2">
          <section aria-labelledby="pay-title">
            <h2 id="pay-title" className="mb-1 font-bold">
              Par mode de paiement
            </h2>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Mode</th>
                  <th className={`${th} text-right`}>Ventes</th>
                  <th className={`${th} text-right`}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {report.by_payment_method.length === 0 ? (
                  <tr>
                    <td className={td} colSpan={3}>
                      Aucune vente.
                    </td>
                  </tr>
                ) : (
                  report.by_payment_method.map((m) => (
                    <tr key={m.code}>
                      <td className={td}>{m.label}</td>
                      <td className={`${td} ${num}`}>{m.count}</td>
                      <td className={`${td} ${num}`}>{money(m.net)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="exp-title">
            <h2 id="exp-title" className="mb-1 font-bold">
              Dépenses
            </h2>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Achat</th>
                  <th className={th}>Par</th>
                  <th className={`${th} text-right`}>Prix</th>
                </tr>
              </thead>
              <tbody>
                {expenses.rows.length === 0 ? (
                  <tr>
                    <td className={td} colSpan={3}>
                      Aucune dépense.
                    </td>
                  </tr>
                ) : (
                  expenses.rows.map((e) => (
                    <tr key={e.id}>
                      <td className={td}>
                        {e.label}
                        {showShop && <span className="block text-xs">{shopNames.get(e.shop_id) ?? ''}</span>}
                      </td>
                      <td className={td}>{e.created_by_name}</td>
                      <td className={`${td} ${num}`}>{money(e.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>

        <section aria-labelledby="prod-title" className="mt-5">
          <h2 id="prod-title" className="mb-1 font-bold">
            Produits vendus
          </h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Produit</th>
                <th className={`${th} text-right`}>Quantité</th>
                <th className={`${th} text-right`}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td className={td} colSpan={3}>
                    Aucun produit vendu.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.name}>
                    <td className={td}>{p.name}</td>
                    <td className={`${td} ${num}`}>{p.quantity}</td>
                    <td className={`${td} ${num}`}>{money(p.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="list-title" className="mt-5">
          <h2 id="list-title" className="mb-1 font-bold">
            Liste des ventes ({rows.length})
          </h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Date et heure</th>
                <th className={th}>Reçu</th>
                {showShop && <th className={th}>Boutique</th>}
                <th className={th}>Caissier</th>
                <th className={th}>Paiement</th>
                <th className={th}>Statut</th>
                <th className={`${th} text-right`}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className={td} colSpan={showShop ? 7 : 6}>
                    Aucune vente ce jour-là.
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className={s.sale_status === 'cancelled' ? 'line-through opacity-60' : undefined}>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(s.created_at, tz)}</td>
                    <td className={`${td} whitespace-nowrap`}>{s.receipt_number}</td>
                    {showShop && <td className={td}>{shopNames.get(s.shop_id) ?? ''}</td>}
                    <td className={td}>{s.cashier_name}</td>
                    <td className={td}>
                      {s.payment_method_label}
                      {s.customer_name && <span className="block text-xs">{s.customer_name}</span>}
                    </td>
                    <td className={td}>
                      {s.payment_status === 'pending' && s.sale_status !== 'cancelled'
                        ? 'À crédit'
                        : SALE_STATUS_LABELS[s.sale_status]}
                    </td>
                    <td className={`${td} ${num}`}>{money(Number(s.total_amount) - Number(s.refunded_amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <p>
            Caissier(s) : <span className="inline-block w-40 border-b border-black" />
          </p>
          <p>
            Administrateur : <span className="inline-block w-40 border-b border-black" />
          </p>
          <p className="col-span-2 text-xs">
            Imprimé le {printedAt} par {session.profile.full_name || session.profile.email}. Ventes annulées barrées et non
            comptées.
          </p>
        </footer>
      </article>
    </div>
  );
}
