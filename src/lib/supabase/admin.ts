import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// Client « service_role » : contourne RLS. Réservé à la gestion des comptes
// (création, mot de passe, blocage) APRÈS vérification que l'appelant est
// administrateur. Ce module ne peut pas être importé côté navigateur
// (« server-only ») et la clé n'a pas de préfixe NEXT_PUBLIC_.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
