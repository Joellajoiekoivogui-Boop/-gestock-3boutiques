import { cn } from '@/lib/utils';

export type BarListItem = { key: string; label: string; value: number; display: string; detail?: string };

// Répartition en barres horizontales étiquetées (libellé + valeur en texte,
// barre en couleur de série) : lisible sans légende, utilisable comme tableau.
export function BarList({ items, className, emptyLabel }: { items: BarListItem[]; className?: string; emptyLabel: string }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (items.length === 0 || max <= 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => (
        <li key={item.key} title={`${item.label} : ${item.display}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{item.display}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted" aria-hidden>
            <div
              className="h-2 rounded-full bg-primary-strong"
              style={{ width: `${Math.max(2, (Math.max(0, item.value) / max) * 100)}%` }}
            />
          </div>
          {item.detail && <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>}
        </li>
      ))}
    </ul>
  );
}
