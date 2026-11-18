import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getSession } from '@/lib/auth';
import type { ShopRow } from '@/lib/database.types';
import { isAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';

// Boutique choisie par l'administrateur (« all » = les deux boutiques).
export const SHOP_COOKIE = 'boutique';

export type ShopScope = {
  /** Boutiques visibles (vide tant que la base n'a pas les boutiques). */
  shops: Pick<ShopRow, 'id' | 'name' | 'is_active'>[];
  /** Boutique en cours ; null = toutes (administrateur) ou base sans boutiques. */
  current: Pick<ShopRow, 'id' | 'name' | 'is_active'> | null;
  /** L'utilisateur peut changer de boutique (administrateur). */
  canChoose: boolean;
};

export const getShopScope = cache(async (): Promise<ShopScope> => {
  const session = await getSession();
  const supabase = await createClient();
  const { data, error } = await supabase.from('shops').select('id, name, is_active').order('sort_order').order('name');
  // Base pas encore mise à jour : l'application marche comme avant, sans boutiques.
  const shops = error ? [] : (data ?? []);
  const admin = !!session && isAdmin(session.profile);
  if (!admin) {
    const own = shops.find((s) => s.id === session?.profile.shop_id) ?? null;
    return { shops, current: own, canChoose: false };
  }
  const chosen = (await cookies()).get(SHOP_COOKIE)?.value;
  return { shops, current: shops.find((s) => s.id === chosen) ?? null, canChoose: shops.length > 1 };
});

/** Identifiant de la boutique à filtrer, ou null pour ne pas filtrer. */
export async function shopFilter(): Promise<string | null> {
  return (await getShopScope()).current?.id ?? null;
}

/** Nom de chaque boutique, pour les reçus et les listes. */
export async function shopNames(): Promise<Map<string, string>> {
  const { shops } = await getShopScope();
  return new Map(shops.map((s) => [s.id, s.name]));
}
