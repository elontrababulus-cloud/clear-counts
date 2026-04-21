'use client';

import { pdf } from '@react-pdf/renderer';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { storage } from '@/lib/firebase';
import { update } from '@/lib/firestore/helpers';
import type { QuoteDoc, CompanySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { QuotePDFDocument } from './QuotePDFDocument';

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
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);

    try {
      // 1. Create the PDF blob using the professional engine
      const blob = await pdf(
        <QuotePDFDocument quote={quote} settings={settings ?? null} />
      ).toBlob();

      // 2. Upload to Firebase Storage for record keeping
      const filePath = `quotes/${quote.id}/quote.pdf`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, blob, { contentType: 'application/pdf' });
      const downloadURL = await getDownloadURL(fileRef);

      // 3. Stamp the quote with the PDF URL
      await update<QuoteDoc>('quotes', quote.id, { pdfUrl: downloadURL });

      // 4. Trigger browser download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${quote.quoteNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={generatePDF} disabled={generating}>
      {generating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
      ) : (
        <Download className="h-3.5 w-3.5 mr-1" />
      )}
      {generating ? 'Generating…' : 'Download PDF'}
    </Button>
  );
}
