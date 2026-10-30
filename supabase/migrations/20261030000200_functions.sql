-- =============================================================================
-- MassaGui Fils SARL.U — Migration 2/5 : fonctions et déclencheurs
--
-- Toutes les opérations financières (vente, annulation, remboursement,
-- mouvements de stock) passent par des fonctions PostgreSQL SECURITY DEFINER :
--   * elles s'exécutent dans UNE transaction (tout ou rien) ;
--   * elles vérifient elles-mêmes l'identité (auth.uid()) et les permissions ;
--   * elles recalculent les montants à partir des prix en base ;
--   * elles verrouillent les lignes concernées (FOR UPDATE) pour que deux
--     ventes simultanées ne puissent pas vendre le même stock.
-- Les messages d'erreur métier (code P0001) sont rédigés pour l'utilisateur.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions d'accès (utilisées par les politiques RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'admin'
  );
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active
      and (role = 'admin' or p_permission = any (permissions))
  );
$$;

-- Nom affichable de l'utilisateur courant (pour les instantanés).
create or replace function public.current_user_name()
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(full_name), ''), email, 'Utilisateur')
  from public.profiles
  where id = auth.uid();
$$;

-- Écriture interne dans le journal d'activité.
create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.audit_logs (user_id, user_name, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    coalesce(public.current_user_name(), 'Système'),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_details, '{}'::jsonb)
  );
$$;

-- Journalisation d'une action d'administration réalisée hors base
-- (création de compte, réinitialisation de mot de passe via Supabase Auth).
-- Réservée aux administrateurs ; l'auteur est toujours l'appelant.
create or replace function public.log_admin_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;
  if p_action !~ '^[a-z_]+\.[a-z_]+$' or char_length(p_entity_type) > 40 or char_length(p_entity_id) > 64 then
    raise exception 'Événement invalide.' using errcode = 'P0001';
  end if;
  perform public.write_audit_log(p_action, p_entity_type, p_entity_id, p_details);
end;
$$;

-- -----------------------------------------------------------------------------
-- Déclencheurs génériques
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger restaurant_settings_set_updated_at before update on public.restaurant_settings
  for each row execute function public.set_updated_at();

-- Tables en ajout seul : aucune modification ni suppression, même par un admin.
create or replace function public.prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Les données de « % » ne peuvent être ni modifiées ni supprimées.', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.prevent_modification();
create trigger stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function public.prevent_modification();
create trigger refunds_append_only before update or delete on public.refunds
  for each row execute function public.prevent_modification();
create trigger sale_items_append_only before update or delete on public.sale_items
  for each row execute function public.prevent_modification();

-- Une vente validée est figée : seuls son statut, le montant remboursé et les
-- informations d'annulation peuvent évoluer (via cancel_sale / refund_sale).
create or replace function public.protect_sale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Une vente ne peut pas être supprimée : utilisez l''annulation ou le remboursement.'
      using errcode = '42501';
  end if;

  if new.receipt_number is distinct from old.receipt_number
     or new.cashier_id is distinct from old.cashier_id
     or new.cashier_name is distinct from old.cashier_name
     or new.subtotal is distinct from old.subtotal
     or new.discount_amount is distinct from old.discount_amount
     or new.total_amount is distinct from old.total_amount
     or new.payment_method is distinct from old.payment_method
     or new.payment_method_label is distinct from old.payment_method_label
     or new.item_count is distinct from old.item_count
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'Le contenu financier d''une vente validée ne peut pas être modifié.'
      using errcode = '42501';
  end if;

  if old.sale_status = 'cancelled' then
    raise exception 'Une vente annulée ne peut plus être modifiée.' using errcode = '42501';
  end if;

  if new.refunded_amount < old.refunded_amount then
    raise exception 'Le montant remboursé ne peut pas diminuer.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger sales_protect before update or delete on public.sales
  for each row execute function public.protect_sale();

