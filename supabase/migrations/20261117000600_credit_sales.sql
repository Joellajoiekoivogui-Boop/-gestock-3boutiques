-- =============================================================================
-- Ventes à crédit (le client paie plus tard) et modes de paiement.
--   * nouveau mode « Crédit » ; MTN Mobile Money et Virement bancaire désactivés
--     (ils restent dans l'historique des ventes passées) ;
--   * une vente à crédit garde payment_status = 'pending', avec le nom et le
--     téléphone du client, jusqu'à son règlement par settle_credit() ;
--   * le règlement enregistre le mode réellement utilisé, la date et l'auteur,
--     et laisse une trace dans le journal d'activité.
-- =============================================================================

alter table public.sales
  add column if not exists customer_name text check (char_length(customer_name) <= 120),
  add column if not exists customer_phone text check (char_length(customer_phone) <= 30),
  add column if not exists paid_at timestamptz,
  add column if not exists settled_by uuid references public.profiles (id) on delete restrict,
  add column if not exists settled_payment_method text references public.payment_methods (code) on update cascade on delete restrict,
  add column if not exists settled_payment_label text;

create index if not exists sales_pending_idx on public.sales (payment_status, created_at desc)
  where payment_status = 'pending';

insert into public.payment_methods (code, label, sort_order) values ('credit', 'Crédit', 35)
on conflict (code) do nothing;

update public.payment_methods set is_active = false where code in ('mtn_momo', 'bank_transfer');

-- Une vente validée reste figée ; le règlement d'un crédit ne peut que passer
-- de « à payer » à « payé », une seule fois, et le client ne change plus.
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
     or new.created_at is distinct from old.created_at
     or new.customer_name is distinct from old.customer_name
     or new.customer_phone is distinct from old.customer_phone then
    raise exception 'Le contenu financier d''une vente validée ne peut pas être modifié.'
      using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status
     and not (old.payment_status = 'pending' and new.payment_status = 'paid') then
    raise exception 'Une vente payée ne peut pas repasser « à payer ».' using errcode = '42501';
  end if;

  if old.paid_at is not null and (
       new.paid_at is distinct from old.paid_at
       or new.settled_by is distinct from old.settled_by
       or new.settled_payment_method is distinct from old.settled_payment_method
       or new.settled_payment_label is distinct from old.settled_payment_label) then
    raise exception 'Le règlement d''un crédit ne peut pas être modifié.' using errcode = '42501';
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

-- -----------------------------------------------------------------------------
-- create_sale : mêmes règles qu'avant, plus le client des ventes à crédit.
-- -----------------------------------------------------------------------------
drop function if exists public.create_sale(jsonb, text, uuid, numeric, text);

create function public.create_sale(
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key uuid,
  p_discount_amount numeric default 0,
  p_note text default null,
  p_customer_name text default null,
  p_customer_phone text default null
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

  -- Vente à crédit : le client paiera plus tard ; son nom est obligatoire.
  v_is_credit := v_method.code = 'credit';
  if v_is_credit and (v_customer is null or char_length(v_customer) < 2) then
    raise exception 'Vente à crédit : indiquez le nom du client.' using errcode = 'P0001';
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
    idempotency_key, customer_name, customer_phone
  ) values (
    v_receipt, v_uid, coalesce(public.current_user_name(), 'Caissier'), v_subtotal, v_discount,
    v_subtotal - v_discount, v_method.code, v_method.label,
    case when v_is_credit then 'pending'::public.payment_status else 'paid'::public.payment_status end,
    'completed', v_item_count, left(v_note, 500), p_idempotency_key, v_customer, v_phone
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
      'customer_name', v_customer
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

revoke all on function public.create_sale(jsonb, text, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.create_sale(jsonb, text, uuid, numeric, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- settle_credit : le client vient payer son crédit.
--   Autorisé à l'administrateur, à qui voit toutes les ventes, et au caissier
--   pour ses propres ventes. Le mode « Crédit » ne peut pas servir à régler.
-- -----------------------------------------------------------------------------
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

revoke all on function public.settle_credit(uuid, text) from public, anon;
grant execute on function public.settle_credit(uuid, text) to authenticated;
