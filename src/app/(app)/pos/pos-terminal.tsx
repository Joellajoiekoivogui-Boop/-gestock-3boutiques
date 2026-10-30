'use client';

import { Check, CheckCircle2, Loader2, Minus, PackageX, Plus, Printer, Receipt, Search, ShoppingCart, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/app/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { addToCart, cartTotals, removeFromCart, setQuantity, type CartLine } from '@/lib/cart';
import type { CreateSaleResult } from '@/lib/database.types';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createSaleAction } from './actions';

export type PosProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  categoryId: string | null;
  // null = stock non suivi
  maxQuantity: number | null;
};

type Props = {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  paymentMethods: { code: string; label: string }[];
  currency: string;
  showImages: boolean;
  canDiscount: boolean;
};

const newKey = () => crypto.randomUUID();

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function PosTerminal({ products, categories, paymentMethods, currency, showImages, canDiscount }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]?.code ?? '');
  const [discountInput, setDiscountInput] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [success, setSuccess] = useState<CreateSaleResult | null>(null);
  const [pending, startTransition] = useTransition();
  // Clé d'idempotence : identique tant que le panier ne change pas, pour qu'un
  // nouvel essai après une coupure réseau ne crée jamais de seconde vente.
  const keyRef = useRef<string>('');
  const searchRef = useRef<HTMLInputElement>(null);

  const money = (value: number) => formatMoney(value, currency);
  const discount = canDiscount ? Number(discountInput || 0) : 0;
  const totals = cartTotals(lines, discount);
  const discountInvalid = canDiscount && (!Number.isInteger(discount) || discount < 0 || discount > totals.subtotal);

  // Toute modification du panier invalide la clé précédente.
  useEffect(() => {
    keyRef.current = newKey();
  }, [lines, paymentMethod, discountInput]);

  // Le tiroir du panier n'existe qu'en dessous de 1024 px : on le ferme si
  // l'écran s'agrandit (rotation d'une tablette), sinon il resterait ouvert
  // derrière la colonne du panier et bloquerait la page.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onChange = () => desktop.matches && setCartOpen(false);
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  // Raccourci « / » pour la recherche.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === '/' && target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleProducts = useMemo(() => {
    const q = normalize(search.trim());
    return products.filter(
      (p) => (category === 'all' || p.categoryId === category) && (!q || normalize(p.name).includes(q)),
    );
  }, [products, category, search]);

  const inCart = (id: string) => lines.find((l) => l.productId === id)?.quantity ?? 0;

  function add(product: PosProduct) {
    if (product.maxQuantity !== null && inCart(product.id) >= product.maxQuantity) {
      toast.warning(`Stock insuffisant pour « ${product.name} » (disponible : ${product.maxQuantity}).`);
      return;
    }
    setLines((current) =>
      addToCart(current, {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        maxQuantity: product.maxQuantity,
      }),
    );
  }

  function resetSale() {
    setLines([]);
    setDiscountInput('');
    setPaymentMethod(paymentMethods[0]?.code ?? '');
  }

  function openConfirm() {
    if (!lines.length) return;
    if (!paymentMethod) {
      toast.error('Choisissez un mode de paiement.');
      return;
    }
    if (discountInvalid) {
      toast.error('La remise est invalide (nombre entier, au plus égal au sous-total).');
      return;
    }
    setConfirmOpen(true);
  }

  function submit() {
    if (pending) return;
    const idempotencyKey = keyRef.current;
    startTransition(async () => {
      try {
        const result = await createSaleAction({
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          paymentMethod,
          discount: totals.discount,
          idempotencyKey,
          note: undefined,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setConfirmOpen(false);
        setCartOpen(false);
        setSuccess(result.data);
        resetSale();
        router.refresh();
      } catch {
        toast.error(
          'Connexion perdue : la vente n’a peut-être pas été enregistrée. Réessayez — aucun doublon ne sera créé.',
          { duration: 8000 },
        );
      }
    });
  }

  const cartPanel = (
    <CartPanel
      lines={lines}
      money={money}
      totals={totals}
      canDiscount={canDiscount}
      discountInput={discountInput}
      discountInvalid={discountInvalid}
      onDiscountChange={setDiscountInput}
      paymentMethods={paymentMethods}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={setPaymentMethod}
      onQuantity={(id, q) => setLines((current) => setQuantity(current, id, q))}
      onRemove={(id) => setLines((current) => removeFromCart(current, id))}
      onClear={() => setLines([])}
      onValidate={openConfirm}
      pending={pending}
    />
  );

  return (
    <div className="lg:-m-6 lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* Zone produits */}
      <section aria-label="Produits" className="flex min-h-0 flex-col pb-24 lg:overflow-hidden lg:p-6 lg:pb-6">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Caisse</h1>
            <Button asChild variant="outline" size="sm" className="no-print">
              <Link href="/pos/sales">
                <Receipt /> Ventes récentes
              </Link>
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…  (raccourci : /)"
              aria-label="Rechercher un produit"
              className="h-11 pl-9 text-base"
            />
          </div>
          <div role="tablist" aria-label="Catégories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {[{ id: 'all', name: 'Tout' }, ...categories].map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  'h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
                  category === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
          {products.length === 0 ? (
            <EmptyState
              icon={PackageX}
              title="Aucun produit disponible"
              description="L’administrateur doit d’abord créer des produits et les rendre disponibles."
            />
          ) : visibleProducts.length === 0 ? (
            <EmptyState icon={Search} title="Aucun résultat" description="Modifiez la recherche ou la catégorie." />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleProducts.map((p) => {
                const remaining = p.maxQuantity === null ? null : p.maxQuantity - inCart(p.id);
                const soldOut = p.maxQuantity !== null && p.maxQuantity <= 0;
                const qty = inCart(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => add(p)}
                      disabled={soldOut}
                      aria-label={`Ajouter ${p.name}, ${money(p.price)}`}
                      className={cn(
                        'group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs transition hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55',
                        qty > 0 && 'border-primary ring-1 ring-primary',
                      )}
                    >
                      {showImages && (
                        <div className="relative aspect-[4/3] w-full bg-muted">
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt="" fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-muted-foreground/60">
                              {p.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex flex-1 flex-col gap-1 p-3">
                        <span className="line-clamp-2 text-sm leading-snug font-medium">{p.name}</span>
                        <span className="mt-auto text-base font-bold tabular-nums">{money(p.price)}</span>
                        {soldOut ? (
                          <Badge variant="destructive">Rupture</Badge>
                        ) : remaining !== null && remaining <= 5 ? (
                          <Badge variant="warning">Reste {remaining}</Badge>
                        ) : null}
                      </div>
                      {qty > 0 && (
                        <span className="absolute top-2 right-2 inline-flex min-w-7 items-center justify-center rounded-full bg-foreground px-2 py-0.5 text-xs font-bold text-background">
                          ×{qty}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Panier — colonne fixe sur ordinateur */}
      <aside aria-label="Panier" className="hidden min-h-0 border-l bg-card lg:flex lg:flex-col">
        {cartPanel}
      </aside>

      {/* Panier — barre + tiroir sur tablette / téléphone */}
      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t bg-card p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
        <Button size="xl" className="w-full justify-between" onClick={() => setCartOpen(true)}>
          <span className="flex items-center gap-2">
            <ShoppingCart aria-hidden /> Panier ({totals.itemCount})
          </span>
          <span className="tabular-nums">{money(totals.total)}</span>
        </Button>
      </div>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[90dvh] gap-0 p-0">
          <SheetTitle className="sr-only">Panier</SheetTitle>
          {cartPanel}
        </SheetContent>
      </Sheet>

      {/* Confirmation */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !pending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la vente</DialogTitle>
            <DialogDescription>Vérifiez le montant encaissé avant de valider.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-y-2 rounded-lg bg-muted p-4 text-sm">
            <dt className="text-muted-foreground">Articles</dt>
            <dd className="text-right tabular-nums">{totals.itemCount}</dd>
            <dt className="text-muted-foreground">Sous-total</dt>
            <dd className="text-right tabular-nums">{money(totals.subtotal)}</dd>
            {totals.discount > 0 && (
              <>
                <dt className="text-muted-foreground">Remise</dt>
                <dd className="text-right tabular-nums">−{money(totals.discount)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Paiement</dt>
            <dd className="text-right">{paymentMethods.find((m) => m.code === paymentMethod)?.label}</dd>
            <dt className="text-base font-semibold">Total</dt>
            <dd className="text-right text-xl font-bold tabular-nums">{money(totals.total)}</dd>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Retour
            </Button>
            <Button size="lg" onClick={submit} disabled={pending} autoFocus>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? 'Enregistrement…' : 'Valider la vente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Succès */}
      <Dialog open={!!success} onOpenChange={(open) => !open && setSuccess(null)}>
        <DialogContent>
          <DialogHeader className="items-center text-center">
            <CheckCircle2 className="mb-2 size-12 text-primary" aria-hidden />
            <DialogTitle>Vente enregistrée</DialogTitle>
            <DialogDescription>
              Reçu n° <strong className="text-foreground">{success?.receipt_number}</strong>
            </DialogDescription>
          </DialogHeader>
          <p className="text-center text-3xl font-bold tabular-nums">{success ? money(Number(success.total_amount)) : ''}</p>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={() => setSuccess(null)}>
              Nouvelle vente
            </Button>
            <Button asChild variant="dark">
              <Link href={`/receipts/${success?.sale_id}`}>
                <Receipt /> Voir le reçu
              </Link>
            </Button>
            <Button asChild autoFocus>
              <Link href={`/receipts/${success?.sale_id}?print=1`}>
                <Printer /> Imprimer
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CartPanel({
  lines,
  money,
  totals,
  canDiscount,
  discountInput,
  discountInvalid,
  onDiscountChange,
  paymentMethods,
  paymentMethod,
  onPaymentMethodChange,
  onQuantity,
  onRemove,
  onClear,
  onValidate,
  pending,
}: {
  lines: CartLine[];
  money: (value: number) => string;
  totals: ReturnType<typeof cartTotals>;
  canDiscount: boolean;
  discountInput: string;
  discountInvalid: boolean;
  onDiscountChange: (value: string) => void;
  paymentMethods: { code: string; label: string }[];
  paymentMethod: string;
  onPaymentMethodChange: (code: string) => void;
  onQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onValidate: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShoppingCart className="size-4" aria-hidden /> Panier
          <span className="text-sm font-normal text-muted-foreground">({totals.itemCount} article{totals.itemCount > 1 ? 's' : ''})</span>
        </h2>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="mr-6 text-muted-foreground lg:mr-0">
            Vider
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Panier vide" description="Touchez un produit pour l’ajouter." />
        ) : (
          <ul className="divide-y">
            {lines.map((line) => (
              <li key={line.productId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-snug font-medium">{line.name}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{money(line.unitPrice * line.quantity)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground tabular-nums">{money(line.unitPrice)} / unité</p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onQuantity(line.productId, line.quantity - 1)}
                      aria-label={`Diminuer la quantité de ${line.name}`}
                    >
                      <Minus />
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => onQuantity(line.productId, Number(e.target.value || 0))}
                      aria-label={`Quantité de ${line.name}`}
                      className="h-9 w-14 px-1 text-center tabular-nums"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onQuantity(line.productId, line.quantity + 1)}
                      disabled={line.maxQuantity !== null && line.quantity >= line.maxQuantity}
                      aria-label={`Augmenter la quantité de ${line.name}`}
                    >
                      <Plus />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(line.productId)}
                      aria-label={`Retirer ${line.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t bg-card p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Sous-total</dt>
            <dd className="tabular-nums">{money(totals.subtotal)}</dd>
          </div>
          {canDiscount && (
            <div className="flex items-center justify-between gap-3">
              <dt>
                <Label htmlFor="discount" className="font-normal text-muted-foreground">
                  Remise
                </Label>
              </dt>
              <dd>
                <Input
                  id="discount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={discountInput}
                  onChange={(e) => onDiscountChange(e.target.value)}
                  placeholder="0"
                  aria-invalid={discountInvalid}
                  className="h-8 w-32 text-right tabular-nums"
                />
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="text-base font-semibold">Total</dt>
            <dd className="text-2xl font-bold tabular-nums">{money(totals.total)}</dd>
          </div>
        </dl>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Mode de paiement</legend>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-destructive">Aucun mode de paiement actif : voir Paramètres.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => onPaymentMethodChange(m.code)}
                  aria-pressed={paymentMethod === m.code}
                  className={cn(
                    'flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium',
                    paymentMethod === m.code ? 'border-primary bg-accent text-accent-foreground ring-1 ring-primary' : 'hover:bg-muted',
                  )}
                >
                  {paymentMethod === m.code && <Check className="size-4" aria-hidden />}
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <Button size="xl" className="w-full" onClick={onValidate} disabled={!lines.length || pending || !paymentMethod}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
          Valider la vente
        </Button>
      </div>
    </div>
  );
}
