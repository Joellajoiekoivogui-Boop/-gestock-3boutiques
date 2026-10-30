'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Ban, Loader2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { cancelSaleAction, refundSaleAction } from '@/app/actions/sales';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/format';
import { cancelSaleSchema, refundSaleSchema, type CancelSaleValues, type RefundSaleValues } from '@/lib/validation';

export function CancelSaleButton({ saleId, receiptNumber }: { saleId: string; receiptNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<CancelSaleValues>({ resolver: zodResolver(cancelSaleSchema), defaultValues: { saleId, reason: '' } });

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await cancelSaleAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Vente ${receiptNumber} annulée.`);
      setOpen(false);
      form.reset({ saleId, reason: '' });
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive">
          <Ban /> Annuler la vente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Annuler la vente {receiptNumber}</DialogTitle>
            <DialogDescription>
              La vente sera exclue du chiffre d’affaires et le stock des produits suivis sera réintégré. Cette action est
              définitive et journalisée.
            </DialogDescription>
          </DialogHeader>
          <Field label="Motif de l’annulation" htmlFor="cancel-reason" error={form.formState.errors.reason?.message}>
            <Textarea id="cancel-reason" rows={3} aria-invalid={!!form.formState.errors.reason} {...form.register('reason')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Retour
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Confirmer l’annulation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RefundSaleButton({
  saleId,
  receiptNumber,
  remaining,
  currency,
}: {
  saleId: string;
  receiptNumber: string;
  remaining: number;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<RefundSaleValues>({
    resolver: zodResolver(refundSaleSchema),
    defaultValues: { saleId, amount: remaining, reason: '' },
  });

  const submit = form.handleSubmit((values) => {
    if (values.amount > remaining) {
      form.setError('amount', { message: `Au maximum ${formatMoney(remaining, currency)}.` });
      return;
    }
    startTransition(async () => {
      const result = await refundSaleAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Remboursement enregistré sur ${receiptNumber}.`);
      setOpen(false);
      router.refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Undo2 /> Rembourser
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rembourser la vente {receiptNumber}</DialogTitle>
            <DialogDescription>
              Montant remboursable : {formatMoney(remaining, currency)}. Le remboursement est déduit du chiffre d’affaires
              du jour où il est effectué. Il ne modifie pas le stock (utilisez un ajustement si des produits reviennent).
            </DialogDescription>
          </DialogHeader>
          <Field label={`Montant (${currency})`} htmlFor="refund-amount" error={form.formState.errors.amount?.message}>
            <Input
              id="refund-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={remaining}
              step={1}
              aria-invalid={!!form.formState.errors.amount}
              {...form.register('amount', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Motif du remboursement" htmlFor="refund-reason" error={form.formState.errors.reason?.message}>
            <Textarea id="refund-reason" rows={3} aria-invalid={!!form.formState.errors.reason} {...form.register('reason')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Retour
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Enregistrer le remboursement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
