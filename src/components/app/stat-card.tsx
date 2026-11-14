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
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-[1.75rem] leading-tight font-bold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </Card>
  );
}
