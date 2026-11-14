'use client';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Sur téléphone, les filtres sont repliés derrière un bouton pour que la liste
 * soit visible dès l'ouverture de la page. À partir de 640 px, ils sont
 * toujours affichés. Ouverts d'office si un filtre est actif.
 */
export function CollapsibleFilters({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(activeCount > 0);
  const id = useId();
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between sm:hidden"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal aria-hidden /> Filtres
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
      </Button>
      <div id={id} className={cn('sm:block', open ? 'mt-4 sm:mt-0' : 'hidden')}>
        {children}
      </div>
    </div>
  );
}
