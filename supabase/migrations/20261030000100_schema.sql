-- =============================================================================
-- MassaGui Fils SARL.U — Migration 1/5 : schéma
-- Tables, types, contraintes et index.
--
-- Règles générales :
--   * montants en GNF stockés en numeric(14,0) (type exact, sans décimales :
--     le franc guinéen n'a pas de subdivision) — jamais en virgule flottante ;
--   * l'historique financier est figé : chaque ligne de vente conserve le nom
--     et le prix du produit au moment de la vente ;
--   * aucune suppression en cascade sur les données de vente.
-- =============================================================================

-- Montant monétaire exact et positif.
create domain public.gnf_amount as numeric(14, 0)
  check (value >= 0);

create type public.app_role as enum ('admin', 'cashier');

-- completed           = vente payée (statut affiché « Payée »)
-- partially_refunded  = remboursement partiel enregistré
-- refunded            = intégralement remboursée
-- cancelled           = annulée (aucun revenu, stock réintégré)
create type public.sale_status as enum ('completed', 'partially_refunded', 'refunded', 'cancelled');

-- paid    = paiement constaté par le caissier (espèces, Mobile Money vérifié à l'écran…)
-- pending = réservé à une future intégration de paiement en ligne : une vente
--           n'est « paid » qu'après confirmation réelle du prestataire.
create type public.payment_status as enum ('paid', 'pending');

-- sale        = sortie liée à une vente
-- sale_cancel = réintégration après annulation d'une vente
-- restock     = approvisionnement (entrée)
-- adjustment  = correction manuelle (+/-) avec motif obligatoire
create type public.stock_movement_type as enum ('sale', 'sale_cancel', 'restock', 'adjustment');

-- -----------------------------------------------------------------------------
-- Profils utilisateurs (1-1 avec auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  role public.app_role not null default 'cashier',
  -- Permissions fines accordées par l'administrateur (un admin les a toutes).
  permissions text[] not null default '{}',
  -- Un compte est inactif tant qu'un administrateur ne l'a pas activé.
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_permissions_valid check (
    permissions <@ array[
      'apply_discount',
      'view_all_sales',
      'cancel_sales',
      'refund_sales',
      'manage_stock',
      'view_reports'
    ]::text[]
  )
);

comment on column public.profiles.permissions is
  'apply_discount, view_all_sales, cancel_sales, refund_sales, manage_stock, view_reports';

-- -----------------------------------------------------------------------------
-- Paramètres de l'établissement (une seule ligne, id = 1)
-- -----------------------------------------------------------------------------
create table public.restaurant_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'MassaGui Fils SARL.U' check (char_length(btrim(name)) between 1 and 120),
  tagline text default 'Hôtellerie — Restaurant' check (char_length(tagline) <= 120),
  logo_url text check (char_length(logo_url) <= 1000),
  address text check (char_length(address) <= 300),
  phone text check (char_length(phone) <= 60),
  email text check (char_length(email) <= 200),
  currency text not null default 'GNF' check (currency ~ '^[A-Z]{3}$'),
  receipt_footer text default 'Merci de votre visite !' check (char_length(receipt_footer) <= 300),
  receipt_format text not null default '80mm' check (receipt_format in ('80mm', '58mm', 'a4')),
  receipt_prefix text not null default 'MG' check (receipt_prefix ~ '^[A-Z0-9]{1,6}$'),
  -- Active la gestion des stocks pour l'ensemble de l'établissement.
  stock_enabled boolean not null default true,
  -- Préférences d'interface de la caisse.
  pos_show_images boolean not null default true,
  timezone text not null default 'Africa/Conakry',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Catégories de produits
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_name_unique on public.categories (lower(btrim(name)));

-- -----------------------------------------------------------------------------
-- Produits
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  category_id uuid references public.categories (id) on delete restrict,
  price public.gnf_amount not null,
  image_url text check (char_length(image_url) <= 1000),
  -- Disponible à la vente (affiché à la caisse).
  is_available boolean not null default true,
  -- Archivé : retiré du catalogue mais conservé pour l'historique.
  is_archived boolean not null default false,
  track_stock boolean not null default false,
  -- Modifié UNIQUEMENT par les fonctions de vente / mouvements de stock.
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_name_idx on public.products (lower(name));
create index products_catalog_idx on public.products (is_archived, is_available);

-- -----------------------------------------------------------------------------
-- Modes de paiement (configurables)
-- Les paiements mobiles sont de simples moyens d'encaissement déclarés :
-- aucune API opérateur n'est appelée.
-- -----------------------------------------------------------------------------
create table public.payment_methods (
  code text primary key check (code ~ '^[a-z0-9_]{2,32}$'),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Compteur des numéros de reçu (un compteur par année).
-- Incrémenté dans la transaction de vente : la ligne verrouillée sérialise les
-- ventes simultanées, et un échec annule aussi l'incrément (pas de trou).
-- -----------------------------------------------------------------------------
create table public.receipt_counters (
  year integer primary key check (year between 2000 and 9999),
  last_value bigint not null default 0 check (last_value >= 0)
);

-- -----------------------------------------------------------------------------
-- Ventes
-- -----------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  cashier_id uuid not null references public.profiles (id) on delete restrict,
  -- Instantanés pour que le reçu reste identique même si le profil change.
  cashier_name text not null,
  subtotal public.gnf_amount not null,
  discount_amount public.gnf_amount not null default 0,
  total_amount public.gnf_amount not null,
  refunded_amount public.gnf_amount not null default 0,
  payment_method text not null references public.payment_methods (code) on update cascade on delete restrict,
  payment_method_label text not null,
  payment_status public.payment_status not null default 'paid',
  sale_status public.sale_status not null default 'completed',
  item_count integer not null check (item_count > 0),
  note text check (char_length(note) <= 500),
  -- Clé envoyée par la caisse : une même clé ne crée jamais deux ventes.
  idempotency_key uuid not null unique,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete restrict,
  cancel_reason text check (char_length(cancel_reason) <= 500),
  created_at timestamptz not null default now(),
  constraint sales_discount_le_subtotal check (discount_amount <= subtotal),
  constraint sales_total_consistent check (total_amount = subtotal - discount_amount),
  constraint sales_refund_le_total check (refunded_amount <= total_amount),
  constraint sales_cancel_consistent check (
    (sale_status = 'cancelled') = (cancelled_at is not null)
  ),
  constraint sales_refund_status_consistent check (
    (sale_status = 'refunded' and refunded_amount = total_amount)
    or (sale_status = 'partially_refunded' and refunded_amount > 0 and refunded_amount < total_amount)
    or (sale_status in ('completed', 'cancelled') and refunded_amount = 0)
  )
);

create index sales_created_at_idx on public.sales (created_at desc);
create index sales_cashier_idx on public.sales (cashier_id, created_at desc);
create index sales_status_idx on public.sales (sale_status, created_at desc);
create index sales_payment_idx on public.sales (payment_method, created_at desc);

-- -----------------------------------------------------------------------------
-- Lignes de vente (figées)
-- -----------------------------------------------------------------------------
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  category_name text,
  unit_price public.gnf_amount not null,
  quantity integer not null check (quantity > 0 and quantity <= 10000),
  line_total public.gnf_amount not null,
  constraint sale_items_line_total check (line_total = unit_price * quantity)
);

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- -----------------------------------------------------------------------------
-- Mouvements de stock (journal)
-- -----------------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  movement_type public.stock_movement_type not null,
  -- Variation signée : négative pour une sortie, positive pour une entrée.
  quantity integer not null check (quantity <> 0),
  stock_after integer not null check (stock_after >= 0),
  reason text check (char_length(reason) <= 500),
  sale_id uuid references public.sales (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_created_idx on public.stock_movements (created_at desc);

-- -----------------------------------------------------------------------------
-- Remboursements
-- -----------------------------------------------------------------------------
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  amount public.gnf_amount not null check (amount > 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index refunds_sale_idx on public.refunds (sale_id);
create index refunds_created_idx on public.refunds (created_at desc);

-- -----------------------------------------------------------------------------
-- Journal d'activité (append-only)
-- -----------------------------------------------------------------------------
-- user_id n'est volontairement pas une clé étrangère : le journal doit
-- survivre à la suppression d'un compte (le nom est conservé dans user_name).
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  user_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);