-- -----------------------------------------------------------------------------
-- Comptes : création automatique du profil, protection du dernier admin
-- -----------------------------------------------------------------------------
-- Tout nouveau compte d'authentification reçoit un profil « caissier »
-- INACTIF. Même si l'inscription publique était activée par erreur dans
-- Supabase, le compte n'aurait accès à rien tant qu'un administrateur ne l'a
-- pas activé.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    'cashier',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1 from public.profiles
      where id <> old.id and role = 'admin' and is_active
    ) then
      raise exception 'Impossible : il doit rester au moins un administrateur actif.'
        using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_last_admin before update or delete on public.profiles
  for each row execute function public.protect_last_admin();

-- Vérifie que le fuseau horaire configuré existe.
create or replace function public.validate_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception
  when invalid_parameter_value then
    raise exception 'Fuseau horaire inconnu : %', new.timezone using errcode = 'P0001';
end;
$$;

create trigger restaurant_settings_validate before insert or update on public.restaurant_settings
  for each row execute function public.validate_settings();

-- -----------------------------------------------------------------------------
-- Journalisation automatique des changements de configuration
-- (produits, catégories, modes de paiement, paramètres, comptes).
-- -----------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_id text;
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at', 'stock_quantity')
         and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
        );
      end if;
    end loop;
    -- Les variations de stock ont leur propre journal (stock_movements).
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'code', v_old ->> 'code');

  perform public.write_audit_log(
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_id,
    case tg_op
      when 'UPDATE' then jsonb_build_object('changes', v_changes)
      when 'INSERT' then jsonb_build_object('record', v_new)
      else jsonb_build_object('record', v_old)
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.audit_row_change();
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function public.audit_row_change();
create trigger payment_methods_audit after insert or update or delete on public.payment_methods
  for each row execute function public.audit_row_change();
create trigger restaurant_settings_audit after update on public.restaurant_settings
  for each row execute function public.audit_row_change();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- Données publiques de marque (page de connexion, accessible sans session)
-- -----------------------------------------------------------------------------
create or replace function public.get_branding()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('name', name, 'tagline', tagline, 'logo_url', logo_url)
     from public.restaurant_settings where id = 1),
    jsonb_build_object('name', 'MassaGui Fils SARL.U', 'tagline', null, 'logo_url', null)
  );
$$;

