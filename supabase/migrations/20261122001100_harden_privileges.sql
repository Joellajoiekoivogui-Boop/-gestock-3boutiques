-- =============================================================================
-- Durcissement des droits : sur Supabase, toute nouvelle table reçoit par
-- défaut tous les droits pour anon et authenticated. Les politiques RLS
-- bloquaient déjà l'accès aux lignes ; on retire en plus les droits inutiles
-- sur les tables ajoutées depuis (boutiques, dossiers clients, dépenses) et on
-- ne rend que ce dont l'application a besoin.
-- =============================================================================

revoke all on public.shops, public.customers, public.expenses from anon, authenticated;

grant select on public.shops to authenticated;
grant update (name, sort_order, is_active) on public.shops to authenticated;

grant select on public.customers to authenticated;
grant update (name, phone, note, is_active) on public.customers to authenticated;

grant select, delete on public.expenses to authenticated;

grant all on public.shops, public.customers, public.expenses to service_role;

-- Fonctions de déclencheur et utilitaires : inutiles à appeler directement.
revoke all on function public.protect_sale_customer() from public, anon, authenticated;
revoke all on function public.protect_sale_shop() from public, anon, authenticated;
revoke all on function public.day_start() from public, anon;
grant execute on function public.day_start() to authenticated;
