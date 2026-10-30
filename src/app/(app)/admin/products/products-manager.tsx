'use client';

import { Archive, ArchiveRestore, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductRow } from '@/lib/database.types';
import { formatMoney } from '@/lib/format';
import { deleteProductAction, setProductFlagAction } from './actions';
import { ProductFormDialog } from './product-form-dialog';

type Category = { id: string; name: string; is_active: boolean };

export function NewProductButton({ categories, currency }: { categories: Category[]; currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Nouveau produit
      </Button>
      {open && <ProductFormDialog open={open} onOpenChange={setOpen} product={null} categories={categories} currency={currency} />}
    </>
  );
}

export function ProductsTable({
  products,
  categories,
  currency,
  stockEnabled,
}: {
  products: ProductRow[];
  categories: Category[];
  currency: string;
  stockEnabled: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [pending, startTransition] = useTransition();
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Photo</TableHead>
            <TableHead>Produit</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Prix</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => {
            const low = stockEnabled && p.track_stock && p.stock_quantity <= p.minimum_stock;
            return (
              <TableRow key={p.id} className={p.is_archived ? 'opacity-60' : undefined}>
                <TableCell>
                  <div className="relative size-10 overflow-hidden rounded-md bg-muted">
                    {p.image_url && <Image src={p.image_url} alt="" fill sizes="40px" className="object-cover" />}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{p.name}</p>
                  {p.description && <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{p.description}</p>}
                </TableCell>
                <TableCell>{p.category_id ? categoryName.get(p.category_id) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(p.price, currency)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.track_stock ? (
                    <span className={low ? 'font-semibold text-warning-foreground' : undefined}>{p.stock_quantity}</span>
                  ) : (
                    <span className="text-muted-foreground">Non suivi</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.is_archived ? (
                      <Badge variant="secondary">Archivé</Badge>
                    ) : p.is_available ? (
                      <Badge variant="success">Disponible</Badge>
                    ) : (
                      <Badge variant="outline">Indisponible</Badge>
                    )}
                    {low && !p.is_archived && <Badge variant="warning">Stock faible</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${p.name}`} disabled={pending}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(p)}>
                        <Pencil /> Modifier
                      </DropdownMenuItem>
                      {!p.is_archived && (
                        <DropdownMenuItem
                          onSelect={() =>
                            run(
                              () => setProductFlagAction(p.id, 'is_available', !p.is_available),
                              p.is_available ? 'Produit retiré de la caisse.' : 'Produit disponible à la caisse.',
                            )
                          }
                        >
                          {p.is_available ? <EyeOff /> : <Eye />} {p.is_available ? 'Rendre indisponible' : 'Rendre disponible'}
                        </DropdownMenuItem>
                      )}
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {editing && (
        <ProductFormDialog
          key={editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          product={editing}
          categories={categories}
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
