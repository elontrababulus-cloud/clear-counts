'use client';

import { useEffect, useState } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type { PaymentDoc } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { PAYMENT_METHOD_META } from './RecordPaymentModal';
import { cn } from '@/lib/utils';

interface PaymentHistoryTableProps {
  invoiceId: string;
  currency: string;
}

export function PaymentHistoryTable({ invoiceId, currency }: PaymentHistoryTableProps) {
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCollection<PaymentDoc>(
      'payments',
      [where('invoiceId', '==', invoiceId), orderBy('createdAt', 'desc')],
      (data) => {
        setPayments(data);
        setLoading(false);
      },
    );
    return unsub;
  }, [invoiceId]);

  const total = payments.reduce((s, p) => s + p.amount, 0);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">No payments recorded yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {['Date', 'Method', 'Reference', 'Amount', 'Recorded By'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const methodMeta = PAYMENT_METHOD_META[p.method];
            const dateStr = p.date
              ? format(new Date(p.date.seconds * 1000), 'MMM d, yyyy')
              : '—';

            return (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3">{dateStr}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white',
                    )}
                    style={{ backgroundColor: methodMeta?.color ?? '#6b7280' }}
                  >
                    {methodMeta?.label ?? p.method}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {p.reference ?? '—'}
                </td>
                <td className="px-4 py-3 font-mono font-medium">
                  {currency} {p.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                  {p.recordedBy.slice(0, 8)}…
                </td>
              </tr>
            );
          })}
        </tbody>
        {/* Total row */}
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/20">
            <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
              Total Paid
            </td>
            <td className="px-4 py-2.5 font-mono font-bold">
              {currency} {total.toFixed(2)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
