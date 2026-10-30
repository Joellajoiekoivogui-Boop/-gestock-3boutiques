'use client';

import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { downloadReceiptPdf } from '@/components/receipt/receipt-pdf';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ReceiptFormat } from '@/lib/database.types';
import { RECEIPT_FORMATS } from '@/lib/receipt';
import type { ReceiptData } from '@/lib/sales';

// Règle @page adaptée au format : un ticket thermique reçoit une page de la
// hauteur exacte du reçu (pas de coupe au milieu, pas de papier gaspillé).
function applyPageRule(format: ReceiptFormat) {
  const id = 'receipt-page-rule';
  document.getElementById(id)?.remove();
  const style = document.createElement('style');
  style.id = id;
  if (format === 'a4') {
    style.textContent = '@page { size: A4; margin: 12mm; }';
  } else {
    const el = document.getElementById('receipt');
    const heightMm = el ? Math.ceil((el.offsetHeight * 25.4) / 96) + 4 : 200;
    const width = format === '58mm' ? 58 : 80;
    style.textContent = `@page { size: ${width}mm ${heightMm}mm; margin: 0; }`;
  }
  document.head.appendChild(style);
}

export function ReceiptToolbar({
  data,
  format,
  backHref,
  autoPrint,
}: {
  data: ReceiptData;
  format: ReceiptFormat;
  backHref: string;
  autoPrint: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [downloading, setDownloading] = useState(false);
  const printed = useRef(false);

  const print = useCallback(() => {
    applyPageRule(format);
    window.print();
  }, [format]);

  useEffect(() => {
    if (autoPrint && !printed.current) {
      printed.current = true;
      // Laisse le temps au reçu (et au logo) de s'afficher.
      const timer = setTimeout(print, 600);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, print]);

  function changeFormat(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('format', value);
    params.delete('print');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadReceiptPdf(data, format);
    } catch {
      toast.error('Le PDF n’a pas pu être généré. Réessayez.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-2">
      <Button asChild variant="outline">
        <Link href={backHref}>
          <ArrowLeft /> Retour
        </Link>
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Select value={format} onValueChange={changeFormat}>
          <SelectTrigger className="w-40" aria-label="Format du reçu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECEIPT_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={download} disabled={downloading}>
          {downloading ? <Loader2 className="animate-spin" /> : <Download />} PDF
        </Button>
        <Button onClick={print}>
          <Printer /> Imprimer
        </Button>
      </div>
    </div>
  );
}