-- -----------------------------------------------------------------------------
-- VENTE : création atomique
--   p_items : [{"product_id": "<uuid>", "quantity": 2}, ...]
--   Les prix envoyés par le navigateur sont ignorés : seuls les prix en base
--   font foi. Renvoie {sale_id, receipt_number, total_amount, replayed}.
-- -----------------------------------------------------------------------------
create or replace function public.create_sale(
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key uuid,
  p_discount_amount numeric default 0,
  p_note text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_settings public.restaurant_settings%rowtype;
  v_existing public.sales%rowtype;
  v_method public.payment_methods%rowtype;
  v_line record;
  v_product record;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric(14, 0) := 0;
  v_discount numeric(14, 0);
  v_item_count integer := 0;
  v_sale_id uuid;
  v_year integer;
  v_seq bigint;
  v_receipt text;
  v_stock_after integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or not v_profile.is_active then
    raise exception 'Votre compte est inactif. Contactez l''administrateur.' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'Requête invalide : identifiant de transaction manquant.' using errcode = '22023';
  end if;

  -- Sérialise les requêtes portant la même clé (double clic, renvoi réseau).
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing from public.sales where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.cashier_id <> v_uid then
      raise exception 'Identifiant de transaction déjà utilisé.' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'sale_id', v_existing.id,
      'receipt_number', v_existing.receipt_number,
      'total_amount', v_existing.total_amount,
      'replayed', true
    );
  end if;

  -- Validation du panier
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Le panier contient trop de lignes (200 maximum).' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    where x.product_id is null or x.quantity is null or x.quantity <= 0 or x.quantity > 10000
  ) then
    raise exception 'Une ligne du panier est invalide (produit ou quantité).' using errcode = 'P0001';
  end if;

  if p_discount_amount is null or p_discount_amount < 0 or p_discount_amount <> trunc(p_discount_amount) then
    raise exception 'Le montant de la remise est invalide.' using errcode = 'P0001';
  end if;
  v_discount := p_discount_amount;
  if v_discount > 0 and not public.has_permission('apply_discount') then
    raise exception 'Vous n''êtes pas autorisé à appliquer une remise.' using errcode = '42501';
  end if;

  select * into v_method from public.payment_methods where code = p_payment_method and is_active;
  if not found then
    raise exception 'Mode de paiement invalide ou désactivé.' using errcode = 'P0001';
  end if;

  select * into v_settings from public.restaurant_settings where id = 1;
  if not found then
    raise exception 'Paramètres de l''établissement manquants.' using errcode = 'P0001';
  end if;

  -- Lecture des produits avec verrou, dans un ordre stable (évite les
  -- interblocages entre ventes simultanées). Les quantités d'un même produit
  -- présent sur plusieurs lignes sont additionnées.
  for v_line in
    select x.product_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id
    order by x.product_id
  loop
    select p.id, p.name, p.price, p.is_available, p.is_archived, p.track_stock,
           p.stock_quantity, c.name as category_name
      into v_product
      from public.products p
      left join public.categories c on c.id = p.category_id
     where p.id = v_line.product_id
       for update of p;

    if not found then
      raise exception 'Un produit du panier n''existe plus.' using errcode = 'P0001';
    end if;
    if not v_product.is_available or v_product.is_archived then
      raise exception 'Le produit « % » n''est plus disponible.', v_product.name using errcode = 'P0001';
    end if;
    if v_line.quantity > 10000 then
      raise exception 'Quantité trop élevée pour « % ».', v_product.name using errcode = 'P0001';
    end if;
    if v_settings.stock_enabled and v_product.track_stock
       and v_product.stock_quantity < v_line.quantity then
      raise exception 'Stock insuffisant pour « % » (disponible : %).',
        v_product.name, v_product.stock_quantity using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + v_product.price * v_line.quantity;
    v_item_count := v_item_count + v_line.quantity;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'category_name', v_product.category_name,
      'unit_price', v_product.price,
      'quantity', v_line.quantity,
      'track', v_settings.stock_enabled and v_product.track_stock
    ));
  end loop;

  if v_discount > v_subtotal then
    raise exception 'La remise ne peut pas dépasser le sous-total.' using errcode = 'P0001';
  end if;

  -- Numéro de reçu : compteur annuel verrouillé dans cette transaction.
  v_year := extract(year from (now() at time zone v_settings.timezone))::integer;
  insert into public.receipt_counters as rc (year, last_value)
  values (v_year, 1)
  on conflict (year) do update set last_value = rc.last_value + 1
  returning last_value into v_seq;

  v_receipt := v_settings.receipt_prefix || '-' || v_year::text || '-'
    || lpad(v_seq::text, greatest(6, length(v_seq::text)), '0');

  insert into public.sales (
    receipt_number, cashier_id, cashier_name, subtotal, discount_amount, total_amount,
    payment_method, payment_method_label, payment_status, sale_status, item_count, note,
    idempotency_key
  ) values (
    v_receipt, v_uid, coalesce(public.current_user_name(), 'Caissier'), v_subtotal, v_discount,
    v_subtotal - v_discount, v_method.code, v_method.label, 'paid', 'completed', v_item_count,
    left(v_note, 500), p_idempotency_key
  )
  returning id into v_sale_id;

  for v_line in
    select * from jsonb_to_recordset(v_lines) as x(
      product_id uuid, product_name text, category_name text,
      unit_price numeric, quantity integer, track boolean
    )
  loop
    insert into public.sale_items (
      sale_id, product_id, product_name, category_name, unit_price, quantity, line_total
    ) values (
      v_sale_id, v_line.product_id, v_line.product_name, v_line.category_name,
      v_line.unit_price, v_line.quantity, v_line.unit_price * v_line.quantity
    );

    if v_line.track then
      -- La contrainte CHECK (stock_quantity >= 0) interdit tout stock négatif.
      update public.products
         set stock_quantity = stock_quantity - v_line.quantity
       where id = v_line.product_id
      returning stock_quantity into v_stock_after;

      insert into public.stock_movements (
        product_id, movement_type, quantity, stock_after, reason, sale_id, user_id
      ) values (
        v_line.product_id, 'sale', -v_line.quantity, v_stock_after,
        'Vente ' || v_receipt, v_sale_id, v_uid
      );
    end if;
  end loop;

  perform public.write_audit_log(
    'sale.created', 'sales', v_sale_id::text,
    jsonb_build_object(
      'receipt_number', v_receipt,
      'total_amount', v_subtotal - v_discount,
      'discount_amount', v_discount,
      'payment_method', v_method.code
    )
  );

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'receipt_number', v_receipt,
    'total_amount', v_subtotal - v_discount,
    'replayed', false
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- ANNULATION d'une vente (motif obligatoire, stock réintégré)
-- -----------------------------------------------------------------------------
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_item record;
  v_stock_after integer;
