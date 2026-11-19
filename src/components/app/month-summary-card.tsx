import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import type { MonthSummary } from '@/lib/month-summary';
import { cn } from '@/lib/utils';

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`));

/**
 * Bilan du mois, présenté comme une addition : ventes − dépenses et achats −
 * dettes = bénéfice. Chaque ligne reste visible pour que le calcul se vérifie.
 */
export function MonthSummaryCard({
  summary,
  currency,
  previousHref,
  nextHref,
  scopeLabel,
}: {
  summary: MonthSummary;
  currency: string;
  previousHref: string;
  nextHref: string | null;
  scopeLabel: string;
}) {
  const money = (v: number) => formatMoney(v, currency);
  const negative = summary.profit < 0;
  const rows = [
    { label: 'Ventes du mois', hint: `${summary.salesCount} vente(s), remboursements déduits`, value: money(summary.sales), sign: '' },
    { label: 'Dépenses et achats', hint: 'Notés par les caissières et l’administrateur', value: money(summary.expenses), sign: '−' },
    { label: 'Dettes', hint: 'Ventes à crédit du mois pas encore payées', value: money(summary.debts), sign: '−' },
  ];
  return (
    <section aria-labelledby="month-title" className="rounded-xl bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 id="month-title" className="font-serif text-xl font-semibold first-letter:uppercase">
            Bilan de {monthLabel(summary.month)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {scopeLabel} · du {summary.from.split('-').reverse().join('/')} au {summary.to.split('-').reverse().join('/')}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Mois affiché">
          <Button asChild variant="outline" size="icon" className="size-11 rounded-full">
            <Link href={previousHref} aria-label="Mois précédent">
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          {nextHref ? (
            <Button asChild variant="outline" size="icon" className="size-11 rounded-full">
              <Link href={nextHref} aria-label="Mois suivant">
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" className="size-11 rounded-full" disabled aria-label="Mois suivant">
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
      <dl className="divide-y px-5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-3">
            <dt>
              <span className="font-semibold">{r.label}</span>
              <span className="block text-sm text-muted-foreground">{r.hint}</span>
            </dt>
            <dd className="text-lg font-semibold whitespace-nowrap tabular-nums">
              {r.sign && <span className="mr-1 text-muted-foreground">{r.sign}</span>}
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <div
        className={cn(
          'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-b-xl px-5 py-4',
          negative ? 'bg-destructive/10 text-destructive' : 'bg-forest text-forest-foreground',
        )}
      >
        <span className={cn('text-base font-semibold', !negative && 'text-gold-light')}>
          {negative ? 'Perte du mois' : 'Bénéfice du mois'}
        </span>
        <span data-testid="month-profit" className="text-[2rem] leading-none font-bold tracking-tight tabular-nums">
          {money(summary.profit)}
        </span>
      </div>
    </section>
  );
}
