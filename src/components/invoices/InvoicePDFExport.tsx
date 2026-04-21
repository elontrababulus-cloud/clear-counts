'use client';

import { pdf } from '@react-pdf/renderer';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { storage } from '@/lib/firebase';
import { update } from '@/lib/firestore/helpers';
import type { InvoiceDoc, CompanySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { InvoicePDFDocument } from './InvoicePDFDocument';

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
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // 1. Create the PDF blob using the professional engine
      const blob = await pdf(
        <InvoicePDFDocument invoice={invoice} settings={settings ?? null} />
      ).toBlob();

      // 2. Upload to Firebase Storage for record keeping
      const filePath = `invoices/${invoice.id}/invoice.pdf`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, blob, { contentType: 'application/pdf' });
      const downloadURL = await getDownloadURL(fileRef);

      // 3. Stamp the invoice with the PDF URL
      await update<InvoiceDoc>('invoices', invoice.id, { pdfUrl: downloadURL } as Partial<InvoiceDoc>);

      // 4. Trigger browser download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF');
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
