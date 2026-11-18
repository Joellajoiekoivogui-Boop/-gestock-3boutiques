'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Imprime la page sur une feuille A4 (ou l'enregistre en PDF depuis le navigateur). */
export function PrintButton({ label = 'Imprimer' }: { label?: string }) {
  return (
    <Button
      size="lg"
      onClick={() => {
        const id = 'a4-page-rule';
        document.getElementById(id)?.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = '@page { size: A4; margin: 12mm; }';
        document.head.appendChild(style);
        window.print();
      }}
    >
      <Printer aria-hidden /> {label}
    </Button>
  );
}
