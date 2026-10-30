'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAdmin } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { removeImage, uploadImage } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';
import { fieldErrorsOf, idSchema, productSchema, validateImage } from '@/lib/validation';

function revalidateCatalog() {
  revalidatePath('/admin/products');
  revalidatePath('/admin/inventory');
  revalidatePath('/pos');
}

const num = (v: FormDataEntryValue | null) => (v === null || v === '' ? Number.NaN : Number(v));

export async function saveProductAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  if (!(await authorizeAdmin())) return fail(DENIED);

  const rawId = formData.get('id');
  const id = typeof rawId === 'string' && rawId ? rawId : null;
  if (id && !idSchema.safeParse(id).success) return fail('Produit invalide.');

  const parsed = productSchema.safeParse({
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    categoryId: formData.get('categoryId') ?? '',
    price: num(formData.get('price')),
    isAvailable: formData.get('isAvailable') === 'true',
    trackStock: formData.get('trackStock') === 'true',
    minimumStock: num(formData.get('minimumStock')),
    initialStock: formData.get('initialStock') ? num(formData.get('initialStock')) : undefined,
  });
  if (!parsed.success) return fail('Vérifiez les champs du formulaire.', fieldErrorsOf(parsed.error));
  const values = parsed.data;

  const image = formData.get('image');
  const file = image instanceof File && image.size > 0 ? image : null;
  const imageError = validateImage(file);
  if (imageError) return fail(imageError, { image: [imageError] });

  const supabase = await createClient();

  let previousImage: string | null = null;
  if (id) {
    const { data: existing, error } = await supabase.from('products').select('image_url').eq('id', id).maybeSingle();
    if (error) return fail(toUserMessage(error));
    if (!existing) return fail('Produit introuvable.');
    previousImage = existing.image_url;
  }

  let imageUrl: string | null | undefined;
  if (file) {
    const uploaded = await uploadImage(supabase, 'product-images', file);
    if ('error' in uploaded) return fail(uploaded.error, { image: [uploaded.error] });
    imageUrl = uploaded.url;
  } else if (formData.get('removeImage') === 'true') {
    imageUrl = null;
  }

  const record = {
    name: values.name,
    description: values.description,
    category_id: values.categoryId,
    price: values.price,
    is_available: values.isAvailable,
    track_stock: values.trackStock,
    minimum_stock: values.minimumStock,
    ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
  };

  let productId = id;
  if (id) {
    const { error } = await supabase.from('products').update(record).eq('id', id);
    if (error) return fail(toUserMessage(error));
  } else {
    const { data, error } = await supabase.from('products').insert(record).select('id').single();
    if (error || !data) return fail(toUserMessage(error));
    productId = data.id;

    if (values.trackStock && values.initialStock && values.initialStock > 0) {
      const { error: stockError } = await supabase.rpc('record_stock_movement', {
        p_product_id: data.id,
        p_movement_type: 'restock',
        p_quantity: values.initialStock,
        p_reason: 'Stock initial',
      });
      if (stockError) {
        revalidateCatalog();
        return fail(`Produit créé, mais le stock initial n’a pas été enregistré : ${toUserMessage(stockError)}`);
      }
    }
  }

  if (imageUrl !== undefined && previousImage && previousImage !== imageUrl) {
    await removeImage(supabase, 'product-images', previousImage);
  }

  revalidateCatalog();
  return { ok: true, data: { id: productId! } };
}

export async function setProductFlagAction(
  id: string,
  flag: 'is_available' | 'is_archived',
  value: boolean,
): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  if (!idSchema.safeParse(id).success) return fail('Produit invalide.');
  if (flag !== 'is_available' && flag !== 'is_archived') return fail('Action invalide.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update(flag === 'is_archived' ? { is_archived: value } : { is_available: value })
    .eq('id', id);
  if (error) return fail(toUserMessage(error));
  revalidateCatalog();
  return { ok: true, data: undefined };
}

// Suppression définitive : seulement si le produit n'a aucun historique
// (ventes, mouvements de stock). Sinon la base refuse et on propose l'archivage.
export async function deleteProductAction(id: string): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  if (!idSchema.safeParse(id).success) return fail('Produit invalide.');

  const supabase = await createClient();
  const { data: product } = await supabase.from('products').select('image_url').eq('id', id).maybeSingle();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return fail('Ce produit a un historique (ventes ou stock) : il ne peut pas être supprimé. Archivez-le à la place.');
    }
    return fail(toUserMessage(error));
  }
  await removeImage(supabase, 'product-images', product?.image_url);
  revalidateCatalog();
  return { ok: true, data: undefined };
}
