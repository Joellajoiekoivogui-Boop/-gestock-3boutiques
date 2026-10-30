'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { PaymentMethodRow } from '@/lib/database.types';
import { paymentMethodSchema, type PaymentMethodOutput, type PaymentMethodValues } from '@/lib/validation';
import { deletePaymentMethodAction, savePaymentMethodAction } from './actions';

function MethodDialog({ method, onClose }: { method: PaymentMethodRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<PaymentMethodValues, unknown, PaymentMethodOutput>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      code: method?.code ?? '',
      label: method?.label ?? '',
      isActive: method?.is_active ?? true,
      sortOrder: method?.sort_order ?? 100,
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await savePaymentMethodAction(method?.code ?? null, values);
      if (!result.ok) {
        if (result.fieldErrors?.code?.[0]) form.setError('code', { message: result.fieldErrors.code[0] });
        toast.error(result.error);
        return;
      }
      toast.success('Mode de paiement enregistré.');
      onClose();
      router.refresh();
    }),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{method ? 'Modifier le mode de paiement' : 'Nouveau mode de paiement'}</DialogTitle>
          </DialogHeader>
          <Field label="Libellé" htmlFor="pm-label" error={errors.label?.message}>
            <Input id="pm-label" placeholder="Ex. Wave" {...form.register('label')} />
          </Field>
          {!method && (
            <Field label="Code interne" htmlFor="pm-code" hint="Minuscules, chiffres et _ (ex. wave). Non modifiable ensuite." error={errors.code?.message}>
              <Input id="pm-code" {...form.register('code')} />
            </Field>
          )}
          <Field label="Ordre d’affichage" htmlFor="pm-order" error={errors.sortOrder?.message}>
            <Input id="pm-order" type="number" min={0} {...form.register('sortOrder', { valueAsNumber: true })} />
          </Field>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <Label htmlFor="pm-active">Proposé à la caisse</Label>
                <Switch id="pm-active" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
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

export function PaymentMethodsCard({ methods }: { methods: PaymentMethodRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PaymentMethodRow | 'new' | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(code: string) {
    if (!window.confirm('Supprimer ce mode de paiement ?')) return;
    startTransition(async () => {
      const result = await deletePaymentMethodAction(code);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success('Mode de paiement supprimé.');
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Modes de paiement</CardTitle>
          <CardDescription>
            Orange Money, MTN Mobile Money, etc. sont enregistrés comme moyens d’encaissement déclarés par le caissier :
            aucune API d’opérateur n’est connectée.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus /> Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {methods.map((m) => (
            <li key={m.code} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">
                  {m.code} · ordre {m.sort_order}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {m.is_active ? <Badge variant="success">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(m)} aria-label={`Modifier ${m.label}`}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(m.code)}
                  disabled={pending}
                  aria-label={`Supprimer ${m.label}`}
                  className="text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      {editing && <MethodDialog method={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
