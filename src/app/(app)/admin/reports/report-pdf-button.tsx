'use client';

import { FileDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { SalesReport } from '@/lib/database.types';
import { formatAmount } from '@/lib/format';
import { pdfSafe } from '@/lib/receipt';
import { reportSections } from '@/lib/report-sections';

export function ReportPdfButton({ report, currency, businessName }: { report: SalesReport; currency: string; businessName: string }) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(pdfSafe(businessName), 14, 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(pdfSafe(`Rapport des ventes — montants en ${currency}`), 14, 25);
      doc.setTextColor(110);
      doc.text(pdfSafe(`Édité le ${new Date().toLocaleString('fr-FR')}`), 14, 30);
      doc.setTextColor(0);

      let y = 36;
      for (const section of reportSections(report, currency)) {
        if (section.rows.length === 0) continue;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        if (y > 260) {
          doc.addPage();
          y = 18;
        }
        doc.text(pdfSafe(section.title), 14, y);
        autoTable(doc, {
          startY: y + 2,
          head: [section.headers.map(pdfSafe)],
          body: section.rows.map((row) => row.map((cell) => (typeof cell === 'number' ? pdfSafe(formatAmount(cell)) : pdfSafe(cell)))),
          styles: { fontSize: 8.5, cellPadding: 1.6 },
          headStyles: { fillColor: [17, 17, 17], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 246, 247] },
          columnStyles: Object.fromEntries(section.headers.map((_, i) => [i, { halign: i === 0 ? 'left' : 'right' }])),
          margin: { left: 14, right: 14 },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
      }
      doc.save(`rapport-${report.from}_${report.to}.pdf`);
    } catch {
      toast.error('Le PDF n’a pas pu être généré. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={generate} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <FileDown />} Exporter en PDF
    </Button>
  );
}
