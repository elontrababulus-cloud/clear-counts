'use client';

import { useRef, useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { storage } from '@/lib/firebase';
import { update } from '@/lib/firestore/helpers';
import type { QuoteDoc, CompanySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { QuotePreview } from './QuotePreview';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuotePDFExportProps {
  quote: QuoteDoc;
  settings?: Partial<CompanySettings> | null;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuotePDFExport({
  quote,
  settings,
  variant = 'outline',
  size = 'sm',
}: QuotePDFExportProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    if (!previewRef.current) return;
    setGenerating(true);

    try {
      // Dynamic imports to keep initial bundle small and avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Capture the hidden preview element
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

      // Convert to Blob for Firebase Storage upload
      const pdfBlob = pdf.output('blob');
      const filePath = `quotes/${quote.id}/quote.pdf`;
      const fileRef = storageRef(storage, filePath);

      await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' });
      const downloadURL = await getDownloadURL(fileRef);

      // Stamp the quote with the PDF URL
      await update<QuoteDoc>('quotes', quote.id, { pdfUrl: downloadURL });

      // Trigger browser download
      pdf.save(`${quote.quoteNumber}.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
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

      {/*
       * Hidden preview rendered off-screen.
       * html2canvas requires the element to be in the DOM (not display:none).
       * We use absolute positioning off-screen at a fixed 794px width so
       * html2canvas captures a faithful A4-sized layout.
       */}
      <div
        style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}
        aria-hidden="true"
      >
        <div ref={previewRef}>
          <QuotePreview quote={quote} settings={settings} />
        </div>
      </div>
    </>
  );
}
