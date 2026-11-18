'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authorizeAdmin } from '@/lib/auth';
import { SHOP_COOKIE } from '@/lib/shop';
import { idSchema } from '@/lib/validation';

/** L'administrateur choisit la boutique affichée (ou « all » pour les deux). */
export async function chooseShopAction(shopId: string): Promise<void> {
  if (!(await authorizeAdmin())) return;
  const store = await cookies();
  if (shopId === 'all') {
    store.delete(SHOP_COOKIE);
  } else if (idSchema.safeParse(shopId).success) {
    store.set(SHOP_COOKIE, shopId, { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath('/', 'layout');
}
