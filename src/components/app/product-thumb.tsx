import Image from 'next/image';
import { cn } from '@/lib/utils';

// Teintes douces dérivées de la charte (vert, ambre, gris) : chaque catégorie
// garde toujours la même, pour repérer un produit sans photo d'un coup d'œil.
// Texte foncé sur fond pâle : contraste ≥ 4,5:1 pour toutes les paires.
const TONES = [
  'bg-[#e3f8ec] text-[#0b5c34]',
  'bg-[#fff4d6] text-[#7a5400]',
  'bg-[#e8eef7] text-[#274690]',
  'bg-[#fbe9e7] text-[#8a2c1d]',
  'bg-[#efe9f7] text-[#5b3b8c]',
  'bg-[#eef0f2] text-[#3f454b]',
] as const;

function toneFor(key: string | null | undefined) {
  if (!key) return TONES[5];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first = '', second] = words;
  const letters = second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2);
  return letters.toUpperCase();
}

/** Photo du produit, ou à défaut ses initiales sur la teinte de sa catégorie. */
export function ProductThumb({
  name,
  imageUrl,
  toneKey,
  sizes,
  className,
  imageClassName,
  textClassName = 'text-sm',
}: {
  name: string;
  imageUrl: string | null;
  toneKey?: string | null;
  sizes: string;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden', !imageUrl && toneFor(toneKey), imageUrl && 'bg-muted', className)}>
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill sizes={sizes} className={cn('object-cover', imageClassName)} />
      ) : (
        <span
          aria-hidden
          className={cn('absolute inset-0 flex items-center justify-center font-bold tracking-wide', textClassName)}
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}
