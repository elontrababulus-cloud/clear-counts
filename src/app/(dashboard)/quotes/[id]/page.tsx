'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import {
  ArrowLeft,
  Pencil,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  subscribeToDoc,
  update,
  softDelete,
  convertQuoteToInvoice,
  getNextCounter,
  formatInvoiceNumber,
  subscribeToDoc,
} from '@/lib/firestore/helpers';
import { useAuth } from '@/hooks/useAuth';
import type { QuoteDoc, QuoteStatus, CompanySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
import { QuotePreview } from '@/components/quotes/QuotePreview';
const QuotePDFExport = dynamic(() => import('@/components/quotes/QuotePDFExport').then(m => m.QuotePDFExport), { ssr: false });
import { QuoteBuilder } from '@/components/quotes/QuoteBuilder';
import { QUOTE_STATUS_META } from '@/components/quotes/QuotesList';
import { SendEmailModal } from '@/components/shared/SendEmailModal';
import { cn } from '@/lib/utils';

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useAuth();
  const [quote, setQuote] = useState<QuoteDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    const unsub = subscribeToDoc<CompanySettings>('settings', 'company', setSettings);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToDoc<QuoteDoc>('quotes', id, (data) => {
      setQuote(data);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  // ── Status transitions ────────────────────────────────────────────────────

  const changeStatus = async (newStatus: QuoteStatus) => {
    if (!quote) return;
    setWorking(true);
    try {
      await update<QuoteDoc>('quotes', quote.id, { status: newStatus });
      toast.success(`Quote marked as ${QUOTE_STATUS_META[newStatus].label}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    } finally {
      setWorking(false);
    }
  };

  // ── Convert to Invoice ────────────────────────────────────────────────────

  const convertToInvoice = async () => {
    if (!quote) return;
    if (!confirm('Convert this quote to an invoice?')) return;
    setWorking(true);
    try {
      const counter = await getNextCounter('invoiceCounter');
      const invoiceNumber = formatInvoiceNumber(counter, settings ?? {});
      const now = Timestamp.now();
      const dueDate = Timestamp.fromDate(
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 days
      );

      const invoiceId = await convertQuoteToInvoice(quote.id, {
        invoiceNumber,
        clientId: quote.clientId,
        clientUid: quote.clientUid,
        clientName: quote.clientName,
        quoteId: quote.id,
        lineItems: quote.lineItems,
        subtotal: quote.subtotal,
        taxTotal: quote.taxTotal,
        total: quote.total,
        amountPaid: 0,
        amountDue: quote.total,
        currency: quote.currency,
        status: 'unpaid',
        issueDate: now,
        dueDate,
        createdBy: quote.createdBy,
      });

      toast.success(`Invoice ${invoiceNumber} created`);
      router.push(`/invoices/${invoiceId}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to convert to invoice');
    } finally {
      setWorking(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!quote) return;
    if (!confirm('Void this quote?')) return;
    try {
      await softDelete('quotes', quote.id);
      toast.success('Quote voided');
      router.push('/quotes');
    } catch {
      toast.error('Failed to void quote');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!quote || quote.status === 'deleted') {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <FileText className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Quote not found or has been voided.</p>
        <Button variant="outline" onClick={() => router.push('/quotes')}>
          Back to Quotes
        </Button>
      </div>
    );
  }

  // Show builder when editing
  if (isEditing) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(false)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Cancel Edit
        </Button>
        <QuoteBuilder
          quote={quote}
          onSaved={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const meta = QUOTE_STATUS_META[quote.status];
  const canEdit = quote.status === 'draft' || quote.status === 'sent';
  const isStaff = role === 'admin' || role === 'staff';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/quotes')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Quotes
      </Button>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-lg">{quote.quoteNumber}</span>
          <Badge className={cn('border-0', meta.cls)}>{meta.label}</Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* PDF download */}
          <QuotePDFExport quote={quote} />

          {/* Send by email */}
          {isStaff && quote.status !== 'draft' && (
            <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
              <Mail className="h-3.5 w-3.5 mr-1" />
              Send by Email
            </Button>
          )}

          {/* Status workflow — admin/staff only */}
          {isStaff && (
            <>
              {quote.status === 'draft' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus('sent')}
                  disabled={working}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Mark as Sent
                </Button>
              )}

              {quote.status === 'sent' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => changeStatus('accepted')}
                    disabled={working}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Record Acceptance
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => changeStatus('declined')}
                    disabled={working}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Record Decline
                  </Button>
                </>
              )}

              {quote.status === 'accepted' && (
                <Button
                  size="sm"
                  onClick={convertToInvoice}
                  disabled={working}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Convert to Invoice
                </Button>
              )}
            </>
          )}

          {/* Edit (draft or sent only) */}
          {canEdit && isStaff && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit Quote
            </Button>
          )}

          {/* Void */}
          {role === 'admin' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              Void
            </Button>
          )}
        </div>
      </div>

      {/* Quote preview */}
      <div className="overflow-x-auto">
        <QuotePreview quote={quote} inline />
      </div>

      {/* Send by Email modal */}
      <SendEmailModal
        open={emailOpen}
        onOpenChange={setEmailOpen}
        docId={quote.id}
        docType="quote"
        docNumber={quote.quoteNumber}
        defaultEmail={quote.clientEmail ?? ''}
        defaultName={quote.clientName ?? ''}
      />
    </div>
  );
}
