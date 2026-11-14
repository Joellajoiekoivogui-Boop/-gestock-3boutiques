import Image from 'next/image';
import { cn } from '@/lib/utils';

// Coloris de catégorie (1 à 6), attribués dans l'ordre d'affichage des
// catégories : la même catégorie garde toujours la même couleur.
export const CATEGORY_TONES = 6;
export function toneForIndex(index: number) {
  return index < 0 ? 0 : (index % CATEGORY_TONES) + 1;
}
export function toneStyle(tone: number): React.CSSProperties {
  if (!tone) return { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' };
  return { backgroundColor: `var(--cat-${tone})`, color: `var(--cat-${tone}-fg)` };
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first = '', second] = words;
  const letters = second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2);
  return letters.toUpperCase();
}

/** Photo du produit, ou à défaut ses initiales sur l'aplat de sa catégorie. */
export function ProductThumb({
  name,
  imageUrl,
  tone = 0,
  sizes,
  className,
  imageClassName,
  textClassName = 'text-sm',
}: {
  name: string;
  imageUrl: string | null;
  tone?: number;
  sizes: string;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden', className)} style={imageUrl ? { backgroundColor: 'var(--muted)' } : toneStyle(tone)}>
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill sizes={sizes} className={cn('object-cover', imageClassName)} />
      ) : (
        <span aria-hidden className={cn('absolute inset-0 flex items-center justify-center font-display font-bold tracking-wide', textClassName)}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}
