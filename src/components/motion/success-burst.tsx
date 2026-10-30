'use client';

import { motion } from 'motion/react';

const PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const distance = 46 + (i % 3) * 10;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    size: i % 3 === 0 ? 8 : 6,
    color: i % 4 === 0 ? 'var(--foreground)' : i % 2 === 0 ? 'var(--primary)' : 'var(--chart-5)',
  };
});

// Coche dessinée + éclat de confettis : confirmation visuelle d'une vente.
export function SuccessBurst() {
  return (
    <div className="relative mx-auto mb-2 flex size-20 items-center justify-center" aria-hidden>
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      <motion.svg
        viewBox="0 0 52 52"
        className="size-16"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      >
        <circle cx="26" cy="26" r="25" fill="var(--accent)" />
        <motion.circle
          cx="26"
          cy="26"
          r="23"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
        <motion.path
          d="M15 27.5 L22.5 35 L37.5 19"
          fill="none"
          stroke="var(--primary-strong)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.3, ease: 'easeOut' }}
        />
      </motion.svg>
    </div>
  );
}
