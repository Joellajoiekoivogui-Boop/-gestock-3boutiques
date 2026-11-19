-- =============================================================================
-- Rapports plus complets :
--   * prix d'achat des produits (table product_costs, administrateur seulement) ;
--   * coût figé au moment de chaque vente (sale_item_costs) pour calculer la marge ;
--   * get_sales_report : boutiques côte à côte (by_shop) et, pour
--     l'administrateur, la marge (margin, top_margin).
-- Les caissiers ne voient jamais les prix d'achat.
-- =============================================================================

create table if not exists public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_price numeric(14, 0) not null check (cost_price >= 0 and cost_price <= 1000000000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id) on delete restrict,
  unit_cost numeric(14, 0) not null check (unit_cost >= 0)
);

alter table public.product_costs enable row level security;
alter table public.sale_item_costs enable row level security;
revoke all on public.product_costs, public.sale_item_costs from anon, authenticated;
grant all on public.product_costs, public.sale_item_costs to service_role;
grant select on public.product_costs to authenticated;

create policy product_costs_select_admin on public.product_costs
  for select to authenticated
  using ((select public.is_admin()));
-- sale_item_costs : aucune politique, lue seulement par les fonctions du rapport.

create trigger sale_item_costs_append_only before update or delete on public.sale_item_costs
  for each row execute function public.prevent_modification();

-- Fixer (ou effacer avec null) le prix d'achat d'un produit : administrateur.
create or replace function public.set_product_cost(p_product_id uuid, p_cost numeric)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old numeric;
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Seul l''administrateur fixe le prix d''achat.' using errcode = '42501';
  end if;
  select name into v_name from public.products where id = p_product_id;
  if v_name is null then
    raise exception 'Produit introuvable.' using errcode = 'P0001';
  end if;
  if p_cost is not null and (p_cost < 0 or p_cost <> trunc(p_cost) or p_cost > 1000000000) then
    raise exception 'Le prix d''achat est invalide.' using errcode = 'P0001';
  end if;
  select cost_price into v_old from public.product_costs where product_id = p_product_id;
  if p_cost is null then
    delete from public.product_costs where product_id = p_product_id;
  else
    insert into public.product_costs (product_id, cost_price, updated_by, updated_at)
    values (p_product_id, p_cost, auth.uid(), now())
    on conflict (product_id) do update
      set cost_price = excluded.cost_price, updated_by = excluded.updated_by, updated_at = now();
  end if;
  if v_old is distinct from p_cost then
    perform public.write_audit_log(
      'product.cost_changed', 'products', p_product_id::text,
      jsonb_build_object('product_name', v_name, 'old', v_old, 'new', p_cost)
    );
  end if;
end;
$$;

revoke all on function public.set_product_cost(uuid, numeric) from public, anon;
grant execute on function public.set_product_cost(uuid, numeric) to authenticated;

create or replace function public.create_sale(
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
  v_item_id uuid;
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
    )
    returning id into v_item_id;

    -- Coût d'achat figé au moment de la vente (pour la marge), s'il est connu.
    insert into public.sale_item_costs (sale_item_id, unit_cost)
    select v_item_id, pc.cost_price from public.product_costs pc where pc.product_id = v_line.product_id;

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

create or replace function public.get_sales_report(p_from date, p_to date, p_shop_id uuid default null)
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
  v_from := (p_from::timestamp + public.day_start()) at time zone v_tz;
  v_to := ((p_to + 1)::timestamp + public.day_start()) at time zone v_tz;

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
    select ((created_at at time zone v_tz) - public.day_start())::date as day,
           sum(total_amount) as gross, count(*) as cnt
    from valid_sales group by 1
  ),
  refunds_by_day as (
    select ((created_at at time zone v_tz) - public.day_start())::date as day, sum(amount) as refunds
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

  -- Boutiques côte à côte (une seule si le rapport est limité à une boutique).
  v_result := v_result || jsonb_build_object('by_shop', coalesce((
    select jsonb_agg(row_to_json(x) order by x.net desc, x.name)
    from (
      select sh.id as shop_id, sh.name,
             count(s.id) filter (where s.sale_status <> 'cancelled') as count,
             coalesce(sum(s.total_amount) filter (where s.sale_status <> 'cancelled'), 0) as gross,
             coalesce((
               select sum(r.amount) from public.refunds r join public.sales s2 on s2.id = r.sale_id
                where s2.shop_id = sh.id and r.created_at >= v_from and r.created_at < v_to
             ), 0) as refunds,
             coalesce(sum(s.total_amount) filter (where s.sale_status <> 'cancelled'), 0) - coalesce((
               select sum(r.amount) from public.refunds r join public.sales s2 on s2.id = r.sale_id
                where s2.shop_id = sh.id and r.created_at >= v_from and r.created_at < v_to
             ), 0) as net
      from public.shops sh
      left join public.sales s on s.shop_id = sh.id and s.created_at >= v_from and s.created_at < v_to
      where v_shop is null or sh.id = v_shop
      group by sh.id, sh.name
    ) x
  ), '[]'::jsonb));

  -- Marge (administrateur seulement) : prix de vente des lignes − coût d'achat
  -- figé à la vente. Les lignes sans prix d'achat connu sont comptées à part.
  if public.is_admin() then
    v_result := v_result || jsonb_build_object(
      'margin', (
        select jsonb_build_object(
          'revenue_with_cost', coalesce(sum(si.line_total) filter (where c.unit_cost is not null), 0),
          'cost_total', coalesce(sum(c.unit_cost * si.quantity), 0),
          'margin', coalesce(sum(si.line_total - c.unit_cost * si.quantity) filter (where c.unit_cost is not null), 0),
          'revenue_without_cost', coalesce(sum(si.line_total) filter (where c.unit_cost is null), 0)
        )
        from public.sale_items si
        join public.sales s on s.id = si.sale_id
        left join public.sale_item_costs c on c.sale_item_id = si.id
        where s.sale_status <> 'cancelled' and s.created_at >= v_from and s.created_at < v_to
          and (v_shop is null or s.shop_id = v_shop)
      ),
      'top_margin', coalesce((
        select jsonb_agg(row_to_json(x) order by x.margin desc)
        from (
          select si.product_id, max(si.product_name) as name, sum(si.quantity) as quantity,
                 sum(si.line_total) as revenue, sum(c.unit_cost * si.quantity) as cost,
                 sum(si.line_total - c.unit_cost * si.quantity) as margin
          from public.sale_items si
          join public.sales s on s.id = si.sale_id
          join public.sale_item_costs c on c.sale_item_id = si.id
          where s.sale_status <> 'cancelled' and s.created_at >= v_from and s.created_at < v_to
            and (v_shop is null or s.shop_id = v_shop)
          group by si.product_id
          order by sum(si.line_total - c.unit_cost * si.quantity) desc
          limit 10
        ) x
      ), '[]'::jsonb)
    );
  end if;

  return v_result;
end;
$$;
