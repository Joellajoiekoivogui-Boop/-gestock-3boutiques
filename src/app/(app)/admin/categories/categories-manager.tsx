'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { CategoryRow } from '@/lib/database.types';
import { categorySchema, type CategoryFormOutput, type CategoryFormValues } from '@/lib/validation';
import { deleteCategoryAction, saveCategoryAction } from './actions';

type Category = CategoryRow & { productCount: number };

function CategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<CategoryFormValues, unknown, CategoryFormOutput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      sortOrder: category?.sort_order ?? 100,
      isActive: category?.is_active ?? true,
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveCategoryAction(category?.id ?? null, values);
      if (!result.ok) {
        if (result.fieldErrors?.name?.[0]) form.setError('name', { message: result.fieldErrors.name[0] });
        toast.error(result.error);
        return;
      }
      toast.success(category ? 'Catégorie mise à jour.' : 'Catégorie créée.');
      onClose();
      router.refresh();
    }),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
          </DialogHeader>
          <Field label="Nom" htmlFor="cat-name" error={errors.name?.message}>
            <Input id="cat-name" aria-invalid={!!errors.name} {...form.register('name')} />
          </Field>
          <Field label="Description" htmlFor="cat-description" error={errors.description?.message}>
            <Textarea id="cat-description" rows={2} {...form.register('description')} />
          </Field>
          <Field label="Ordre d’affichage" htmlFor="cat-order" hint="Plus petit = affiché en premier à la caisse." error={errors.sortOrder?.message}>
            <Input id="cat-order" type="number" min={0} {...form.register('sortOrder', { valueAsNumber: true })} />
          </Field>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <Label htmlFor="cat-active">Active (visible à la caisse)</Label>
                <Switch id="cat-active" checked={field.value} onCheckedChange={field.onChange} />
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

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [, startTransition] = useTransition();

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus /> Nouvelle catégorie
        </Button>
      </div>
      {categories.length === 0 ? (
        <EmptyState title="Aucune catégorie" description="Créez une première catégorie." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="text-right">Produits</TableHead>
              <TableHead className="text-right">Ordre</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <p className="font-medium">{c.name}</p>
                  {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.productCount}</TableCell>
                <TableCell className="text-right tabular-nums">{c.sort_order}</TableCell>
                <TableCell>{c.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label={`Modifier ${c.name}`}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleting(c)}
                    aria-label={`Supprimer ${c.name}`}
                    className="text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing && <CategoryDialog category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Impossible si des produits l’utilisent encore ; désactivez-la dans ce cas. Les ventes passées gardent le nom de
              catégorie enregistré.
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
                startTransition(async () => {
                  const result = await deleteCategoryAction(target.id);
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success('Catégorie supprimée.');
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
    </>
  );
}
