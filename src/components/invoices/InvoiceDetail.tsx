'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Pencil,
  CreditCard,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { softDelete, update } from '@/lib/firestore/helpers';
import { useAuth } from '@/hooks/useAuth';
import type { InvoiceDoc, InvoiceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvoicePreview } from './InvoicePreview';
import { InvoicePDFExport } from './InvoicePDFExport';
import { RecordPaymentModal } from './RecordPaymentModal';
import { PaymentHistoryTable } from './PaymentHistoryTable';
import { InvoiceBuilder } from './InvoiceBuilder';
import { cn } from '@/lib/utils';

// ─── Status badge metadata ────────────────────────────────────────────────────

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft:   { label: 'Draft',   cls: 'bg-slate-100 text-slate-600' },
  unpaid:  { label: 'Unpaid',  cls: 'bg-blue-100 text-blue-700' },
  partial: { label: 'Partial', cls: 'bg-amber-100 text-amber-700' },
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700' },
  deleted: { label: 'Void',    cls: 'bg-slate-100 text-slate-400' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoiceDetailProps {
  invoice: InvoiceDoc;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  const { role } = useAuth();
  const router = useRouter();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isStaff = role === 'admin' || role === 'staff';
  const canEdit = invoice.status === 'draft';
  const canPay =
    invoice.status === 'unpaid' ||
    invoice.status === 'partial' ||
    invoice.status === 'overdue';

  const paidPercent =
    invoice.total > 0
      ? Math.min(100, Math.round((invoice.amountPaid / invoice.total) * 100))
      : 0;

  const meta = INVOICE_STATUS_META[invoice.status];
  const issueDateStr = invoice.issueDate
    ? format(new Date(invoice.issueDate.seconds * 1000), 'MMM d, yyyy')
    : '—';
  const dueDateStr = invoice.dueDate
    ? format(new Date(invoice.dueDate.seconds * 1000), 'MMM d, yyyy')
    : '—';

  const handleMarkPaid = async () => {
    if (!confirm('Mark this invoice as fully paid?')) return;
    try {
      await update<InvoiceDoc>('invoices', invoice.id, {
        status: 'paid' as InvoiceStatus,
        amountPaid: invoice.total,
        amountDue: 0,
      });
      toast.success('Invoice marked as paid');
    } catch {
      toast.error('Failed to update invoice');
    }
  };

  const handleVoid = async () => {
    if (!confirm('Void this invoice?')) return;
    try {
      await softDelete('invoices', invoice.id);
      toast.success('Invoice voided');
      router.push('/invoices');
    } catch {
      toast.error('Failed to void invoice');
    }
  };

  // Show builder when editing
  if (isEditing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Cancel Edit
        </Button>
        <InvoiceBuilder invoice={invoice} onSaved={() => setIsEditing(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/invoices')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Invoices
      </Button>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border bg-card p-4">
        {/* Left: number + status + key dates */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-lg">{invoice.invoiceNumber}</span>
            <Badge className={cn('border-0', meta.cls)}>{meta.label}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Issued {issueDateStr}</span>
            <span>Due {dueDateStr}</span>
            <span className="font-mono font-medium text-foreground">
              {invoice.currency} {invoice.total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <InvoicePDFExport invoice={invoice} />

          {isStaff && canPay && (
            <Button size="sm" onClick={() => setPaymentOpen(true)}>
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              Record Payment
            </Button>
          )}

          {isStaff && (invoice.status === 'unpaid' || invoice.status === 'partial' || invoice.status === 'overdue') && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-700 border-green-300 hover:bg-green-50"
              onClick={handleMarkPaid}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Mark as Paid
            </Button>
          )}

          {canEdit && isStaff && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}

          {role === 'admin' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleVoid}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Void
            </Button>
          )}
        </div>
      </div>

      {/* Payment progress bar */}
      {invoice.amountPaid > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment Progress</span>
            <span className="font-medium">{paidPercent}% paid</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${paidPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Paid: <span className="font-mono font-medium text-green-700">
                {invoice.currency} {invoice.amountPaid.toFixed(2)}
              </span>
            </span>
            <span>
              Due: <span className="font-mono font-medium text-red-600">
                {invoice.currency} {invoice.amountDue.toFixed(2)}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Invoice preview */}
      <div className="overflow-x-auto">
        <InvoicePreview invoice={invoice} inline />
      </div>

      {/* Payment history */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Payment History</h2>
        <PaymentHistoryTable invoiceId={invoice.id} currency={invoice.currency} />
      </div>

      {/* Record Payment modal */}
      <RecordPaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoice={invoice}
      />
    </div>
  );
}
