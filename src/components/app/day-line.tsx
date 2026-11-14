import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Bandeau de la journée, vert sapin : le chiffre qui compte en grand, puis
 * les faits qui l'expliquent, côte à côte. Repris du bandeau de la maquette.
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
    <Card
      className={cn(
        'flex-col gap-5 border-transparent bg-forest px-6 py-5 text-forest-foreground sm:flex-row sm:items-end sm:gap-10',
        className,
      )}
    >
      <div className="shrink-0">
        <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">{label}</p>
        <p className="mt-1.5 text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">{value}</p>
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-3 sm:pb-1">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-sm text-forest-foreground/75">{fact.label}</dt>
            <dd className="text-xl leading-tight font-bold tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Ligne de chiffres sans cadre, posée dans une carte. */
export function FactRow({
  facts,
  className,
}: {
  facts: { label: string; value: React.ReactNode; hint?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-12', className)}>
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt className="text-sm text-muted-foreground">{fact.label}</dt>
          <dd className="text-2xl leading-tight font-bold tracking-tight tabular-nums">{fact.value}</dd>
          {fact.hint && <dd className="text-sm text-muted-foreground">{fact.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
