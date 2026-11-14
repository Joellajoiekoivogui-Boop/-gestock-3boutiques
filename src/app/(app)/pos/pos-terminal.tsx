'use client';

import {
  Banknote,
  Check,
  CheckCircle2,
  LayoutGrid,
  Landmark,
  Loader2,
  Minus,
  PackageX,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/app/empty-state';
import { CART_COUNT_EVENT, CART_OPEN_EVENT } from '@/components/app/app-shell';
import { DishIcon, ProductThumb, toneColor } from '@/components/app/product-thumb';
import { AnimatedMoney } from '@/components/motion/animated-number';
import { SuccessBurst } from '@/components/motion/success-burst';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { addToCart, cartTotals, removeFromCart, setQuantity, type CartLine } from '@/lib/cart';
import type { CreateSaleResult } from '@/lib/database.types';
import { formatAmount, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createSaleAction } from './actions';

export type PosProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: string | null;
  // null = stock non suivi
  maxQuantity: number | null;
};

type PosCategory = { id: string; name: string; tone: number };

type Props = {
  products: PosProduct[];
  categories: PosCategory[];
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

// Montants que le client tend le plus souvent : le compte juste, puis les
// billets ronds au-dessus du total.
function cashSuggestions(total: number) {
  if (total <= 0) return [];
  const steps = [5_000, 10_000, 20_000, 50_000, 100_000];
  const values = new Set<number>([total]);
  for (const step of steps) values.add(Math.ceil(total / step) * step);
  return [...values].sort((a, b) => a - b).slice(0, 4);
}

export function PosTerminal({ products, categories, paymentMethods, currency, showImages, canDiscount }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]?.code ?? '');
  const [discountInput, setDiscountInput] = useState('');
  const [received, setReceived] = useState('');
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
  const toneOf = useMemo(() => new Map(categories.map((c) => [c.id, c.tone])), [categories]);

  // Barre du bas (téléphone) : nombre d'articles et ouverture du ticket.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CART_COUNT_EVENT, { detail: totals.itemCount }));
  }, [totals.itemCount]);
  useEffect(() => {
    const open = () => setCartOpen(true);
    window.addEventListener(CART_OPEN_EVENT, open);
    return () => {
      window.removeEventListener(CART_OPEN_EVENT, open);
      window.dispatchEvent(new CustomEvent(CART_COUNT_EVENT, { detail: 0 }));
    };
  }, []);

  // Toute modification du panier invalide la clé précédente.
  useEffect(() => {
    keyRef.current = newKey();
  }, [lines, paymentMethod, discountInput]);

  // Le tiroir du panier n'existe qu'en dessous de 1024 px : on le ferme si
  // l'écran s'agrandit (rotation d'une tablette).
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

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    return counts;
  }, [products]);
  const shownCategories = categories.filter((c) => countByCategory.has(c.id));

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
    setReceived('');
    setPaymentMethod(paymentMethods[0]?.code ?? '');
  }

  function checkout() {
    if (pending || !lines.length) return;
    if (!paymentMethod) {
      toast.error('Choisissez un mode de paiement.');
      return;
    }
    if (discountInvalid) {
      toast.error('La remise est invalide : nombre entier, au plus égal au sous-total.');
      return;
    }
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
        setCartOpen(false);
        setSuccess(result.data);
        resetSale();
        router.refresh();
      } catch {
        toast.error('Connexion perdue : la vente n’a peut-être pas été enregistrée. Réessayez, aucun doublon ne sera créé.', {
          duration: 8000,
        });
      }
    });
  }

  const ticket = (
    <TicketPanel
      lines={lines}
      money={money}
      currency={currency}
      totals={totals}
      canDiscount={canDiscount}
      discountInput={discountInput}
      discountInvalid={discountInvalid}
      onDiscountChange={setDiscountInput}
      paymentMethods={paymentMethods}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={(code) => {
        setPaymentMethod(code);
        setReceived('');
      }}
      received={received}
      onReceivedChange={setReceived}
      onQuantity={(id, q) => setLines((current) => setQuantity(current, id, q))}
      onRemove={(id) => setLines((current) => removeFromCart(current, id))}
      onClear={() => setLines([])}
      onCheckout={checkout}
      pending={pending}
    />
  );

  const categoryButtons = [{ id: 'all', name: 'Tout le menu', tone: -1 }, ...shownCategories];
  const sectionTitle = category === 'all' ? 'Tout le menu' : (categories.find((c) => c.id === category)?.name ?? 'Menu');

  return (
    <div className="-m-4 sm:-m-6 lg:grid lg:h-[calc(100dvh-4.5rem-1px)] lg:grid-cols-[minmax(0,1fr)_26rem]">
      {/* Plats */}
      <section aria-label="Produits" className="flex min-h-0 flex-col lg:overflow-y-auto">
        <div className="sticky top-[4.5rem] z-10 flex shrink-0 flex-col gap-4 border-b bg-background px-4 pt-4 pb-3 sm:px-6 lg:top-0 lg:pt-5">
          <div className="flex items-center gap-3">
            <h1 className="sr-only">Caisse</h1>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un plat, une boisson…"
                aria-label="Rechercher un produit"
                className="h-13 rounded-full border-transparent bg-card pr-12 pl-12 text-base shadow-card [&::-webkit-search-cancel-button]:hidden"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    searchRef.current?.focus();
                  }}
                  aria-label="Effacer la recherche"
                  className="absolute top-1/2 right-1.5 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-5" aria-hidden />
                </button>
              ) : (
                <kbd
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md border bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground pointer-fine:block"
                >
                  /
                </kbd>
              )}
            </div>
            <Button asChild variant="dark" size="lg" className="no-print hidden shrink-0 sm:inline-flex">
              <Link href="/pos/sales">
                <Receipt aria-hidden /> Ventes du jour
              </Link>
            </Button>
          </div>

          <div role="group" aria-label="Catégories" className="-mx-4 flex shrink-0 gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:gap-5 sm:px-6">
            {categoryButtons.map((c) => (
              <CategoryButton
                key={c.id}
                category={c}
                count={c.id === 'all' ? products.length : (countByCategory.get(c.id) ?? 0)}
                active={category === c.id}
                onSelect={() => setCategory(c.id)}
              />
            ))}
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold">{sectionTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {visibleProducts.length} plat{visibleProducts.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex-1 px-4 pt-4 pb-8 sm:px-6">
          {products.length === 0 ? (
            <EmptyState
              icon={PackageX}
              title="Aucun produit disponible"
              description="L’administrateur doit d’abord créer des produits et les rendre disponibles."
            />
          ) : visibleProducts.length === 0 ? (
            <EmptyState icon={Search} title="Aucun résultat" description="Modifiez la recherche ou choisissez « Tout le menu »." />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] sm:gap-4">
              {visibleProducts.map((p) => {
                const qty = inCart(p.id);
                const remaining = p.maxQuantity === null ? null : p.maxQuantity - qty;
                const soldOut = p.maxQuantity !== null && p.maxQuantity <= 0;
                const tone = p.categoryId ? (toneOf.get(p.categoryId) ?? 0) : 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => add(p)}
                      disabled={soldOut}
                      aria-label={`Ajouter ${p.name}, ${money(p.price)}`}
                      className={cn(
                        'group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-transparent bg-card text-left shadow-card transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:hover:translate-y-0',
                        qty > 0 && 'border-forest shadow-[0_0_0_2px_var(--forest)]',
                      )}
                    >
                      <span className="relative block p-2 pb-0">
                        <ProductThumb
                          name={p.name}
                          imageUrl={showImages ? p.imageUrl : null}
                          tone={tone}
                          sizes="(max-width: 640px) 50vw, 240px"
                          className={cn('w-full rounded-lg', showImages && p.imageUrl ? 'aspect-[16/10]' : 'aspect-[3/1] lg:aspect-[4/1]', soldOut && 'opacity-60 grayscale')}
                          imageClassName="transition-transform duration-500 group-hover:scale-105"
                          iconClassName="size-8"
                        />
                        {soldOut ? (
                          <Badge className="absolute top-4 left-4 border-transparent bg-destructive-strong text-destructive-foreground">
                            Rupture
                          </Badge>
                        ) : remaining !== null && remaining <= 5 ? (
                          <Badge className="absolute top-4 left-4 border-transparent bg-forest text-forest-foreground">
                            Reste {remaining}
                          </Badge>
                        ) : null}
                        {qty > 0 && (
                          <motion.span
                            key={qty}
                            initial={{ scale: 1.4 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                            className="absolute top-4 right-4 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-sm font-bold text-primary-foreground shadow-md"
                          >
                            ×{qty}
                          </motion.span>
                        )}
                      </span>
                      <span className={cn('flex flex-1 flex-col gap-1 px-3 pt-2.5 pb-3 sm:px-3.5', soldOut && 'text-muted-foreground')}>
                        <span className="line-clamp-2 text-lg leading-snug font-bold">{p.name}</span>
                        {p.description && (
                          <span className="line-clamp-2 hidden text-sm leading-snug text-muted-foreground sm:block">{p.description}</span>
                        )}
                        <span className="mt-auto flex items-end justify-between gap-2 pt-1.5">
                          <span className="text-lg leading-none font-bold tracking-tight whitespace-nowrap tabular-nums sm:text-xl">
                            {formatAmount(p.price)}
                            <span className="ml-1 text-xs font-semibold text-muted-foreground">{currency}</span>
                          </span>
                          <span
                            aria-hidden
                            className={cn(
                              'inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
                              soldOut ? 'bg-muted text-muted-foreground' : 'bg-forest text-forest-foreground group-hover:bg-primary group-hover:text-primary-foreground',
                            )}
                          >
                            <Plus className="size-5" />
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Ticket : colonne fixe sur grand écran */}
      <aside aria-label="Panier" className="hidden min-h-0 border-l bg-card lg:flex lg:flex-col">
        {ticket}
      </aside>

      {/* Ticket sur tablette en portrait : barre en bas (sur téléphone, le bouton rond de la barre d'onglets). */}
      <div className="no-print fixed inset-x-0 bottom-0 z-20 hidden border-t bg-card p-3 md:block lg:hidden">
        <Button size="xl" className="w-full justify-between" onClick={() => setCartOpen(true)}>
          <span className="flex items-center gap-2">
            <ShoppingCart aria-hidden className="size-6" /> Panier ({totals.itemCount})
          </span>
          <span className="text-xl font-bold">
            <AnimatedMoney value={totals.total} currency={currency} duration={0.4} />
          </span>
        </Button>
      </div>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[92dvh] gap-0 p-0">
          <SheetTitle className="sr-only">Panier</SheetTitle>
          {ticket}
        </SheetContent>
      </Sheet>

      {/* Vente enregistrée */}
      <Dialog open={!!success} onOpenChange={(open) => !open && setSuccess(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <SuccessBurst />
            <DialogTitle className="font-serif text-3xl">Vente enregistrée</DialogTitle>
            <DialogDescription className="text-base">
              Reçu n° <strong className="text-foreground">{success?.receipt_number}</strong>
            </DialogDescription>
          </DialogHeader>
          <p className="text-center text-5xl font-bold tracking-tight">
            {success ? <AnimatedMoney value={Number(success.total_amount)} currency={currency} duration={0.6} /> : ''}
          </p>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button asChild size="xl" className="col-span-2" autoFocus>
              <Link href={`/receipts/${success?.sale_id}?print=1`}>
                <Printer aria-hidden /> Imprimer le reçu
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/receipts/${success?.sale_id}`}>
                <Receipt aria-hidden /> Voir le reçu
              </Link>
            </Button>
            <Button variant="outline" size="lg" onClick={() => setSuccess(null)}>
              <Plus aria-hidden /> Nouvelle vente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryButton({
  category,
  count,
  active,
  onSelect,
}: {
  category: { id: string; name: string; tone: number };
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="group flex w-[5.5rem] shrink-0 flex-col items-center gap-2 rounded-xl text-center focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span
        className={cn(
          'flex size-16 items-center justify-center rounded-full border transition-colors',
          active ? 'border-forest bg-forest text-forest-foreground shadow-md' : 'border-border bg-card shadow-card group-hover:border-forest/50',
        )}
        style={active || category.tone < 0 ? undefined : { color: toneColor(category.tone) }}
      >
        {category.tone < 0 ? (
          <LayoutGrid className="size-7" strokeWidth={1.75} aria-hidden />
        ) : (
          <DishIcon name={category.name} className="size-7" strokeWidth={1.75} />
        )}
      </span>
      <span className={cn('text-[13px] leading-tight font-semibold', active ? 'text-forest' : 'text-foreground')}>
        {category.name}
        <span className="block text-xs font-medium text-muted-foreground">{count}</span>
      </span>
    </button>
  );
}

// Pictogramme du mode de paiement, pour le reconnaître sans lire le libellé.
function PaymentIcon({ code }: { code: string }) {
  const className = 'size-5 shrink-0';
  if (code === 'cash') return <Banknote className={className} aria-hidden />;
  if (code === 'bank_transfer') return <Landmark className={className} aria-hidden />;
  if (/money|momo|mobile/.test(code)) return <Smartphone className={className} aria-hidden />;
  return <Wallet className={className} aria-hidden />;
}

function TicketPanel({
  lines,
  money,
  currency,
  totals,
  canDiscount,
  discountInput,
  discountInvalid,
  onDiscountChange,
  paymentMethods,
  paymentMethod,
  onPaymentMethodChange,
  received,
  onReceivedChange,
  onQuantity,
  onRemove,
  onClear,
  onCheckout,
  pending,
}: {
  lines: CartLine[];
  money: (value: number) => string;
  currency: string;
  totals: ReturnType<typeof cartTotals>;
  canDiscount: boolean;
  discountInput: string;
  discountInvalid: boolean;
  onDiscountChange: (value: string) => void;
  paymentMethods: { code: string; label: string }[];
  paymentMethod: string;
  onPaymentMethodChange: (code: string) => void;
  received: string;
  onReceivedChange: (value: string) => void;
  onQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  pending: boolean;
}) {
  const [showDiscount, setShowDiscount] = useState(false);
  const discountShown = canDiscount && (showDiscount || discountInput !== '');
  const isCash = paymentMethod === 'cash';
  const receivedAmount = Number(received || 0);
  const change = receivedAmount - totals.total;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
        <h2 className="flex items-baseline gap-2 font-serif text-2xl font-bold whitespace-nowrap">
          Commande
          <span className="font-sans text-base font-medium text-muted-foreground">
            {totals.itemCount} article{totals.itemCount > 1 ? 's' : ''}
          </span>
        </h2>
        {lines.length > 0 && (
          <Button variant="ghost" onClick={onClear} className="mr-8 text-muted-foreground lg:mr-0">
            <Trash2 aria-hidden /> Vider
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Commande vide" description="Touchez un plat pour l’ajouter." />
        ) : (
          <ul className="divide-y">
            <AnimatePresence initial={false} mode="popLayout">
              {lines.map((line) => (
                <motion.li
                  key={line.productId}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 440, damping: 36 }}
                  className="bg-card px-5 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[17px] leading-snug font-semibold">{line.name}</p>
                    <p className="shrink-0 text-lg font-bold tracking-tight tabular-nums">{money(line.unitPrice * line.quantity)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <p className="text-[15px] text-muted-foreground tabular-nums">{money(line.unitPrice)} l’unité</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-11"
                        onClick={() => (line.quantity > 1 ? onQuantity(line.productId, line.quantity - 1) : onRemove(line.productId))}
                        aria-label={line.quantity > 1 ? `Diminuer la quantité de ${line.name}` : `Retirer ${line.name}`}
                      >
                        {line.quantity > 1 ? <Minus /> : <Trash2 />}
                      </Button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => onQuantity(line.productId, Number(e.target.value || 0))}
                        aria-label={`Quantité de ${line.name}`}
                        className="h-11 w-12 rounded-full px-1 text-center text-lg font-bold tabular-nums"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-11"
                        onClick={() => onQuantity(line.productId, line.quantity + 1)}
                        disabled={line.maxQuantity !== null && line.quantity >= line.maxQuantity}
                        aria-label={`Augmenter la quantité de ${line.name}`}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t bg-card px-5 pt-3 pb-4">
        <dl className="space-y-1">
          {(discountShown || totals.discount > 0) && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Sous-total</dt>
              <dd className="tabular-nums">{money(totals.subtotal)}</dd>
            </div>
          )}
          {discountShown && (
            <div className="flex items-center justify-between gap-3">
              <dt>
                <Label htmlFor="discount" className="text-base font-normal text-muted-foreground">
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
                  autoFocus={showDiscount && discountInput === ''}
                  className="h-10 w-36 text-right tabular-nums"
                />
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <dt className="flex items-baseline gap-3">
              <span className="font-serif text-2xl font-bold">Total</span>
              {canDiscount && !discountShown && lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDiscount(true)}
                  className="text-sm font-semibold text-primary-strong underline-offset-4 hover:underline"
                >
                  Remise
                </button>
              )}
            </dt>
            <dd className="text-3xl leading-none font-bold tracking-tight sm:text-[2.25rem]">
              <AnimatedMoney value={totals.total} currency={currency} duration={0.4} />
            </dd>
          </div>
        </dl>

        <fieldset>
          <legend className="sr-only">Mode de paiement</legend>
          {paymentMethods.length === 0 ? (
            <p className="text-destructive">Aucun mode de paiement actif : voir Paramètres.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((m) => {
                const selected = paymentMethod === m.code;
                return (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => onPaymentMethodChange(m.code)}
                    aria-pressed={selected}
                    className={cn(
                      'flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-1 text-center text-sm leading-tight font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:outline-none',
                      selected ? 'border-forest bg-forest text-forest-foreground' : 'bg-card hover:border-forest/50',
                    )}
                  >
                    {selected ? <Check className="size-5 shrink-0 text-gold" aria-hidden /> : <PaymentIcon code={m.code} />}
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        {isCash && totals.total > 0 && (
          <div className="space-y-1.5 rounded-xl bg-muted p-2">
            <div className="flex gap-1.5" role="group" aria-label="Montant reçu du client">
              {cashSuggestions(totals.total)
                .slice(0, 3)
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onReceivedChange(receivedAmount === value ? '' : String(value))}
                    aria-pressed={receivedAmount === value}
                    className={cn(
                      'h-11 min-w-0 flex-1 rounded-full border bg-card px-1 text-[15px] font-bold tabular-nums transition-colors hover:border-forest/50',
                      receivedAmount === value && 'border-forest bg-forest text-forest-foreground',
                    )}
                  >
                    {formatAmount(value)}
                  </button>
                ))}
              <Label htmlFor="cash-received" className="sr-only">
                Autre montant reçu du client
              </Label>
              <Input
                id="cash-received"
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                value={received}
                onChange={(e) => onReceivedChange(e.target.value)}
                placeholder="Autre"
                className="h-11 w-24 shrink-0 rounded-full bg-card text-right tabular-nums"
              />
            </div>
            {received !== '' && (
              <p aria-live="polite" className="flex items-baseline justify-between px-1">
                <span className="font-semibold">{change >= 0 ? 'À rendre' : 'Il manque'}</span>
                <span className={cn('text-2xl font-bold tracking-tight tabular-nums', change < 0 && 'text-destructive-strong')}>
                  {money(Math.abs(change))}
                </span>
              </p>
            )}
          </div>
        )}

        <Button
          size="xl"
          className="h-16 w-full justify-between px-5 text-xl"
          onClick={onCheckout}
          disabled={!lines.length || pending || !paymentMethod}
        >
          <span className="flex items-center gap-2">
            {pending ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <CheckCircle2 className="size-6" aria-hidden />}
            {pending ? 'Enregistrement…' : 'Encaisser'}
          </span>
          {!pending && lines.length > 0 && <span className="text-xl font-bold tracking-tight">{money(totals.total)}</span>}
        </Button>
      </div>
    </div>
  );
}
