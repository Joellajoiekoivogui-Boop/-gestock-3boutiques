'use server';

import { revalidatePath } from 'next/cache';
import { authorizeAdmin } from '@/lib/auth';
import { DENIED, fail, toUserMessage, type ActionResult } from '@/lib/errors';
import { removeImage, uploadImage } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';
import {
  fieldErrorsOf,
  paymentMethodSchema,
  settingsSchema,
  validateImage,
  type PaymentMethodValues,
  type SettingsFormValues,
} from '@/lib/validation';

function revalidateAll() {
  revalidatePath('/', 'layout');
}

export async function saveSettingsAction(values: SettingsFormValues): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from('restaurant_settings')
    .update({
      name: v.name,
      tagline: v.tagline,
      address: v.address,
      phone: v.phone,
      email: v.email,
      currency: v.currency,
      receipt_footer: v.receiptFooter,
      receipt_format: v.receiptFormat,
      receipt_prefix: v.receiptPrefix,
      stock_enabled: v.stockEnabled,
      pos_show_images: v.posShowImages,
      timezone: v.timezone,
    })
    .eq('id', 1);
  if (error) return fail(toUserMessage(error));
  revalidateAll();
  return { ok: true, data: undefined };
}

export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) return fail('Choisissez une image.');
  const invalid = validateImage(file);
  if (invalid) return fail(invalid);

  const supabase = await createClient();
  const { data: current } = await supabase.from('restaurant_settings').select('logo_url').eq('id', 1).maybeSingle();
  const uploaded = await uploadImage(supabase, 'branding', file);
  if ('error' in uploaded) return fail(uploaded.error);

  const { error } = await supabase.from('restaurant_settings').update({ logo_url: uploaded.url }).eq('id', 1);
  if (error) {
    await removeImage(supabase, 'branding', uploaded.url);
    return fail(toUserMessage(error));
  }
  await removeImage(supabase, 'branding', current?.logo_url);
  revalidateAll();
  return { ok: true, data: undefined };
}

export async function removeLogoAction(): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  const supabase = await createClient();
  const { data: current } = await supabase.from('restaurant_settings').select('logo_url').eq('id', 1).maybeSingle();
  const { error } = await supabase.from('restaurant_settings').update({ logo_url: null }).eq('id', 1);
  if (error) return fail(toUserMessage(error));
  await removeImage(supabase, 'branding', current?.logo_url);
  revalidateAll();
  return { ok: true, data: undefined };
}

export async function savePaymentMethodAction(existingCode: string | null, values: PaymentMethodValues): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  const parsed = paymentMethodSchema.safeParse(values);
  if (!parsed.success) return fail('Vérifiez le formulaire.', fieldErrorsOf(parsed.error));
  const { code, label, isActive, sortOrder } = parsed.data;

  const supabase = await createClient();
  const { error } = existingCode
    ? await supabase.from('payment_methods').update({ label, is_active: isActive, sort_order: sortOrder }).eq('code', existingCode)
    : await supabase.from('payment_methods').insert({ code, label, is_active: isActive, sort_order: sortOrder });
  if (error) {
    if (error.code === '23505') return fail('Ce code existe déjà.', { code: ['Code déjà utilisé.'] });
    return fail(toUserMessage(error));
  }
  revalidatePath('/admin/settings');
  revalidatePath('/pos');
  return { ok: true, data: undefined };
}

export async function deletePaymentMethodAction(code: string): Promise<ActionResult> {
  if (!(await authorizeAdmin())) return fail(DENIED);
  if (!/^[a-z0-9_]{2,32}$/.test(code)) return fail('Mode de paiement invalide.');
  const supabase = await createClient();
  const { error } = await supabase.from('payment_methods').delete().eq('code', code);
  if (error) {
    if (error.code === '23503') return fail('Ce mode a déjà servi à des ventes : désactivez-le au lieu de le supprimer.');
    return fail(toUserMessage(error));
  }
  revalidatePath('/admin/settings');
  revalidatePath('/pos');
  return { ok: true, data: undefined };
}
