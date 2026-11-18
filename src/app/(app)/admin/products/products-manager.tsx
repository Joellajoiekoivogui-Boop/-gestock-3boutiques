'use client';

import { Archive, ArchiveRestore, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ProductThumb, toneForIndex } from '@/components/app/product-thumb';
import { EmptyState } from '@/components/app/empty-state';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ProductRow } from '@/lib/database.types';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { deleteProductAction, setProductFlagAction } from './actions';
import { ProductFormDialog } from './product-form-dialog';

type Category = { id: string; name: string; is_active: boolean };

type Shop = { id: string; name: string };

export function NewProductButton({
  categories,
  currency,
  shops = [],
  defaultShopId = null,
}: {
  categories: Category[];
  currency: string;
  shops?: Shop[];
  defaultShopId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Nouveau produit
      </Button>
      {open && (
        <ProductFormDialog
          open={open}
          onOpenChange={setOpen}
          product={null}
          categories={categories}
          currency={currency}
          shops={shops}
          defaultShopId={defaultShopId}
        />
      )}
    </>
  );
}

export function ProductsTable({
  products,
  categories,
  currency,
  stockEnabled,
  shops = [],
  showShop = false,
}: {
  products: ProductRow[];
  categories: Category[];
  currency: string;
  stockEnabled: boolean;
  shops?: Shop[];
  /** Afficher la boutique de chaque produit (vue « toutes les boutiques »). */
  showShop?: boolean;
}) {
  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const router = useRouter();
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [pending, startTransition] = useTransition();
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const categoryTone = new Map(categories.map((c, i) => [c.id, toneForIndex(i)]));

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? 'Erreur.');
      else {
        toast.success(success);
        router.refresh();
      }
    });
  }

  if (products.length === 0) {
    return <EmptyState title="Aucun produit" description="Créez un produit ou modifiez les filtres." />;
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {products.map((p) => {
          const low = stockEnabled && p.track_stock && p.stock_quantity <= p.minimum_stock;
          const tone = p.category_id ? (categoryTone.get(p.category_id) ?? 0) : 0;
          return (
            <li key={p.id}>
              <article
                className={cn(
                  'flex h-full flex-col overflow-hidden rounded-xl bg-card shadow-card',
                  p.is_archived && 'opacity-70',
                )}
              >
                <div className="relative p-2 pb-0">
                  <ProductThumb
                    name={p.name}
                    imageUrl={p.image_url}
                    tone={tone}
                    sizes="(max-width: 640px) 100vw, 320px"
                    className={cn('w-full rounded-lg', p.image_url ? 'aspect-[16/9]' : 'aspect-[4/1]')}
                    iconClassName="size-8"
                  />
                  <div className="absolute top-4 left-4 flex flex-wrap gap-1">
                    {p.is_archived ? (
                      <Badge className="border-transparent bg-foreground/80 text-background">Archivé</Badge>
                    ) : !p.is_available ? (
                      <Badge className="border-transparent bg-card text-foreground shadow-sm">Retiré de la caisse</Badge>
                    ) : null}
                    {stockEnabled && p.track_stock && p.stock_quantity === 0 && !p.is_archived && (
                      <Badge className="border-transparent bg-destructive-strong text-destructive-foreground">Rupture</Badge>
                    )}
                    {low && p.stock_quantity > 0 && !p.is_archived && <Badge variant="warning">Stock faible</Badge>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4 pt-3">
                  {showShop && (
                    <p className="text-xs font-semibold tracking-wide text-gold-strong uppercase">
                      {shopName.get(p.shop_id) ?? ''}
                    </p>
                  )}
                  <h3 className="text-lg leading-snug font-bold">{p.name}</h3>
                  {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                    <p className="text-xl font-bold tracking-tight whitespace-nowrap tabular-nums">{formatMoney(p.price, currency)}</p>
                    <p className="text-right text-sm text-muted-foreground tabular-nums">
                      {p.category_id ? categoryName.get(p.category_id) : 'Sans catégorie'}
                      {p.track_stock && (
                        <span className={cn('block', low && 'font-semibold text-warning-foreground')}>Stock : {p.stock_quantity}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t px-3 py-2.5">
                  <Button variant="outline" size="sm" onClick={() => setEditing(p)} disabled={pending} className="flex-1">
                    <Pencil /> Modifier
                  </Button>
                  {!p.is_archived && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      className="flex-1"
                      onClick={() =>
                        run(
                          () => setProductFlagAction(p.id, 'is_available', !p.is_available),
                          p.is_available ? 'Produit retiré de la caisse.' : 'Produit disponible à la caisse.',
                        )
                      }
                    >
                      {p.is_available ? <EyeOff /> : <Eye />} {p.is_available ? 'Retirer' : 'Remettre'}
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${p.name}`} disabled={pending}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem
                        onSelect={() =>
                          run(
                            () => setProductFlagAction(p.id, 'is_archived', !p.is_archived),
                            p.is_archived ? 'Produit restauré.' : 'Produit archivé (historique conservé).',
                          )
                        }
                      >
                        {p.is_archived ? <ArchiveRestore /> : <Archive />} {p.is_archived ? 'Restaurer' : 'Archiver'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
                        <Trash2 /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {editing && (
        <ProductFormDialog
          key={editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          product={editing}
          categories={categories}
          shops={shops}
          currency={currency}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              La suppression est définitive et n’est possible que si le produit n’a jamais été vendu ni mouvementé en
              stock. Sinon, archivez-le : il disparaît de la caisse mais l’historique reste intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = deleting;
                setDeleting(null);
                if (target) run(() => deleteProductAction(target.id), 'Produit supprimé.');
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
