import {
  Beef,
  CakeSlice,
  Coffee,
  CookingPot,
  Croissant,
  CupSoda,
  type LucideIcon,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Teinte de catégorie (1 à 6), attribuée dans l'ordre d'affichage des
// catégories : la même catégorie garde toujours la même teinte.
export const CATEGORY_TONES = 6;
export function toneForIndex(index: number) {
  return index < 0 ? 0 : (index % CATEGORY_TONES) + 1;
}
export function toneColor(tone: number) {
  return tone ? `var(--cat-${tone})` : 'var(--muted-foreground)';
}
/** Fond pâle et pictogramme dans la teinte de la catégorie. */
export function toneStyle(tone: number): React.CSSProperties {
  const color = toneColor(tone);
  return { backgroundColor: `color-mix(in srgb, ${color} 12%, white)`, color };
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Pictogramme d'une catégorie ou d'un plat, deviné d'après son nom.
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/boisson|jus|soda|eau|coca|biere|vin|the\b|cocktail/, CupSoda],
  [/cafe|expresso|espresso/, Coffee],
  [/dessert|gateau|crepe|glace|patisserie|fruit/, CakeSlice],
  [/petit.?dejeuner|croissant|viennoiserie|pain|omelette/, Croissant],
  [/pizza/, Pizza],
  [/salade/, Salad],
  [/sandwich|burger|chawarma|shawarma/, Sandwich],
  [/viande|steak|grill|brochette|boeuf/, Beef],
  [/soupe|sauce|bouillon/, Soup],
  [/africain|riz|yassa|attieke|fouti|mafe|plat/, CookingPot],
];
export function iconFor(name: string): LucideIcon {
  const n = normalize(name);
  return ICON_RULES.find(([pattern]) => pattern.test(n))?.[1] ?? UtensilsCrossed;
}

/** Pictogramme d'un plat ou d'une catégorie, choisi d'après son nom. */
export function DishIcon({ name, className, strokeWidth }: { name: string; className?: string; strokeWidth?: number }) {
  const n = normalize(name);
  const index = ICON_RULES.findIndex(([pattern]) => pattern.test(n));
  const props = { className, strokeWidth, 'aria-hidden': true } as const;
  switch (index) {
    case 0: return <CupSoda {...props} />;
    case 1: return <Coffee {...props} />;
    case 2: return <CakeSlice {...props} />;
    case 3: return <Croissant {...props} />;
    case 4: return <Pizza {...props} />;
    case 5: return <Salad {...props} />;
    case 6: return <Sandwich {...props} />;
    case 7: return <Beef {...props} />;
    case 8: return <Soup {...props} />;
    case 9: return <CookingPot {...props} />;
    default: return <UtensilsCrossed {...props} />;
  }
}

/** Photo du produit, ou à défaut un emplacement teinté avec son pictogramme. */
export function ProductThumb({
  name,
  imageUrl,
  tone = 0,
  sizes,
  className,
  imageClassName,
  iconClassName = 'size-8',
}: {
  name: string;
  imageUrl: string | null;
  tone?: number;
  sizes: string;
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden', className)} style={imageUrl ? { backgroundColor: 'var(--muted)' } : toneStyle(tone)}>
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill sizes={sizes} className={cn('object-cover', imageClassName)} />
      ) : (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <DishIcon name={name} className={cn('opacity-80', iconClassName)} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