begin
  if not public.has_permission('cancel_sales') then
    raise exception 'Vous n''êtes pas autorisé à annuler une vente.' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Le motif d''annulation est obligatoire (3 à 500 caractères).' using errcode = 'P0001';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Vente introuvable.' using errcode = 'P0001';
  end if;
  if v_sale.sale_status = 'cancelled' then
    raise exception 'Cette vente est déjà annulée.' using errcode = 'P0001';
  end if;
  if v_sale.sale_status <> 'completed' then
    raise exception 'Une vente déjà remboursée (même partiellement) ne peut plus être annulée.'
      using errcode = 'P0001';
  end if;

  -- Réintègre exactement ce qui avait été sorti du stock lors de la vente.
  for v_item in
    select product_id, -sum(quantity)::integer as quantity
    from public.stock_movements
    where sale_id = p_sale_id and movement_type = 'sale'
    group by product_id
    order by product_id
  loop
    if v_item.quantity > 0 then
      update public.products
         set stock_quantity = stock_quantity + v_item.quantity
       where id = v_item.product_id
      returning stock_quantity into v_stock_after;

      insert into public.stock_movements (
        product_id, movement_type, quantity, stock_after, reason, sale_id, user_id
      ) values (
        v_item.product_id, 'sale_cancel', v_item.quantity, v_stock_after,
        'Annulation ' || v_sale.receipt_number, p_sale_id, v_uid
      );
    end if;
  end loop;

  update public.sales
     set sale_status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_uid,
         cancel_reason = v_reason
   where id = p_sale_id;

  perform public.write_audit_log(
    'sale.cancelled', 'sales', p_sale_id::text,
    jsonb_build_object(
      'receipt_number', v_sale.receipt_number,
      'total_amount', v_sale.total_amount,
      'reason', v_reason
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- REMBOURSEMENT (total ou partiel, motif obligatoire)
-- Le remboursement ne modifie pas le stock : utilisez un ajustement si des
-- produits reviennent réellement en stock.
-- -----------------------------------------------------------------------------
create or replace function public.refund_sale(p_sale_id uuid, p_amount numeric, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_remaining numeric(14, 0);
  v_new_refunded numeric(14, 0);
  v_status public.sale_status;
  v_refund_id uuid;
begin
  if not public.has_permission('refund_sales') then
    raise exception 'Vous n''êtes pas autorisé à rembourser une vente.' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Le motif du remboursement est obligatoire (3 à 500 caractères).' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'Le montant du remboursement est invalide.' using errcode = 'P0001';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Vente introuvable.' using errcode = 'P0001';
  end if;
  if v_sale.sale_status not in ('completed', 'partially_refunded') then
    raise exception 'Cette vente ne peut plus être remboursée.' using errcode = 'P0001';
  end if;

  v_remaining := v_sale.total_amount - v_sale.refunded_amount;
  if p_amount > v_remaining then
    raise exception 'Le remboursement dépasse le montant restant (% maximum).', v_remaining
      using errcode = 'P0001';
  end if;

  v_new_refunded := v_sale.refunded_amount + p_amount;
  v_status := case when v_new_refunded = v_sale.total_amount then 'refunded' else 'partially_refunded' end;

  insert into public.refunds (sale_id, amount, reason, user_id)
  values (p_sale_id, p_amount, v_reason, v_uid)
  returning id into v_refund_id;

  update public.sales
     set refunded_amount = v_new_refunded,
         sale_status = v_status
   where id = p_sale_id;

  perform public.write_audit_log(
    'sale.refunded', 'sales', p_sale_id::text,
    jsonb_build_object(
      'receipt_number', v_sale.receipt_number,
      'amount', p_amount,
      'refunded_total', v_new_refunded,
      'reason', v_reason
    )
  );

  return jsonb_build_object('refund_id', v_refund_id, 'sale_status', v_status, 'refunded_amount', v_new_refunded);
end;
$$;

-- -----------------------------------------------------------------------------
-- STOCK : approvisionnement ou ajustement (traçé, jamais négatif)
-- -----------------------------------------------------------------------------
create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text default null
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_new_stock integer;
begin
  if not public.has_permission('manage_stock') then
    raise exception 'Vous n''êtes pas autorisé à modifier les stocks.' using errcode = '42501';
  end if;
  if p_movement_type not in ('restock', 'adjustment') then
    raise exception 'Type de mouvement invalide.' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity = 0 or abs(p_quantity) > 1000000 then
    raise exception 'La quantité est invalide.' using errcode = 'P0001';
  end if;
  if p_movement_type = 'restock' and p_quantity < 0 then
    raise exception 'Un approvisionnement doit avoir une quantité positive.' using errcode = 'P0001';
  end if;
  if p_movement_type = 'adjustment' and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'Le motif de l''ajustement est obligatoire.' using errcode = 'P0001';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Le motif est trop long (500 caractères maximum).' using errcode = 'P0001';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produit introuvable.' using errcode = 'P0001';
  end if;
  if not v_product.track_stock then
    raise exception 'Le suivi de stock n''est pas activé pour « % ».', v_product.name using errcode = 'P0001';
  end if;

  v_new_stock := v_product.stock_quantity + p_quantity;
  if v_new_stock < 0 then
    raise exception 'Le stock ne peut pas devenir négatif (disponible : %).', v_product.stock_quantity
      using errcode = 'P0001';
  end if;

  update public.products set stock_quantity = v_new_stock where id = p_product_id;

  insert into public.stock_movements (product_id, movement_type, quantity, stock_after, reason, user_id)
  values (p_product_id, p_movement_type::public.stock_movement_type, p_quantity, v_new_stock, v_reason, v_uid);

  perform public.write_audit_log(
    'stock.' || p_movement_type, 'products', p_product_id::text,
    jsonb_build_object(
      'product_name', v_product.name,
      'quantity', p_quantity,
      'stock_after', v_new_stock,
      'reason', v_reason
    )
  );

  return v_new_stock;
end;
$$;

-- -----------------------------------------------------------------------------
-- STATISTIQUES
-- Définitions (affichées aussi dans l'application) :
--   ventes brutes   = somme des totaux des ventes NON annulées, datées dans la période ;
--   remboursements  = somme des remboursements effectués dans la période ;
--   CA net          = ventes brutes − remboursements ;
--   ventes annulées = exclues du chiffre d'affaires, comptées à part ;
--   panier moyen    = ventes brutes / nombre de ventes non annulées.
-- Les dates (p_from, p_to inclus) sont interprétées dans le fuseau de
-- l'établissement.
-- -----------------------------------------------------------------------------
create or replace function public.get_sales_report(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  if not public.has_permission('view_reports') then
    raise exception 'Vous n''êtes pas autorisé à consulter les rapports.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Période invalide.' using errcode = 'P0001';
  end if;
  if p_to - p_from > 366 then
    raise exception 'La période ne peut pas dépasser un an.' using errcode = 'P0001';
  end if;

  select timezone into v_tz from public.restaurant_settings where id = 1;
  v_tz := coalesce(v_tz, 'Africa/Conakry');
  v_from := p_from::timestamp at time zone v_tz;
  v_to := (p_to + 1)::timestamp at time zone v_tz;

  with period_sales as (
    select * from public.sales where created_at >= v_from and created_at < v_to
  ),
  valid_sales as (
    select * from period_sales where sale_status <> 'cancelled'
  ),
  period_refunds as (
    select r.*, s.payment_method, s.payment_method_label, s.cashier_id
    from public.refunds r
    join public.sales s on s.id = r.sale_id
    where r.created_at >= v_from and r.created_at < v_to
  ),
  valid_items as (
    select si.* from public.sale_items si join valid_sales vs on vs.id = si.sale_id
  ),
  days as (
    select d::date as day
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
  ),
  sales_by_day as (
    select (created_at at time zone v_tz)::date as day,
           sum(total_amount) as gross, count(*) as cnt
    from valid_sales group by 1
  ),
  refunds_by_day as (
    select (created_at at time zone v_tz)::date as day, sum(amount) as refunds
    from period_refunds group by 1
  ),
  totals as (
    select coalesce(sum(total_amount), 0) as gross,
           coalesce(sum(discount_amount), 0) as discounts,
           count(*) as cnt
    from valid_sales
  ),
  refund_totals as (
    select coalesce(sum(amount), 0) as refunds, count(*) as cnt from period_refunds
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'timezone', v_tz,
    'gross_sales', t.gross,
    'refunds_total', rt.refunds,
    'refunds_count', rt.cnt,
    'net_revenue', t.gross - rt.refunds,
    'discount_total', t.discounts,
    'sales_count', t.cnt,
    'average_basket', case when t.cnt > 0 then round(t.gross / t.cnt) else 0 end,
    'items_sold', coalesce((select sum(quantity) from valid_items), 0),
    'cancelled_count', (select count(*) from period_sales where sale_status = 'cancelled'),
    'cancelled_amount', coalesce((select sum(total_amount) from period_sales where sale_status = 'cancelled'), 0),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'gross', coalesce(sd.gross, 0),
        'refunds', coalesce(rd.refunds, 0),
        'net', coalesce(sd.gross, 0) - coalesce(rd.refunds, 0),
        'count', coalesce(sd.cnt, 0)
      ) order by d.day)
      from days d
      left join sales_by_day sd on sd.day = d.day
      left join refunds_by_day rd on rd.day = d.day
    ), '[]'::jsonb),
    'by_payment_method', coalesce((
      select jsonb_agg(row_to_json(x) order by x.gross desc)
      from (
        select m.code, m.label,
               coalesce(s.cnt, 0) as count,
               coalesce(s.gross, 0) as gross,
               coalesce(r.refunds, 0) as refunds,
               coalesce(s.gross, 0) - coalesce(r.refunds, 0) as net
        from (
          select payment_method as code, max(payment_method_label) as label from valid_sales group by 1
          union
          select payment_method, max(payment_method_label) from period_refunds group by 1
        ) m
        left join (
          select payment_method, count(*) as cnt, sum(total_amount) as gross
          from valid_sales group by 1
        ) s on s.payment_method = m.code
        left join (
          select payment_method, sum(amount) as refunds from period_refunds group by 1
        ) r on r.payment_method = m.code
      ) x
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(row_to_json(x) order by x.quantity desc, x.revenue desc)
      from (
        select product_id, max(product_name) as name,
               sum(quantity) as quantity, sum(line_total) as revenue
        from valid_items
        group by product_id
        order by sum(quantity) desc, sum(line_total) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(row_to_json(x) order by x.revenue desc)
      from (
        select coalesce(category_name, 'Sans catégorie') as name,
               sum(quantity) as quantity, sum(line_total) as revenue
        from valid_items
        group by 1
      ) x
    ), '[]'::jsonb),
    'by_cashier', coalesce((
      select jsonb_agg(row_to_json(x) order by x.gross desc)
      from (
        select c.cashier_id, c.name,
               coalesce(s.cnt, 0) as count,
               coalesce(s.gross, 0) as gross,
               coalesce(r.refunds, 0) as refunds,
               coalesce(s.gross, 0) - coalesce(r.refunds, 0) as net,
               coalesce(k.cancelled, 0) as cancelled_count
        from (
          select cashier_id, max(cashier_name) as name from period_sales group by 1
        ) c
        left join (
          select cashier_id, count(*) as cnt, sum(total_amount) as gross
          from valid_sales group by 1
        ) s on s.cashier_id = c.cashier_id
        left join (
          select cashier_id, sum(amount) as refunds from period_refunds group by 1
        ) r on r.cashier_id = c.cashier_id
        left join (
          select cashier_id, count(*) as cancelled
          from period_sales where sale_status = 'cancelled' group by 1
        ) k on k.cashier_id = c.cashier_id
      ) x
    ), '[]'::jsonb)
  )
  into v_result
  from totals t, refund_totals rt;

  return v_result;
end;
$$;

-- Résumé du tableau de bord : CA net du jour, de la semaine (lundi → aujourd'hui)
-- et du mois, plus les compteurs du catalogue.
create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs.' using errcode = '42501';
  end if;

  select timezone into v_tz from public.restaurant_settings where id = 1;
  v_tz := coalesce(v_tz, 'Africa/Conakry');
  v_today := (now() at time zone v_tz)::date;

  with bounds as (
    select 'today' as period, v_today as start_day
    union all select 'week', date_trunc('week', v_today::timestamp)::date
    union all select 'month', date_trunc('month', v_today::timestamp)::date
  ),
  figures as (
    select b.period,
      coalesce((
        select sum(s.total_amount) from public.sales s
        where s.sale_status <> 'cancelled'
          and s.created_at >= b.start_day::timestamp at time zone v_tz
          and s.created_at < (v_today + 1)::timestamp at time zone v_tz
      ), 0) as gross,
      coalesce((
        select count(*) from public.sales s
        where s.sale_status <> 'cancelled'
          and s.created_at >= b.start_day::timestamp at time zone v_tz
          and s.created_at < (v_today + 1)::timestamp at time zone v_tz
      ), 0) as cnt,
      coalesce((
        select sum(r.amount) from public.refunds r
        where r.created_at >= b.start_day::timestamp at time zone v_tz
          and r.created_at < (v_today + 1)::timestamp at time zone v_tz
      ), 0) as refunds
    from bounds b
  )
  select jsonb_build_object(
    'today', v_today,
    'timezone', v_tz,
    'periods', (
      select jsonb_object_agg(period, jsonb_build_object(
        'gross', gross, 'refunds', refunds, 'net', gross - refunds, 'count', cnt
      ))
      from figures
    ),
    'active_products', (
      select count(*) from public.products where is_available and not is_archived
    ),
    'low_stock_products', (
      select count(*) from public.products p, public.restaurant_settings rs
      where rs.id = 1 and rs.stock_enabled and p.track_stock and not p.is_archived
        and p.stock_quantity <= p.minimum_stock
    )
  ) into v_result;

  return v_result;
end;
$$;
