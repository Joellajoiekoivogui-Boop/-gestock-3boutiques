'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAdmin } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { categorySchema, fieldErrorsOf, idSchema, type CategoryFormValues } from '@/lib/validation';

function revalidate() {
  revalidatePath('/admin/categories');
  revalidatePath('/admin/products');
  revalidatePath('/pos');
}

export async function saveCategoryAction(id: string | null, values: CategoryFormValues): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  if (id && !idSchema.safeParse(id).success) return fail('Catégorie invalide.');
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));

  const record = {
    name: parsed.data.name,
    description: parsed.data.description,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('categories').update(record).eq('id', id)
    : await supabase.from('categories').insert(record);
  if (error) {
    if (error.code === '23505') return fail('Une catégorie porte déjà ce nom.', { name: ['Nom déjà utilisé.'] });
    return fail(toUserMessage(error));
  }
  revalidate();
  return { ok: true, data: undefined };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  if (!idSchema.safeParse(id).success) return fail('Catégorie invalide.');
  const supabase = await createClient();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return fail('Des produits utilisent cette catégorie : déplacez-les ou désactivez la catégorie.');
    }
    return fail(toUserMessage(error));
  }
  revalidate();
  return { ok: true, data: undefined };
}
