-- =============================================================================
-- Boutiques : « Nabele Plus 1 » et « Nabele Plus 2 ».
--   * chaque boutique a ses propres produits, prix et stock ;
--   * chaque vente appartient à une boutique ;
--   * un caissier est rattaché à une seule boutique et ne voit qu'elle ;
--   * l'administrateur voit et gère les deux ;
--   * les dossiers clients (crédits) restent communs aux deux boutiques.
-- Ce qui existait déjà (produits, ventes, caissiers) est rangé dans Nabele Plus 1.
-- =============================================================================

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists shops_name_unique on public.shops (lower(btrim(name)));

insert into public.shops (id, name, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Nabele Plus 1', 1),
  ('00000000-0000-4000-8000-000000000002', 'Nabele Plus 2', 2)
on conflict (id) do nothing;

create trigger shops_set_updated_at before update on public.shops
  for each row execute function public.set_updated_at();
create trigger shops_audit after insert or update or delete on public.shops
  for each row execute function public.audit_row_change();

-- Rattachements. La valeur par défaut remplit les lignes existantes sans
-- déclencher les protections des ventes, puis elle est retirée : chaque
-- nouvelle ligne devra indiquer sa boutique.
alter table public.products add column if not exists shop_id uuid not null default '00000000-0000-4000-8000-000000000001'
  references public.shops (id) on delete restrict;
alter table public.products alter column shop_id drop default;
create index if not exists products_shop_idx on public.products (shop_id, is_archived, is_available);

alter table public.sales add column if not exists shop_id uuid not null default '00000000-0000-4000-8000-000000000001'
  references public.shops (id) on delete restrict;
alter table public.sales alter column shop_id drop default;
create index if not exists sales_shop_idx on public.sales (shop_id, created_at desc);

alter table public.profiles add column if not exists shop_id uuid
  references public.shops (id) on delete set null;
update public.profiles set shop_id = '00000000-0000-4000-8000-000000000001' where role <> 'admin' and shop_id is null;

-- La boutique d'une vente ne change jamais.
create or replace function public.protect_sale_shop()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.shop_id is distinct from old.shop_id then
    raise exception 'La boutique d''une vente ne peut pas être changée.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger sales_protect_shop before update on public.sales
  for each row execute function public.protect_sale_shop();

-- -----------------------------------------------------------------------------
-- Aides : boutique de l'utilisateur, droit de voir une boutique.
-- -----------------------------------------------------------------------------
create or replace function public.current_shop_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select shop_id from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.can_see_shop(p_shop_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or (p_shop_id is not null and p_shop_id = public.current_shop_id());
$$;

-- Boutique d'un rapport : l'administrateur choisit (null = toutes) ;
-- un autre compte est toujours limité à sa boutique.
create or replace function public.report_shop(p_shop_id uuid)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_own uuid;
begin
  if public.is_admin() then
    return p_shop_id;
  end if;
  v_own := public.current_shop_id();
  if v_own is null or (p_shop_id is not null and p_shop_id <> v_own) then
    raise exception 'Vous n''avez accès qu''à votre boutique.' using errcode = '42501';
  end if;
  return v_own;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'accès
-- -----------------------------------------------------------------------------
alter table public.shops enable row level security;
grant select on public.shops to authenticated;
grant update (name, sort_order, is_active) on public.shops to authenticated;

create policy shops_select on public.shops
  for select to authenticated
  using ((select public.is_active_user()) and (select public.can_see_shop(id)));

create policy shops_update_admin on public.shops
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant update (shop_id) on public.profiles to authenticated;
-- La boutique d'un produit est choisie à sa création et ne change plus
-- (son stock et ses ventes y sont attachés).
grant insert (shop_id) on public.products to authenticated;

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using ((select public.is_active_user()) and (select public.can_see_shop(shop_id)));

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select to authenticated
  using (
    (select public.is_active_user())
    and (select public.can_see_shop(shop_id))
    and (
      cashier_id = (select auth.uid())
      or (select public.has_permission('view_all_sales'))
    )
  );

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (
    (select public.has_permission('manage_stock'))
    and exists (select 1 from public.products p where p.id = product_id)
  );

-- -----------------------------------------------------------------------------
-- Vente : dans la boutique du caissier (ou celle choisie par l'administrateur),
-- uniquement avec les produits de cette boutique.
-- -----------------------------------------------------------------------------
drop function if exists public.create_sale(jsonb, text, uuid, numeric, text, text, text, uuid);

create function public.create_sale(
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key uuid,
  p_discount_amount numeric default 0,
  p_note text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_id uuid default null,
  p_shop_id uuid default null
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
  v_customer text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_is_credit boolean;
  v_customer_id uuid;
  v_client public.customers%rowtype;
  v_shop public.shops%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or not v_profile.is_active then
    raise exception 'Votre compte est inactif. Contactez l''administrateur.' using errcode = '42501';
  end if;

  -- Boutique de la vente : celle du caissier ; l'administrateur choisit.
  if v_profile.role = 'admin' then
    select * into v_shop from public.shops where id = coalesce(p_shop_id, v_profile.shop_id);
  else
    if p_shop_id is not null and p_shop_id is distinct from v_profile.shop_id then
      raise exception 'Vous ne pouvez vendre que dans votre boutique.' using errcode = '42501';
    end if;
    select * into v_shop from public.shops where id = v_profile.shop_id;
  end if;
  if v_shop.id is null then
    raise exception 'Choisissez la boutique de la vente.' using errcode = 'P0001';
  end if;
  if not v_shop.is_active then
    raise exception 'La boutique « % » est fermée.', v_shop.name using errcode = 'P0001';
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

  -- Vente à crédit : le client paiera plus tard. Elle est rattachée au
  -- dossier du client : celui choisi à la caisse, sinon celui qui a le même
  -- téléphone, sinon un nouveau dossier créé ici.
  v_is_credit := v_method.code = 'credit';
  if v_is_credit then
    if p_customer_id is not null then
      select * into v_client from public.customers where id = p_customer_id and is_active;
      if not found then
        raise exception 'Dossier client introuvable ou désactivé.' using errcode = 'P0001';
      end if;
    else
      if v_customer is null or char_length(v_customer) < 2 then
        raise exception 'Vente à crédit : indiquez le nom du client.' using errcode = 'P0001';
      end if;
      if public.phone_key(v_phone) is not null then
        select * into v_client from public.customers
         where phone_key = public.phone_key(v_phone) and is_active
         order by created_at limit 1;
      end if;
      if v_client.id is null then
        insert into public.customers (name, phone, created_by)
        values (v_customer, v_phone, v_uid)
        returning * into v_client;
      end if;
    end if;
    v_customer_id := v_client.id;
    v_customer := v_client.name;
    v_phone := coalesce(v_client.phone, v_phone);
  else
    v_customer := null;
    v_phone := null;
  end if;
  if char_length(coalesce(v_customer, '')) > 120 or char_length(coalesce(v_phone, '')) > 30 then
    raise exception 'Nom ou téléphone du client trop long.' using errcode = 'P0001';
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
           p.stock_quantity, p.shop_id, c.name as category_name
      into v_product
      from public.products p
      left join public.categories c on c.id = p.category_id
     where p.id = v_line.product_id
       for update of p;

    if not found then
      raise exception 'Un produit du panier n''existe plus.' using errcode = 'P0001';
    end if;
    if v_product.shop_id <> v_shop.id then
      raise exception 'Le produit « % » n''appartient pas à la boutique %.', v_product.name, v_shop.name
        using errcode = 'P0001';
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
    idempotency_key, customer_name, customer_phone, customer_id, shop_id
  ) values (
    v_receipt, v_uid, coalesce(public.current_user_name(), 'Caissier'), v_subtotal, v_discount,
    v_subtotal - v_discount, v_method.code, v_method.label,
    case when v_is_credit then 'pending'::public.payment_status else 'paid'::public.payment_status end,
    'completed', v_item_count, left(v_note, 500), p_idempotency_key, v_customer, v_phone, v_customer_id, v_shop.id
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
      'payment_method', v_method.code,
      'customer_name', v_customer,
      'shop', v_shop.name
    )
  );

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'customer_id', v_customer_id,
    'shop_id', v_shop.id,
    'receipt_number', v_receipt,
    'total_amount', v_subtotal - v_discount,
    'replayed', false
  );
end;
$$;

revoke all on function public.create_sale(jsonb, text, uuid, numeric, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.create_sale(jsonb, text, uuid, numeric, text, text, text, uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Annulation, remboursement, règlement d'un crédit, stock : seulement dans
-- une boutique que l'on peut voir.
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
  if not public.can_see_shop(v_sale.shop_id) then
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
  if not public.can_see_shop(v_sale.shop_id) then
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

create or replace function public.settle_credit(p_sale_id uuid, p_payment_method text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_method public.payment_methods%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and is_active) then
    raise exception 'Votre compte est inactif. Contactez l''administrateur.' using errcode = '42501';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Vente introuvable.' using errcode = 'P0001';
  end if;
  if not public.can_see_shop(v_sale.shop_id) then
    raise exception 'Vente introuvable.' using errcode = 'P0001';
  end if;
  if not (public.has_permission('view_all_sales') or v_sale.cashier_id = v_uid) then
    raise exception 'Vous n''êtes pas autorisé à encaisser ce crédit.' using errcode = '42501';
  end if;
  if v_sale.sale_status = 'cancelled' then
    raise exception 'Cette vente a été annulée.' using errcode = 'P0001';
  end if;
  if v_sale.payment_status <> 'pending' then
    raise exception 'Ce crédit est déjà réglé.' using errcode = 'P0001';
  end if;

  select * into v_method from public.payment_methods
   where code = p_payment_method and is_active and code <> 'credit';
  if not found then
    raise exception 'Mode de paiement invalide ou désactivé.' using errcode = 'P0001';
  end if;

  update public.sales
     set payment_status = 'paid',
         paid_at = now(),
         settled_by = v_uid,
         settled_payment_method = v_method.code,
         settled_payment_label = v_method.label
   where id = p_sale_id;

  perform public.write_audit_log(
    'sale.credit_settled', 'sales', p_sale_id::text,
    jsonb_build_object(
      'receipt_number', v_sale.receipt_number,
      'total_amount', v_sale.total_amount - v_sale.refunded_amount,
      'payment_method', v_method.code,
      'customer_name', v_sale.customer_name
    )
  );

  return jsonb_build_object('sale_id', p_sale_id, 'payment_method', v_method.code);
end;
$$;

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
  if not public.can_see_shop(v_product.shop_id) then
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
-- Rapports et tableau de bord par boutique (null = toutes, pour l'administrateur).
-- -----------------------------------------------------------------------------
drop function if exists public.get_sales_report(date, date);
drop function if exists public.get_dashboard_summary();

create function public.get_sales_report(p_from date, p_to date, p_shop_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
  v_shop uuid;
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

  v_shop := public.report_shop(p_shop_id);

  select timezone into v_tz from public.restaurant_settings where id = 1;
  v_tz := coalesce(v_tz, 'Africa/Conakry');
  v_from := p_from::timestamp at time zone v_tz;
  v_to := (p_to + 1)::timestamp at time zone v_tz;

  with period_sales as (
    select * from public.sales where created_at >= v_from and created_at < v_to
      and (v_shop is null or shop_id = v_shop)
  ),
  valid_sales as (
    select * from period_sales where sale_status <> 'cancelled'
  ),
  period_refunds as (
    select r.*, s.payment_method, s.payment_method_label, s.cashier_id
    from public.refunds r
    join public.sales s on s.id = r.sale_id
    where r.created_at >= v_from and r.created_at < v_to
      and (v_shop is null or s.shop_id = v_shop)
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
    'shop_id', v_shop,
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

create function public.get_dashboard_summary(p_shop_id uuid default null)
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
          and (p_shop_id is null or s.shop_id = p_shop_id)
          and s.created_at >= b.start_day::timestamp at time zone v_tz
          and s.created_at < (v_today + 1)::timestamp at time zone v_tz
      ), 0) as gross,
      coalesce((
        select count(*) from public.sales s
        where s.sale_status <> 'cancelled'
          and (p_shop_id is null or s.shop_id = p_shop_id)
          and s.created_at >= b.start_day::timestamp at time zone v_tz
          and s.created_at < (v_today + 1)::timestamp at time zone v_tz
      ), 0) as cnt,
      coalesce((
        select sum(r.amount) from public.refunds r
        join public.sales s on s.id = r.sale_id
        where (p_shop_id is null or s.shop_id = p_shop_id)
          and r.created_at >= b.start_day::timestamp at time zone v_tz
          and r.created_at < (v_today + 1)::timestamp at time zone v_tz
      ), 0) as refunds
    from bounds b
  )
  select jsonb_build_object(
    'today', v_today,
    'timezone', v_tz,
    'shop_id', p_shop_id,
    'periods', (
      select jsonb_object_agg(period, jsonb_build_object(
        'gross', gross, 'refunds', refunds, 'net', gross - refunds, 'count', cnt
      ))
      from figures
    ),
    'active_products', (
      select count(*) from public.products
       where is_available and not is_archived and (p_shop_id is null or shop_id = p_shop_id)
    ),
    'low_stock_products', (
      select count(*) from public.products p, public.restaurant_settings rs
      where rs.id = 1 and rs.stock_enabled and p.track_stock and not p.is_archived
        and p.stock_quantity <= p.minimum_stock
        and (p_shop_id is null or p.shop_id = p_shop_id)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_sales_report(date, date, uuid) from public, anon;
grant execute on function public.get_sales_report(date, date, uuid) to authenticated;
revoke all on function public.get_dashboard_summary(uuid) from public, anon;
grant execute on function public.get_dashboard_summary(uuid) to authenticated;
revoke all on function public.current_shop_id() from public, anon;
grant execute on function public.current_shop_id() to authenticated;
revoke all on function public.can_see_shop(uuid) from public, anon;
grant execute on function public.can_see_shop(uuid) to authenticated;
revoke all on function public.report_shop(uuid) from public, anon;
grant execute on function public.report_shop(uuid) to authenticated;
grant all on public.shops to service_role;
