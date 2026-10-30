-- =============================================================================
-- MassaGui Fils SARL.U — Migration 4/5 : stockage des images
-- Deux dossiers publics en lecture (les images s'affichent sur la caisse et
-- les reçus), modifiables uniquement par un administrateur.
-- SVG exclu volontairement (un SVG peut contenir du script).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('branding', 'branding', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "massagui_images_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id in ('product-images', 'branding') and (select public.is_admin()));

create policy "massagui_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-images', 'branding') and (select public.is_admin()));

create policy "massagui_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('product-images', 'branding') and (select public.is_admin()))
  with check (bucket_id in ('product-images', 'branding') and (select public.is_admin()));

create policy "massagui_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('product-images', 'branding') and (select public.is_admin()));
