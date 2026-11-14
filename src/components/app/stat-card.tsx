import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'positive' | 'warning';
}) {
  return (
    <Card className="gap-1.5 px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        {Icon && (
          <span
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-md',
              tone === 'positive' && 'bg-accent text-accent-foreground',
              tone === 'warning' && 'bg-warning text-warning-foreground',
              tone === 'default' && 'bg-muted text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="font-display text-[2.25rem] leading-none font-bold tabular-nums">{value}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </Card>
  );
}
