import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;
export type Bucket = 'product-images' | 'branding';

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Téléverse une image (déjà validée) avec la session de l'utilisateur :
// les politiques Storage n'autorisent que les administrateurs.
export async function uploadImage(supabase: Client, bucket: Bucket, file: File): Promise<{ url: string } | { error: string }> {
  const ext = EXTENSIONS[file.type];
  if (!ext) return { error: 'Format d’image non pris en charge.' };
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) return { error: 'Le téléversement de l’image a échoué. Réessayez.' };
  return { url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

// Supprime une ancienne image si elle appartient bien au dossier indiqué.
export async function removeImage(supabase: Client, bucket: Bucket, url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  await supabase.storage.from(bucket).remove([path]);
}
