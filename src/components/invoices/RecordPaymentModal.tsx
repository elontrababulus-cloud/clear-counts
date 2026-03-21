'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { recordPayment } from '@/lib/firestore/helpers';
import type { InvoiceDoc, InvoiceStatus, PaymentMethod } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Payment method metadata ──────────────────────────────────────────────────

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; color: string }> = {
  cash:          { label: 'Cash',          color: '#64748B' },
  ecocash:       { label: 'EcoCash',       color: '#10B981' },
  bank_transfer: { label: 'Bank Transfer', color: '#1E40AF' },
  paypal:        { label: 'PayPal',        color: '#0070BA' },
  zipit:         { label: 'ZIPIT',         color: '#7C3AED' },
};

const METHODS = Object.keys(PAYMENT_METHOD_META) as PaymentMethod[];

// ─── Styles ───────────────────────────────────────────────────────────────────

const SELECT_CLS = cn(
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
);

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  amount: z.string().min(1, 'Amount is required'),
  method: z.enum(['cash', 'ecocash', 'bank_transfer', 'paypal', 'zipit']),
  reference: z.string(),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: InvoiceDoc;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecordPaymentModal({ open, onOpenChange, invoice }: RecordPaymentModalProps) {
  const { user } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: todayStr,
      amount: invoice.amountDue.toFixed(2),
      method: 'bank_transfer',
      reference: '',
      notes: '',
    },
  });

  const amountStr = watch('amount');

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    const amount = parseFloat(values.amount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }
    if (amount > invoice.amountDue + 0.001) {
      toast.error(`Amount cannot exceed the balance due (${invoice.currency} ${invoice.amountDue.toFixed(2)})`);
      return;
    }

    const newAmountPaid = invoice.amountPaid + amount;
    const newAmountDue = Math.max(0, invoice.amountDue - amount);
    const newStatus: InvoiceStatus = newAmountDue < 0.01 ? 'paid' : 'partial';

    try {
      await recordPayment(
        invoice.id,
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          clientUid: invoice.clientUid,
          clientName: invoice.clientName,
          amount,
          currency: invoice.currency,
          method: values.method as PaymentMethod,
          reference: values.reference || undefined,
          date: Timestamp.fromDate(new Date(values.date)),
          recordedBy: user.uid,
        },
        newStatus,
        newAmountPaid,
        newAmountDue,
      );

      toast.success(
        newStatus === 'paid'
          ? `Invoice fully paid! ${invoice.currency} ${amount.toFixed(2)} recorded.`
          : `Payment of ${invoice.currency} ${amount.toFixed(2)} recorded. Balance: ${invoice.currency} ${newAmountDue.toFixed(2)}.`,
      );
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to record payment');
    }
  };

  // Live amount validation display
  const enteredAmount = parseFloat(amountStr) || 0;
  const exceedsBalance = enteredAmount > invoice.amountDue + 0.001;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Balance summary */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Total</span>
              <span className="font-mono font-medium">{invoice.currency} {invoice.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already Paid</span>
              <span className="font-mono text-green-700">{invoice.currency} {invoice.amountPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1">
              <span className="font-medium">Balance Due</span>
              <span className="font-mono font-bold text-red-600">{invoice.currency} {invoice.amountDue.toFixed(2)}</span>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label htmlFor="date">Payment Date *</Label>
            <Input id="date" type="date" {...register('date')} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <Label htmlFor="amount">Amount ({invoice.currency}) *</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={invoice.amountDue}
              {...register('amount')}
              className={exceedsBalance ? 'border-destructive' : ''}
            />
            {exceedsBalance && (
              <p className="text-xs text-destructive">
                Amount exceeds balance due ({invoice.currency} {invoice.amountDue.toFixed(2)})
              </p>
            )}
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          {/* Method */}
          <div className="space-y-1">
            <Label htmlFor="method">Payment Method *</Label>
            <select id="method" {...register('method')} className={SELECT_CLS}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_META[m].label}</option>
              ))}
            </select>
          </div>

          {/* Reference */}
          <div className="space-y-1">
            <Label htmlFor="reference">Reference / Transaction ID</Label>
            <Input id="reference" {...register('reference')} placeholder="e.g. EcoCash TX#12345" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || exceedsBalance}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
