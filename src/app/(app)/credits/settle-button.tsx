'use client';

import { HandCoins, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { settleCreditAction } from './actions';

export function SettleCreditButton({
  saleId,
  receiptNumber,
  customer,
  amount,
  methods,
}: {
  saleId: string;
  receiptNumber: string;
  customer: string;
  amount: string;
  methods: { code: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(methods[0]?.code ?? '');
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await settleCreditAction({ saleId, paymentMethod: method });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Crédit de ${customer} encaissé.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <HandCoins aria-hidden /> Encaisser
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Encaisser le crédit</DialogTitle>
            <DialogDescription className="text-base">
              {customer} · reçu {receiptNumber}
            </DialogDescription>
          </DialogHeader>
          <p className="text-center text-4xl font-bold tracking-tight">{amount}</p>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Le client paie en</legend>
            <div className="grid grid-cols-2 gap-2">
              {methods.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => setMethod(m.code)}
                  aria-pressed={method === m.code}
                  className={cn(
                    'min-h-12 rounded-xl border px-3 text-[15px] font-semibold transition-colors',
                    method === m.code ? 'border-forest bg-forest text-forest-foreground' : 'bg-card hover:border-forest/50',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Retour
            </Button>
            <Button size="lg" onClick={confirm} disabled={pending || !method}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
