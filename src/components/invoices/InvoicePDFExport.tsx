'use client';

import { useRef, useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { storage } from '@/lib/firebase';
import { update } from '@/lib/firestore/helpers';
import type { InvoiceDoc, CompanySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { InvoicePreview } from './InvoicePreview';

interface InvoicePDFExportProps {
  invoice: InvoiceDoc;
  settings?: Partial<CompanySettings> | null;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
}

export function InvoicePDFExport({
  invoice,
  settings,
  variant = 'outline',
  size = 'sm',
}: InvoicePDFExportProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    if (!previewRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);

      const pdfBlob = pdf.output('blob');
      const filePath = `invoices/${invoice.id}/invoice.pdf`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' });
      const downloadURL = await getDownloadURL(fileRef);

      await update<InvoiceDoc>('invoices', invoice.id, { pdfUrl: downloadURL } as Partial<InvoiceDoc>);

      pdf.save(`${invoice.invoiceNumber}.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={generatePDF} disabled={generating}>
        {generating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : (
          <Download className="h-3.5 w-3.5 mr-1" />
        )}
        {generating ? 'Generating…' : 'Download PDF'}
      </Button>

      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }} aria-hidden="true">
        <div ref={previewRef}>
          <InvoicePreview invoice={invoice} settings={settings} />
        </div>
      </div>
    </>
  );
}
