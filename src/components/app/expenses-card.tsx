'use client';

import { Loader2, Plus, ShoppingBasket, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addExpenseAction, deleteExpenseAction } from '@/app/actions/expenses';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/format';

type Expense = { id: string; label: string; amount: number; created_by_name: string; created_at: string; shop_id?: string };

/**
 * Dépenses de la journée (condiments achetés avec l'argent de la caisse) :
 * saisie rapide, liste et total. Seul l'administrateur supprime.
 */
export function ExpensesCard({
  expenses,
  total,
  currency,
  timeZone,
  canAdd,
  addHint,
  canDelete,
  day,
  shopNames,
}: {
  expenses: Expense[];
  total: number;
  currency: string;
  timeZone: string;
  /** Saisie possible (journée en cours pour le caissier, boutique choisie pour l'admin). */
  canAdd: boolean;
  /** Pourquoi la saisie n'est pas possible. */
  addHint?: string;
  canDelete: boolean;
  /** Jour affiché (l'administrateur peut noter une dépense d'un jour passé). */
  day?: string;
  /** Nom des boutiques, affiché quand la liste mêle les deux. */
  shopNames?: Map<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<{ label?: string; amount?: string }>({});
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const money = (v: number) => formatMoney(v, currency);
  const time = (iso: string) =>
    new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (label.trim().length < 2) next.label = 'Indiquez ce qui a été acheté.';
    const value = Number(amount.replace(/\s/g, ''));
    if (!amount || !Number.isInteger(value) || value <= 0) next.amount = 'Prix en francs, nombre entier.';
    setErrors(next);
    if (next.label || next.amount) return;
    start(async () => {
      const result = await addExpenseAction({ label: label.trim(), amount: value }, day);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Dépense notée : ${label.trim()} (${money(value)}).`);
      setLabel('');
      setAmount('');
      labelRef.current?.focus();
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="expenses-title" className="rounded-xl bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
        <h2 id="expenses-title" className="flex items-center gap-2 font-serif text-xl font-semibold">
          <ShoppingBasket className="size-5 text-gold-strong" aria-hidden /> Dépenses du jour
        </h2>
        <p className="text-sm text-muted-foreground">
          Total : <span className="font-semibold text-foreground tabular-nums">{money(total)}</span>
        </p>
      </div>

      {canAdd ? (
        <form onSubmit={submit} noValidate className="grid gap-3 border-b px-5 py-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <Field label="Ce qui a été acheté" htmlFor="expense-label" error={errors.label}>
            <Input
              ref={labelRef}
              id="expense-label"
              value={label}
              placeholder="Ex. : piment, oignons, cube"
              autoComplete="off"
              aria-invalid={!!errors.label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <Field label={`Prix (${currency})`} htmlFor="expense-amount" error={errors.amount}>
            <Input
              id="expense-amount"
              value={amount}
              inputMode="numeric"
              placeholder="0"
              autoComplete="off"
              aria-invalid={!!errors.amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ''))}
            />
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Ajouter la dépense
          </Button>
        </form>
      ) : (
        addHint && <p className="border-b px-5 py-3 text-sm text-muted-foreground">{addHint}</p>
      )}

      {expenses.length === 0 ? (
        <p className="px-5 py-6 text-center text-muted-foreground">Aucune dépense ce jour-là.</p>
      ) : (
        <ul className="divide-y">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{e.label}</p>
                <p className="text-sm text-muted-foreground">
                  {time(e.created_at)} · {e.created_by_name}
                  {shopNames && e.shop_id ? ` · ${shopNames.get(e.shop_id) ?? ''}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold whitespace-nowrap tabular-nums">− {money(e.amount)}</span>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Supprimer la dépense ${e.label}`}
                    disabled={pending}
                    onClick={() => setDeleting(e)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la dépense « {deleting?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? money(deleting.amount) : ''} sera rendu à l’argent du jour. La suppression reste inscrite au journal
              d’activité.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = deleting;
                setDeleting(null);
                if (!target) return;
                start(async () => {
                  const result = await deleteExpenseAction(target.id);
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success('Dépense supprimée.');
                    router.refresh();
                  }
                });
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
