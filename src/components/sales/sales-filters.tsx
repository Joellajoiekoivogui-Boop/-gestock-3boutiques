import { Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { SALE_STATUS_LABELS } from '@/lib/format';
import type { SalesFilters } from '@/lib/sales-query';

// Formulaire GET : les filtres sont dans l'URL (partageables, sans JS).
export function SalesFiltersForm({
  action,
  filters,
  cashiers,
  methods,
}: {
  action: string;
  filters: SalesFilters;
  cashiers?: { id: string; full_name: string }[];
  methods: { code: string; label: string }[];
}) {
  return (
    <form action={action} method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(5,1fr)_auto] lg:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="q">N° de reçu</Label>
        <Input id="q" name="q" defaultValue={filters.q} placeholder="MG-2026-000123" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="from">Du</Label>
        <Input id="from" name="from" type="date" defaultValue={filters.from} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="to">Au</Label>
        <Input id="to" name="to" type="date" defaultValue={filters.to} />
      </div>
      {cashiers ? (
        <div className="grid gap-1.5">
          <Label htmlFor="cashier">Caissier</Label>
          <NativeSelect id="cashier" name="cashier" defaultValue={filters.cashier ?? ''}>
            <option value="">Tous</option>
            {cashiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || 'Sans nom'}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : (
        <div className="hidden lg:block" />
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="method">Paiement</Label>
        <NativeSelect id="method" name="method" defaultValue={filters.method ?? ''}>
          <option value="">Tous</option>
          {methods.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="status">Statut</Label>
        <NativeSelect id="status" name="status" defaultValue={filters.status ?? ''}>
          <option value="">Tous</option>
          {Object.entries(SALE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex gap-2">
        <Button type="submit">
          <Search /> Filtrer
        </Button>
        <Button asChild variant="ghost">
          <Link href={action}>Effacer</Link>
        </Button>
      </div>
    </form>
  );
}
