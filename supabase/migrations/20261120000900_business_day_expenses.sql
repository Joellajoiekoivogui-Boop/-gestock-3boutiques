-- =============================================================================
-- 1. JOURNÉE DE VENTE de 7h à 7h : une vente faite le 17 à 2h du matin compte
--    pour la journée du 16. Rapports et tableau de bord suivent cette règle
--    (l'application utilise la même heure : DAY_START_HOUR dans src/lib/dates.ts).
-- 2. DÉPENSES DE CAISSE : le caissier note les achats payés avec l'argent de la
--    caisse (condiments…) ; elles sont retirées de l'argent encaissé du jour.
--    Seul l'administrateur peut supprimer une dépense (suppression tracée).
-- =============================================================================

create or replace function public.day_start()
returns interval
language sql immutable
set search_path = ''
as $$ select interval '7 hours' $$;

-- Journée de vente en cours, dans le fuseau de l'établissement.
create or replace function public.current_business_day()
returns date
language sql stable security definer
set search_path = ''
as $$
  select ((now() at time zone coalesce(
    (select timezone from public.restaurant_settings where id = 1), 'Africa/Conakry'
  )) - public.day_start())::date;
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

  return v_result;
end;
$$;

create or replace function public.get_dashboard_summary(p_shop_id uuid default null)
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
  v_today := ((now() at time zone v_tz) - public.day_start())::date;

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
          and s.created_at >= (b.start_day::timestamp + public.day_start()) at time zone v_tz
          and s.created_at < ((v_today + 1)::timestamp + public.day_start()) at time zone v_tz
      ), 0) as gross,
      coalesce((
        select count(*) from public.sales s
        where s.sale_status <> 'cancelled'
          and (p_shop_id is null or s.shop_id = p_shop_id)
          and s.created_at >= (b.start_day::timestamp + public.day_start()) at time zone v_tz
          and s.created_at < ((v_today + 1)::timestamp + public.day_start()) at time zone v_tz
      ), 0) as cnt,
      coalesce((
        select sum(r.amount) from public.refunds r
        join public.sales s on s.id = r.sale_id
        where (p_shop_id is null or s.shop_id = p_shop_id)
          and r.created_at >= (b.start_day::timestamp + public.day_start()) at time zone v_tz
          and r.created_at < ((v_today + 1)::timestamp + public.day_start()) at time zone v_tz
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

-- -----------------------------------------------------------------------------
-- Dépenses
-- -----------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  business_date date not null,
  label text not null check (char_length(btrim(label)) between 2 and 120),
  amount numeric(14, 0) not null check (amount > 0 and amount <= 1000000000),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_day_idx on public.expenses (business_date, shop_id);

create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.audit_row_change();

-- Une dépense ne se modifie pas : on la supprime (administrateur) et on la ressaisit.
create trigger expenses_no_update before update on public.expenses
  for each row execute function public.prevent_modification();

alter table public.expenses enable row level security;
grant select, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

-- Chacun voit ses dépenses ; qui voit toutes les ventes voit toutes celles de
-- sa boutique ; l'administrateur voit tout.
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    (select public.is_active_user())
    and (select public.can_see_shop(shop_id))
    and (created_by = (select auth.uid()) or (select public.has_permission('view_all_sales')))
  );

create policy expenses_delete_admin on public.expenses
  for delete to authenticated
  using ((select public.is_admin()));

-- Noter une dépense : dans la boutique du caissier, pour la journée en cours.
-- L'administrateur choisit la boutique et peut noter une dépense d'un jour passé.
create or replace function public.add_expense(
  p_label text,
  p_amount numeric,
  p_shop_id uuid default null,
  p_day date default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_shop public.shops%rowtype;
  v_label text := btrim(coalesce(p_label, ''));
  v_today date := public.current_business_day();
  v_day date;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or not v_profile.is_active then
    raise exception 'Votre compte est inactif. Contactez l''administrateur.' using errcode = '42501';
  end if;

  if v_profile.role = 'admin' then
    select * into v_shop from public.shops where id = coalesce(p_shop_id, v_profile.shop_id);
    v_day := coalesce(p_day, v_today);
  else
    if p_shop_id is not null and p_shop_id is distinct from v_profile.shop_id then
      raise exception 'Vous ne pouvez noter une dépense que dans votre boutique.' using errcode = '42501';
    end if;
    if p_day is not null and p_day <> v_today then
      raise exception 'Une dépense se note le jour même.' using errcode = '42501';
    end if;
    select * into v_shop from public.shops where id = v_profile.shop_id;
    v_day := v_today;
  end if;
  if v_shop.id is null then
    raise exception 'Choisissez la boutique de la dépense.' using errcode = 'P0001';
  end if;
  if v_day > v_today then
    raise exception 'La date de la dépense ne peut pas être dans le futur.' using errcode = 'P0001';
  end if;
  if char_length(v_label) < 2 or char_length(v_label) > 120 then
    raise exception 'Indiquez ce qui a été acheté (2 à 120 caractères).' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) or p_amount > 1000000000 then
    raise exception 'Le prix de la dépense est invalide.' using errcode = 'P0001';
  end if;

  insert into public.expenses (shop_id, business_date, label, amount, created_by, created_by_name)
  values (v_shop.id, v_day, v_label, p_amount, v_uid, coalesce(public.current_user_name(), 'Caissier'))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.add_expense(text, numeric, uuid, date) from public, anon;
grant execute on function public.add_expense(text, numeric, uuid, date) to authenticated;
revoke all on function public.current_business_day() from public, anon;
grant execute on function public.current_business_day() to authenticated;
grant execute on function public.day_start() to authenticated;
