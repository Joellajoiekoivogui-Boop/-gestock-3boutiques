import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Conservé pour compatibilité ; n'est plus affiché. */
  icon?: LucideIcon;
  tone?: 'default' | 'positive' | 'warning';
}) {
  return (
    <Card className="gap-1.5 px-5 py-4">
      <p className="font-display text-sm font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-[2.25rem] leading-none font-bold tabular-nums">{value}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </Card>
  );
}
