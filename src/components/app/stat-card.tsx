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
    <Card className="gap-2 px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-md',
              tone === 'positive' && 'bg-accent text-accent-foreground',
              tone === 'warning' && 'bg-warning text-warning-foreground',
              tone === 'default' && 'bg-muted text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
