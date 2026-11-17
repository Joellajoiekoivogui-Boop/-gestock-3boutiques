-- =============================================================================
-- Dossiers clients pour les ventes à crédit.
--   * une fiche par personne (nom, téléphone, note), retrouvée par téléphone ;
--   * chaque vente à crédit est rattachée à un dossier ;
--   * les crédits déjà enregistrés reçoivent un dossier (un par nom et téléphone).
-- =============================================================================

-- Téléphone réduit à ses chiffres, pour reconnaître le même numéro écrit
-- différemment (« +224 622 00 00 00 » et « 622000000 »).
create or replace function public.phone_key(p_phone text)
returns text
language sql immutable
set search_path = ''
as $$
  select nullif(right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 9), '')
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  phone text check (char_length(phone) <= 30),
  phone_key text generated always as (public.phone_key(phone)) stored,
  note text check (char_length(note) <= 500),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers (lower(name));
create index if not exists customers_phone_idx on public.customers (phone_key);

alter table public.sales
  add column if not exists customer_id uuid references public.customers (id) on delete restrict;
create index if not exists sales_customer_idx on public.sales (customer_id, created_at desc);

-- Les crédits déjà enregistrés reçoivent un dossier (même nom et même téléphone = même dossier).
insert into public.customers (name, phone, created_by, created_at)
select distinct on (lower(btrim(s.customer_name)), coalesce(public.phone_key(s.customer_phone), ''))
       btrim(s.customer_name), s.customer_phone, s.cashier_id, s.created_at
  from public.sales s
 where s.customer_name is not null and s.customer_id is null
 order by lower(btrim(s.customer_name)), coalesce(public.phone_key(s.customer_phone), ''), s.created_at;

update public.sales s
   set customer_id = c.id
  from public.customers c
 where s.customer_id is null
   and s.customer_name is not null
   and lower(btrim(s.customer_name)) = lower(c.name)
   and coalesce(public.phone_key(s.customer_phone), '') = coalesce(c.phone_key, '');

-- Accès : tout compte actif consulte les dossiers (pour les retrouver à la
-- caisse) ; seul l'administrateur les modifie directement. La caisse crée les
-- dossiers par create_sale ou create_customer.
alter table public.customers enable row level security;
grant select on public.customers to authenticated;
grant update (name, phone, note, is_active) on public.customers to authenticated;

create policy customers_select on public.customers
  for select to authenticated
  using ((select public.is_active_user()));

create policy customers_update_admin on public.customers
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create trigger customers_audit after insert or update or delete on public.customers
  for each row execute function public.audit_row_change();

-- Une vente ne change jamais de dossier client une fois rattachée.
create or replace function public.protect_sale_customer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.customer_id is not null and new.customer_id is distinct from old.customer_id then
    raise exception 'Le dossier client d''une vente ne peut pas être changé.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger sales_protect_customer before update on public.sales
  for each row execute function public.protect_sale_customer();

-- -----------------------------------------------------------------------------
-- create_customer : ouvrir un dossier depuis la page des clients.
-- -----------------------------------------------------------------------------
create or replace function public.create_customer(p_name text, p_phone text default null, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_id uuid;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Indiquez le nom du client.' using errcode = 'P0001';
  end if;
  if public.phone_key(v_phone) is not null then
    select id into v_id from public.customers
     where phone_key = public.phone_key(v_phone) and is_active
     order by created_at limit 1;
    if v_id is not null then
      raise exception 'Un dossier existe déjà avec ce numéro de téléphone.' using errcode = '23505';
    end if;
  end if;
  insert into public.customers (name, phone, note, created_by)
  values (v_name, v_phone, nullif(btrim(coalesce(p_note, '')), ''), v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_customer(text, text, text) from public, anon;
grant execute on function public.create_customer(text, text, text) to authenticated;
revoke all on function public.phone_key(text) from public, anon;
grant execute on function public.phone_key(text) to authenticated;

-- -----------------------------------------------------------------------------
-- create_sale : la vente à crédit est rattachée au dossier du client.
-- -----------------------------------------------------------------------------
drop function if exists public.create_sale(jsonb, text, uuid, numeric, text, text, text);

create function public.create_sale(
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key uuid,
  p_discount_amount numeric default 0,
  p_note text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_id uuid default null
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
    idempotency_key, customer_name, customer_phone, customer_id
  ) values (
    v_receipt, v_uid, coalesce(public.current_user_name(), 'Caissier'), v_subtotal, v_discount,
    v_subtotal - v_discount, v_method.code, v_method.label,
    case when v_is_credit then 'pending'::public.payment_status else 'paid'::public.payment_status end,
    'completed', v_item_count, left(v_note, 500), p_idempotency_key, v_customer, v_phone, v_customer_id
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
    'customer_id', v_customer_id,
    'receipt_number', v_receipt,
    'total_amount', v_subtotal - v_discount,
    'replayed', false
  );
end;
$$;

revoke all on function public.create_sale(jsonb, text, uuid, numeric, text, text, text, uuid) from public, anon;
grant execute on function public.create_sale(jsonb, text, uuid, numeric, text, text, text, uuid) to authenticated;
