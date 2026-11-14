import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * La journée en une ligne : le chiffre qui compte en grand, puis les faits
 * qui l'expliquent, côte à côte. Remplace la rangée de cartes identiques.
 */
export function DayLine({
  label,
  value,
  facts,
  className,
}: {
  label: string;
  value: React.ReactNode;
  facts: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <Card className={cn('flex-col gap-4 px-5 py-4 sm:flex-row sm:items-end sm:gap-8', className)}>
      <div className="shrink-0">
        <p className="font-display text-sm font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 font-display text-[2.75rem] leading-none font-bold tabular-nums">{value}</p>
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3 sm:pb-1">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-sm text-muted-foreground">{fact.label}</dt>
            <dd className="font-display text-2xl leading-tight font-bold tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Variante sans cadre, pour une ligne de chiffres posée dans une carte. */
export function FactRow({ facts, className }: { facts: { label: string; value: React.ReactNode; hint?: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap', className)}>
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt className="text-sm text-muted-foreground">{fact.label}</dt>
          <dd className="font-display text-[1.75rem] leading-tight font-bold tabular-nums">{fact.value}</dd>
          {fact.hint && <dd className="text-sm text-muted-foreground">{fact.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
