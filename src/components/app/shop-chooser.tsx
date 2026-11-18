'use client';

import { Store } from 'lucide-react';
import { useTransition } from 'react';
import { chooseShopAction } from '@/app/actions/shop';
import { Button } from '@/components/ui/button';

/** Grand choix de boutique, quand une page a besoin d'une seule boutique (la caisse). */
export function ShopChooser({
  shops,
  title,
  description,
}: {
  shops: { id: string; name: string }[];
  title: string;
  description: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-card p-6 text-center shadow-card">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-forest text-gold-light">
        <Store className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 font-serif text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-muted-foreground">{description}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {shops.map((shop) => (
          <Button
            key={shop.id}
            size="lg"
            className="h-16 text-lg"
            disabled={pending}
            onClick={() => start(() => chooseShopAction(shop.id))}
          >
            {shop.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
