import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERIOD_LABELS, type PeriodKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

// Filtres de période en une ligne : préréglages (liens) + période personnalisée (GET).
export function PeriodFilter({
  basePath,
  period,
  from,
  to,
}: {
  basePath: string;
  period: PeriodKey;
  from: string;
  to: string;
}) {
  const presets: PeriodKey[] = ['today', 'week', 'month'];
  return (
    <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div role="group" aria-label="Période" className="grid w-full grid-cols-3 rounded-lg bg-muted p-1 text-center sm:inline-flex sm:w-fit">
        {presets.map((p) => (
          <Link
            key={p}
            href={`${basePath}?period=${p}`}
            aria-current={period === p ? 'true' : undefined}
            className={cn(
              'rounded-md px-2 py-1.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-3',
              period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {PERIOD_LABELS[p]}
          </Link>
        ))}
      </div>
      <form action={basePath} method="get" className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
        <input type="hidden" name="period" value="custom" />
        <div className="grid gap-1">
          <Label htmlFor="period-from" className="text-xs text-muted-foreground">
            Du
          </Label>
          <Input id="period-from" name="from" type="date" defaultValue={from} required className="w-full sm:w-40" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="period-to" className="text-xs text-muted-foreground">
            Au
          </Label>
          <Input id="period-to" name="to" type="date" defaultValue={to} required className="w-full sm:w-40" />
        </div>
        <Button type="submit" variant={period === 'custom' ? 'default' : 'outline'} className="col-span-2 sm:col-span-1">
          Appliquer
        </Button>
      </form>
    </div>
  );
}
