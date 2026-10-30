'use client';

import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatAmount, formatMoney } from '@/lib/format';

// Avant le premier rendu navigateur : useLayoutEffect (pas de saut visible),
// côté serveur : useEffect (évite l'avertissement de React).
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Nombre qui défile jusqu'à sa valeur : de 0 à l'affichage de la page, puis de
// l'ancienne à la nouvelle valeur. Le rendu serveur montre directement la
// valeur finale (lisible sans JavaScript et pour les lecteurs d'écran).
function useCountUp(value: number, duration = 0.9) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  // Valeur réellement affichée : point de départ de l'animation suivante
  // (y compris si la valeur change au milieu d'une animation).
  const shown = useRef<number | null>(null);

  useIsoLayoutEffect(() => {
    const from = shown.current ?? 0;
    if (reduce || from === value) {
      shown.current = value;
      setDisplay(value);
      return;
    }
    setDisplay(from); // avant la première peinture : pas de saut de la valeur finale à 0
    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        shown.current = latest;
        setDisplay(Math.round(latest));
      },
      onComplete: () => {
        shown.current = value;
        setDisplay(value); // valeur exacte, sans arrondi intermédiaire
      },
    });
    return () => controls.stop();
  }, [value, reduce, duration]);

  return display;
}

export function AnimatedMoney({ value, currency = 'GNF', duration }: { value: number; currency?: string; duration?: number }) {
  const display = useCountUp(Number(value) || 0, duration);
  return <span className="tabular-nums">{formatMoney(display, currency)}</span>;
}

export function AnimatedCount({ value, duration }: { value: number; duration?: number }) {
  const display = useCountUp(Number(value) || 0, duration);
  return <span className="tabular-nums">{formatAmount(display)}</span>;
}
