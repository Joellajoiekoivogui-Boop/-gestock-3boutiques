-- =============================================================================
-- MassaGui Fils SARL.U — Migration 5/5 : données de référence
-- Uniquement de la configuration (aucune vente, aucun produit fictif).
-- Adresse, téléphone et e-mail restent vides : à renseigner dans Paramètres.
-- =============================================================================

insert into public.restaurant_settings (id) values (1)
on conflict (id) do nothing;

insert into public.categories (name, sort_order) values
  ('Plats africains', 10),
  ('Plats européens', 20),
  ('Boissons', 30),
  ('Desserts', 40),
  ('Petit-déjeuner', 50),
  ('Autres produits', 60)
on conflict do nothing;

-- Les paiements mobiles sont enregistrés comme moyens d'encaissement :
-- aucune API opérateur n'est connectée.
insert into public.payment_methods (code, label, sort_order) values
  ('cash', 'Espèces', 10),
  ('orange_money', 'Orange Money', 20),
  ('mtn_momo', 'MTN Mobile Money', 30),
  ('bank_transfer', 'Virement bancaire', 40),
  ('other', 'Autre', 50)
on conflict (code) do nothing;
