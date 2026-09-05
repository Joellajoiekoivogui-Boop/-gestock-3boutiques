-- Gestock 3B — schéma Supabase (Postgres)
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run.
--
-- Sécurité : RLS est activé sur toutes les tables et AUCUNE policy n'est créée
-- pour les rôles "anon" / "authenticated". Résultat : la clé publique (anon key)
-- ne donne accès à RIEN. Seule la clé "service_role" (utilisée uniquement côté
-- serveur, dans les fonctions Vercel api/*.js, jamais exposée au navigateur)
-- peut lire/écrire, car service_role contourne RLS par défaut chez Supabase.
-- C'est cohérent avec l'authentification maison déjà en place (api/login.js).

-- ============================================================
-- BOUTIQUES (référence statique)
-- ============================================================
create table if not exists boutiques (
  id text primary key,
  name text not null,
  location text,
  manager text,
  phone text,
  color text
);

-- ============================================================
-- PRODUITS
-- stocks : { "b1": 45, "b2": 12, "b3": 28 } — même forme que côté app
-- ============================================================
create table if not exists products (
  id text primary key default 'p-' || substr(gen_random_uuid()::text, 1, 8),
  name text not null,
  category text,
  buy_price numeric not null default 0,
  sell_price numeric not null default 0,
  min_alert_stock int not null default 0,
  image text,
  stocks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CLIENTS
-- ============================================================
create table if not exists customers (
  id text primary key default 'c-' || substr(gen_random_uuid()::text, 1, 8),
  name text not null,
  phone text,
  boutique_id text references boutiques(id),
  total_debt numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- VENTES
-- items : [{ productId, name, quantity, unitPrice }, ...]
-- Les ids "V-xxxx" sont générés côté base via une séquence pour éviter
-- toute collision entre boutiques qui vendent en même temps.
-- ============================================================
create sequence if not exists sales_id_seq start 1005;

create table if not exists sales (
  id text primary key default 'V-' || nextval('sales_id_seq'),
  boutique_id text not null references boutiques(id),
  date timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  payment_method text not null check (payment_method in ('cash', 'orange_money', 'credit')),
  cash_received numeric,
  cash_change numeric,
  om_reference text,
  customer_name text,
  customer_id text,
  due_date date,
  seller text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- DETTES
-- repayments : [{ id, date, amount, paymentMethod, omRef, receivedBy }, ...]
-- ============================================================
create sequence if not exists debts_id_seq start 204;

create table if not exists debts (
  id text primary key default 'D-' || nextval('debts_id_seq'),
  customer_id text,
  customer_name text,
  phone text,
  boutique_id text not null references boutiques(id),
  sale_id text references sales(id),
  date timestamptz not null default now(),
  due_date date,
  original_amount numeric not null,
  remaining_amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'overdue')),
  repayments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- DÉPENSES
-- ============================================================
create sequence if not exists expenses_id_seq start 304;

create table if not exists expenses (
  id text primary key default 'E-' || nextval('expenses_id_seq'),
  boutique_id text not null references boutiques(id),
  date timestamptz not null default now(),
  category text,
  description text,
  amount numeric not null default 0,
  recorded_by text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security — activé partout, aucune policy = accès refusé
-- pour anon/authenticated. Seule la clé service_role (serveur) passe.
-- ============================================================
alter table boutiques enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table debts enable row level security;
alter table expenses enable row level security;

-- ============================================================
-- Données de démo (mêmes valeurs que src/utils/initialData.js)
-- ============================================================
insert into boutiques (id, name, location, manager, phone, color) values
  ('b1', 'Boutique Kissosso', 'Kissosso, Matoto - Conakry', 'Mamadou Diallo', '+224 620 11 22 33', '#6366f1'),
  ('b2', 'Boutique Tombolia', 'Tombolia, Matoto - Conakry', 'Aminata Touré', '+224 664 22 33 44', '#10b981'),
  ('b3', 'Boutique Sangoyah', 'Sangoyah, Ratoma - Conakry', 'Kouassi Jean', '+224 628 33 44 55', '#f59e0b')
on conflict (id) do nothing;

insert into products (id, name, category, buy_price, sell_price, min_alert_stock, stocks, image) values
  ('p1', 'Charbon Coconut Premium 1kg', 'charbon', 2500, 4500, 15, '{"b1":45,"b2":12,"b3":28}', 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80'),
  ('p2', 'Charbon Auto-allumant Belgocida (Boîte 100)', 'charbon', 1800, 3500, 10, '{"b1":30,"b2":25,"b3":8}', 'https://images.unsplash.com/photo-1520699049698-acd2fccb8cc8?auto=format&fit=crop&w=300&q=80'),
  ('p3', 'Arôme Double Pomme Al-Fakher 250g', 'aromes', 6000, 10000, 8, '{"b1":20,"b2":18,"b3":15}', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=300&q=80'),
  ('p4', 'Arôme Menthe Fraîche Adalya 250g', 'aromes', 6000, 10000, 8, '{"b1":14,"b2":5,"b3":22}', 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=300&q=80'),
  ('p5', 'Arôme Love 66 Adalya 250g', 'aromes', 6500, 11000, 10, '{"b1":25,"b2":30,"b3":16}', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80'),
  ('p6', 'Arôme Pêche Glacée 250g', 'aromes', 5800, 9500, 6, '{"b1":10,"b2":12,"b3":4}', 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=300&q=80'),
  ('p7', 'Chicha Celeste X-Glass Chrome', 'chicha', 25000, 45000, 3, '{"b1":6,"b2":4,"b3":2}', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80'),
  ('p8', 'Chicha Compact Travel LED', 'chicha', 14000, 24000, 4, '{"b1":8,"b2":9,"b3":5}', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&q=80'),
  ('p9', 'Tuyau Silicone Grip Carbon Pro', 'tuyaux', 3500, 7000, 5, '{"b1":15,"b2":10,"b3":12}', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80'),
  ('p10', 'Système de Chauffe Kaloud Plus', 'tuyaux', 5000, 9500, 5, '{"b1":11,"b2":3,"b3":9}', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=300&q=80'),
  ('p11', 'Pipe en Bois de Rose Artisanale', 'pipes', 8500, 16000, 3, '{"b1":5,"b2":4,"b3":6}', 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80'),
  ('p12', 'Foyer Céramique Phunnel Gloss', 'pipes', 2000, 4200, 8, '{"b1":22,"b2":15,"b3":19}', 'https://images.unsplash.com/photo-1520699049698-acd2fccb8cc8?auto=format&fit=crop&w=300&q=80')
on conflict (id) do nothing;

insert into customers (id, name, phone, boutique_id, total_debt) values
  ('c1', 'Koffi Serge', '+224 621 44 33 22', 'b1', 19500),
  ('c2', 'Lounge Le Palmier', '+224 664 11 22 33', 'b3', 45000),
  ('c3', 'Yao Ibrahim', '+224 628 99 88 77', 'b2', 10000),
  ('c4', 'Shisha Club Madina', '+224 622 55 66 77', 'b2', 0)
on conflict (id) do nothing;
