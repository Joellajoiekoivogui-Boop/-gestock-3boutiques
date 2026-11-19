'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ProductRow } from '@/lib/database.types';
import { IMAGE_TYPES, productSchema, validateImage, type ProductFormOutput, type ProductFormValues } from '@/lib/validation';
import { formatMoney } from '@/lib/format';
import { saveProductAction } from './actions';

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  currency,
  shops = [],
  defaultShopId = null,
  costPrice = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductRow | null;
  categories: { id: string; name: string; is_active: boolean }[];
  currency: string;
  /** Boutiques : un nouveau produit appartient à une seule boutique. */
  shops?: { id: string; name: string }[];
  defaultShopId?: string | null;
  /** Prix d'achat actuel (administrateur). */
  costPrice?: number | null;
}) {
  const router = useRouter();
  const [shopId, setShopId] = useState(product?.shop_id ?? defaultShopId ?? (shops.length === 1 ? (shops[0]?.id ?? '') : ''));
  const [shopError, setShopError] = useState<string | null>(null);
  const shopName = shops.find((s) => s.id === product?.shop_id)?.name;
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      categoryId: product?.category_id ?? '',
      price: product ? Number(product.price) : (undefined as unknown as number),
      costPrice: costPrice ?? null,
      isAvailable: product?.is_available ?? true,
      trackStock: product?.track_stock ?? false,
      minimumStock: product?.minimum_stock ?? 0,
      initialStock: 0,
    },
  });
  const { errors } = form.formState;
  const trackStock = useWatch({ control: form.control, name: 'trackStock' });
  // Marge affichée pendant la saisie : prix de vente − prix d'achat.
  const watchedPrice = useWatch({ control: form.control, name: 'price' });
  const watchedCost = useWatch({ control: form.control, name: 'costPrice' });
  const marginHint =
    typeof watchedPrice === 'number' && watchedPrice > 0 && typeof watchedCost === 'number' && Number.isFinite(watchedCost)
      ? `Marge : ${formatMoney(watchedPrice - watchedCost, currency)} par unité (${Math.round(((watchedPrice - watchedCost) / watchedPrice) * 100)} %)`
      : null;

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    const error = validateImage(selected);
    setImageError(error);
    if (error || !selected) {
      event.target.value = '';
      return;
    }
    setFile(selected);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(selected));
  }

  const submit = form.handleSubmit((values) => {
    if (!product && shops.length > 0 && !shopId) {
      setShopError('Choisissez la boutique du produit.');
      return;
    }
    const data = new FormData();
    if (product) data.set('id', product.id);
    if (!product && shopId) data.set('shopId', shopId);
    data.set('name', values.name);
    data.set('description', values.description ?? '');
    data.set('categoryId', values.categoryId ?? '');
    data.set('price', String(values.price));
    data.set('costPrice', values.costPrice == null ? '' : String(values.costPrice));
    data.set('isAvailable', String(values.isAvailable));
    data.set('trackStock', String(values.trackStock));
    data.set('minimumStock', String(values.minimumStock));
    if (!product && values.trackStock) data.set('initialStock', String(values.initialStock ?? 0));
    if (file) data.set('image', file);
    if (removeImage) data.set('removeImage', 'true');

    startTransition(async () => {
      const result = await saveProductAction(data);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (field === 'image') setImageError(messages?.[0] ?? null);
          else if (messages?.[0]) form.setError(field as keyof ProductFormValues, { message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success(product ? 'Produit mis à jour.' : 'Produit créé.');
      onOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{product ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
            <DialogDescription>Le prix modifié s’applique aux ventes futures ; les reçus passés ne changent pas.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="grid gap-2">
              <Label htmlFor="product-image">Photo</Label>
              <label
                htmlFor="product-image"
                className="relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted text-muted-foreground hover:border-primary"
              >
                {preview && !removeImage ? (
                  <Image src={preview} alt="Aperçu" fill sizes="160px" className="object-cover" unoptimized />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-xs">
                    <ImagePlus className="size-6" aria-hidden /> Ajouter
                  </span>
                )}
              </label>
              <input id="product-image" type="file" accept={IMAGE_TYPES.join(',')} onChange={onFile} className="sr-only" />
              {preview && !removeImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRemoveImage(true);
                    setFile(null);
                  }}
                >
                  Retirer la photo
                </Button>
              )}
              {imageError ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {imageError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, 2 Mo max.</p>
              )}
            </div>

            <div className="grid gap-4">
              {shops.length > 0 &&
                (product ? (
                  <p className="text-sm text-muted-foreground">
                    Boutique : <span className="font-semibold text-foreground">{shopName ?? '—'}</span>
                  </p>
                ) : (
                  <Field label="Boutique" htmlFor="shopId" error={shopError ?? undefined}>
                    <NativeSelect
                      id="shopId"
                      value={shopId}
                      aria-invalid={!!shopError}
                      onChange={(event) => {
                        setShopId(event.target.value);
                        setShopError(null);
                      }}
                    >
                      <option value="">Choisir la boutique</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                ))}
              <Field label="Nom" htmlFor="name" error={errors.name?.message}>
                <Input id="name" aria-invalid={!!errors.name} {...form.register('name')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Catégorie" htmlFor="categoryId" error={errors.categoryId?.message}>
                  <NativeSelect id="categoryId" {...form.register('categoryId')}>
                    <option value="">Sans catégorie</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.is_active ? '' : ' (inactive)'}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={`Prix (${currency})`} htmlFor="price" error={errors.price?.message}>
                  <Input
                    id="price"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    aria-invalid={!!errors.price}
                    {...form.register('price', { valueAsNumber: true })}
                  />
                </Field>
              </div>
              <Field
                label={`Prix d’achat (${currency}, facultatif)`}
                htmlFor="costPrice"
                error={errors.costPrice?.message}
                hint={
                  marginHint ?? 'Visible seulement par l’administrateur : sert à calculer la marge dans les rapports.'
                }
              >
                <Input
                  id="costPrice"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="Ex. : 30000"
                  aria-invalid={!!errors.costPrice}
                  {...form.register('costPrice', { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) })}
                />
              </Field>
              <Field label="Description" htmlFor="description" error={errors.description?.message}>
                <Textarea id="description" rows={2} {...form.register('description')} />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border p-4">
            <Controller
              control={form.control}
              name="isAvailable"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="isAvailable" className="flex-col items-start gap-1">
                    Disponible à la vente
                    <span className="text-xs font-normal text-muted-foreground">Affiché à la caisse.</span>
                  </Label>
                  <Switch id="isAvailable" checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="trackStock"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="trackStock" className="flex-col items-start gap-1">
                    Suivre le stock
                    <span className="text-xs font-normal text-muted-foreground">
                      Bloque la vente au-delà de la quantité disponible.
                    </span>
                  </Label>
                  <Switch id="trackStock" checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />
            {trackStock && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Seuil d’alerte (stock minimum)" htmlFor="minimumStock" error={errors.minimumStock?.message}>
                  <Input
                    id="minimumStock"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    {...form.register('minimumStock', { valueAsNumber: true })}
                  />
                </Field>
                {product ? (
                  <div className="grid gap-1.5 text-sm">
                    <span className="font-medium">Stock actuel</span>
                    <span className="text-muted-foreground">
                      {product.stock_quantity} — à modifier depuis la page Stocks (mouvement tracé).
                    </span>
                  </div>
                ) : (
                  <Field label="Stock initial" htmlFor="initialStock" error={errors.initialStock?.message}>
                    <Input
                      id="initialStock"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      {...form.register('initialStock', { valueAsNumber: true })}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
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
