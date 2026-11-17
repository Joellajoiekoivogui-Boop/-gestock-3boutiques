'use client';

import { useRef } from 'react';

/**
 * Formulaire GET qui s'applique tout seul : un menu déroulant s'applique dès
 * qu'il change, un champ texte après une courte pause de frappe.
 */
export function AutoSubmitForm({ delay = 450, ...props }: React.ComponentProps<'form'> & { delay?: number }) {
  const timer = useRef<number | null>(null);
  return (
    <form
      {...props}
      onChange={(event) => {
        const form = event.currentTarget;
        const target = event.target as HTMLElement;
        if (timer.current) window.clearTimeout(timer.current);
        if (target.tagName === 'SELECT') form.requestSubmit();
        else timer.current = window.setTimeout(() => form.requestSubmit(), delay);
      }}
    />
  );
}
