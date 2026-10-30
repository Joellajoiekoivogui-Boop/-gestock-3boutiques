-- =============================================================================
-- MassaGui Fils SARL.U — Migration 3/5 : droits et politiques RLS
--
-- Principe : on part de « rien n'est permis » puis on ouvre au cas par cas.
--   * anon (non connecté) : uniquement get_branding() pour la page de connexion ;
--   * authenticated : lecture selon les politiques ci-dessous, écriture directe
--     limitée aux tables de configuration et réservée aux administrateurs ;
--   * ventes, remboursements, stocks : AUCUNE écriture directe — uniquement via
--     les fonctions create_sale, cancel_sale, refund_sale, record_stock_movement ;
--   * la colonne products.stock_quantity n'est modifiable par personne
--     directement (privilèges de colonnes).
-- La clé service_role n'est utilisée que côté serveur (gestion des comptes).
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

alter table public.profiles enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.payment_methods enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.refunds enable row level security;
alter table public.audit_logs enable row level security;

-- -----------------------------------------------------------------------------
-- Fonctions exposées
-- -----------------------------------------------------------------------------
grant execute on function public.get_branding() to anon, authenticated;

grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.create_sale(jsonb, text, uuid, numeric, text) to authenticated;
grant execute on function public.cancel_sale(uuid, text) to authenticated;
grant execute on function public.refund_sale(uuid, numeric, text) to authenticated;
grant execute on function public.record_stock_movement(uuid, text, integer, text) to authenticated;
grant execute on function public.get_sales_report(date, date) to authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
grant execute on function public.log_admin_event(text, text, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- profiles : chacun lit son profil ; seul un admin lit tout et modifie.
-- Personne ne peut modifier son propre rôle sans être déjà administrateur.
-- -----------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, role, permissions, is_active) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- restaurant_settings
-- -----------------------------------------------------------------------------
grant select on public.restaurant_settings to authenticated;
grant update (
  name, tagline, logo_url, address, phone, email, currency, receipt_footer,
  receipt_format, receipt_prefix, stock_enabled, pos_show_images, timezone
) on public.restaurant_settings to authenticated;

create policy settings_select on public.restaurant_settings
  for select to authenticated
  using ((select public.is_active_user()));

create policy settings_update_admin on public.restaurant_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
grant select, delete on public.categories to authenticated;
grant insert (name, description, sort_order, is_active) on public.categories to authenticated;
grant update (name, description, sort_order, is_active) on public.categories to authenticated;

create policy categories_select on public.categories
  for select to authenticated
  using ((select public.is_active_user()));

create policy categories_insert_admin on public.categories
  for insert to authenticated
  with check ((select public.is_admin()));

create policy categories_update_admin on public.categories
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy categories_delete_admin on public.categories
  for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- products (stock_quantity volontairement absent des privilèges d'écriture)
-- -----------------------------------------------------------------------------
grant select, delete on public.products to authenticated;
grant insert (
  name, description, category_id, price, image_url, is_available, is_archived,
  track_stock, minimum_stock
) on public.products to authenticated;
grant update (
  name, description, category_id, price, image_url, is_available, is_archived,
  track_stock, minimum_stock
) on public.products to authenticated;

create policy products_select on public.products
  for select to authenticated
  using ((select public.is_active_user()));

create policy products_insert_admin on public.products
  for insert to authenticated
  with check ((select public.is_admin()));

create policy products_update_admin on public.products
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- La suppression échoue de toute façon (clé étrangère) si le produit a déjà
-- été vendu ou a un historique de stock : il faut alors l'archiver.
create policy products_delete_admin on public.products
  for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- payment_methods
-- -----------------------------------------------------------------------------
grant select, delete on public.payment_methods to authenticated;
grant insert (code, label, is_active, sort_order) on public.payment_methods to authenticated;
grant update (label, is_active, sort_order) on public.payment_methods to authenticated;

create policy payment_methods_select on public.payment_methods
  for select to authenticated
  using ((select public.is_active_user()));

create policy payment_methods_insert_admin on public.payment_methods
  for insert to authenticated
  with check ((select public.is_admin()));

create policy payment_methods_update_admin on public.payment_methods
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy payment_methods_delete_admin on public.payment_methods
  for delete to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- sales / sale_items / refunds : lecture seule.
-- Un caissier ne voit que ses ventes, sauf permission « view_all_sales ».
-- -----------------------------------------------------------------------------
grant select on public.sales to authenticated;
grant select on public.sale_items to authenticated;
grant select on public.refunds to authenticated;

create policy sales_select on public.sales
  for select to authenticated
  using (
    (select public.is_active_user())
    and (
      cashier_id = (select auth.uid())
      or (select public.has_permission('view_all_sales'))
    )
  );

create policy sale_items_select on public.sale_items
  for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

create policy refunds_select on public.refunds
  for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

-- -----------------------------------------------------------------------------
-- stock_movements : lecture pour les gestionnaires de stock.
-- -----------------------------------------------------------------------------
grant select on public.stock_movements to authenticated;

create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using ((select public.has_permission('manage_stock')));

-- -----------------------------------------------------------------------------
-- audit_logs : lecture réservée aux administrateurs.
-- -----------------------------------------------------------------------------
grant select on public.audit_logs to authenticated;

create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select public.is_admin()));

-- receipt_counters : RLS active, aucune politique, aucun privilège → inaccessible.
