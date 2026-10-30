'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PackagePlus, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { stockMovementSchema, type StockMovementOutput, type StockMovementValues } from '@/lib/validation';
import { recordStockMovementAction } from './actions';

export function StockMovementButton({
  product,
  type,
}: {
  product: { id: string; name: string; stock_quantity: number };
  type: 'restock' | 'adjustment';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<StockMovementValues, unknown, StockMovementOutput>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: { productId: product.id, type, quantity: undefined as unknown as number, reason: '' },
  });
  const { errors } = form.formState;
  const quantity = useWatch({ control: form.control, name: 'quantity' });
  const after = Number.isFinite(quantity) ? product.stock_quantity + Number(quantity) : null;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await recordStockMovementAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Stock de « ${product.name} » : ${result.data.stock}.`);
      setOpen(false);
      form.reset({ productId: product.id, type, quantity: undefined as unknown as number, reason: '' });
      router.refresh();
    }),
  );

  const restock = type === 'restock';
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant={restock ? 'default' : 'outline'} size="sm">
          {restock ? <PackagePlus /> : <SlidersHorizontal />}
          {restock ? 'Approvisionner' : 'Ajuster'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {restock ? 'Approvisionnement' : 'Ajustement'} — {product.name}
            </DialogTitle>
            <DialogDescription>
              Stock actuel : {product.stock_quantity}.{' '}
              {restock
                ? 'Saisissez la quantité reçue.'
                : 'Saisissez une variation : positive (+) pour ajouter, négative (−) pour retirer (casse, perte, inventaire).'}
            </DialogDescription>
          </DialogHeader>
          <Field
            label={restock ? 'Quantité reçue' : 'Variation (+ / −)'}
            htmlFor="mv-quantity"
            error={errors.quantity?.message}
            hint={after !== null ? `Stock après opération : ${after}` : undefined}
          >
            <Input
              id="mv-quantity"
              type="number"
              inputMode="numeric"
              step={1}
              min={restock ? 1 : undefined}
              aria-invalid={!!errors.quantity}
              {...form.register('quantity', { valueAsNumber: true })}
            />
          </Field>
          <Field label={restock ? 'Motif (facultatif)' : 'Motif (obligatoire)'} htmlFor="mv-reason" error={errors.reason?.message}>
            <Textarea
              id="mv-reason"
              rows={2}
              placeholder={restock ? 'Livraison fournisseur…' : 'Casse, inventaire, erreur de saisie…'}
              {...form.register('reason')}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
