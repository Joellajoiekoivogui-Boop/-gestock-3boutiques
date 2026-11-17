'use client';

import { Loader2, Pencil, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createCustomerAction, updateCustomerAction } from './actions';

type Customer = { id: string; name: string; phone: string | null; note: string | null };

/** Ouvrir un nouveau dossier client, ou corriger un dossier existant. */
export function CustomerFormButton({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [note, setNote] = useState(customer?.note ?? '');
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const input = { name, phone, note };
      if (customer) {
        const result = await updateCustomerAction(customer.id, input);
        if (!result.ok) return void toast.error(result.error);
        toast.success('Dossier mis à jour.');
        setOpen(false);
        router.refresh();
        return;
      }
      const result = await createCustomerAction(input);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Dossier de ${name.trim()} ouvert.`);
      setOpen(false);
      router.push(`/credits/${result.data.id}`);
    });
  }

  return (
    <>
      {customer ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Pencil aria-hidden /> Modifier le dossier
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus aria-hidden /> Nouveau dossier
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">{customer ? 'Modifier le dossier' : 'Nouveau dossier client'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="customer-name">Nom du client</Label>
              <Input id="customer-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="customer-phone">Téléphone</Label>
              <Input id="customer-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="customer-note">Note (facultatif)</Label>
              <Textarea
                id="customer-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Ex. : chambre 12, employé de la société X…"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending || name.trim().length < 2}>
                {pending && <Loader2 className="animate-spin" aria-hidden />} Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
