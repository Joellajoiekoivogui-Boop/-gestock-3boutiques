-- Gestock 3B — Feuille de Vente + fusion du catalogue produits
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run.
-- Remplace/complète le fichier migration_feuille.sql (qui n'a apparemment pas
-- été appliqué avec succès la première fois — ce script recrée tout depuis
-- zéro avec "if not exists", donc sans risque de le lancer même si une partie
-- existait déjà).

-- Catalogue des articles de la feuille de vente, par boutique.
-- Persiste d'un jour à l'autre — seul le comptage (feuille_counts) change chaque jour.
create table if not exists feuille_articles (
  id uuid primary key default gen_random_uuid(),
  boutique_id text not null references boutiques(id),
  category text not null,
  designation text not null default '',
  p_vente numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Comptage quotidien par article : Initial / Nouveau / Reste.
create table if not exists feuille_counts (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references feuille_articles(id) on delete cascade,
  date date not null,
  initial numeric,
  nouveau numeric not null default 0,
  reste numeric,
  updated_at timestamptz not null default now(),
  unique (article_id, date)
);

create index if not exists feuille_counts_article_date_idx on feuille_counts (article_id, date desc);

alter table feuille_articles enable row level security;
alter table feuille_counts enable row level security;

-- feuille_articles devient LE catalogue produit de chaque boutique (utilisé
-- par la Caisse et l'Inventaire) : on y ajoute le stock disponible, le seuil
-- d'alerte et une image optionnelle.
alter table feuille_articles
  add column if not exists stock numeric not null default 0,
  add column if not exists min_alert_stock numeric not null default 0,
  add column if not exists image text;

-- Vérification : doit renvoyer 2 lignes (feuille_articles, feuille_counts).
-- Si ce tableau est vide ou n'affiche pas ces deux noms, ce n'est pas le bon projet.
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'feuille_%';
