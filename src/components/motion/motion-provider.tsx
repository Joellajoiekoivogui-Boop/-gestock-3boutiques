'use client';

import { MotionConfig } from 'motion/react';

// Respecte le réglage « réduire les animations » de l'appareil : les
// déplacements sont alors supprimés, seules les apparitions en fondu restent.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
