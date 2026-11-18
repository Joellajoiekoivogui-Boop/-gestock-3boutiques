'use client';

import { Store } from 'lucide-react';
import { useTransition } from 'react';
import { chooseShopAction } from '@/app/actions/shop';
import { cn } from '@/lib/utils';

type Shop = { id: string; name: string };

/** Choix de la boutique par l'administrateur : chaque page suit ce choix. */
export function ShopSwitcher({ shops, currentId }: { shops: Shop[]; currentId: string | null }) {
  const [pending, start] = useTransition();
  const options = [{ id: 'all', name: 'Toutes les boutiques' }, ...shops];
  const selected = currentId ?? 'all';
  return (
    <div className="no-print border-b bg-forest text-forest-foreground">
      <div
        role="group"
        aria-label="Boutique affichée"
        aria-busy={pending}
        className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6"
      >
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gold-light">
          <Store className="size-4" aria-hidden /> Boutique
        </span>
        {options.map((shop) => {
          const active = shop.id === selected;
          return (
            <button
              key={shop.id}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => !active && start(() => chooseShopAction(shop.id))}
              className={cn(
                'inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                active ? 'bg-gold-light text-forest' : 'text-forest-foreground/85 hover:bg-white/10',
                pending && !active && 'opacity-60',
              )}
            >
              {shop.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
