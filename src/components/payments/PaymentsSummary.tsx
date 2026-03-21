'use client';

import { useEffect, useState } from 'react';
import { where, orderBy, Timestamp } from 'firebase/firestore';
import { startOfMonth, startOfYear } from 'date-fns';
import { DollarSign, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type { PaymentDoc, InvoiceDoc, PaymentMethod } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { METHOD_CONFIG } from './PaymentMethodBadge';
import { cn } from '@/lib/utils';

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentsSummary() {
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let paymentsLoaded = false;
    let invoicesLoaded = false;

    const checkDone = () => {
      if (paymentsLoaded && invoicesLoaded) setLoading(false);
    };

    const unsubPayments = subscribeToCollection<PaymentDoc>(
      'payments',
      [orderBy('createdAt', 'desc')],
      (data) => {
        setPayments(data);
        paymentsLoaded = true;
        checkDone();
      },
    );

    const unsubInvoices = subscribeToCollection<InvoiceDoc>(
      'invoices',
      [where('status', 'in', ['unpaid', 'partial', 'overdue'])],
      (data) => {
        setInvoices(data);
        invoicesLoaded = true;
        checkDone();
      },
    );

    return () => {
      unsubPayments();
      unsubInvoices();
    };
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const monthStart = Timestamp.fromDate(startOfMonth(new Date()));
  const yearStart = Timestamp.fromDate(startOfYear(new Date()));

  const collectedThisMonth = payments
    .filter((p) => p.date && p.date.seconds >= monthStart.seconds)
    .reduce((s, p) => s + p.amount, 0);

  const collectedThisYear = payments
    .filter((p) => p.date && p.date.seconds >= yearStart.seconds)
    .reduce((s, p) => s + p.amount, 0);

  const allTimeTotal = payments.reduce((s, p) => s + p.amount, 0);

  const pending = invoices.reduce((s, i) => s + i.amountDue, 0);

  // ── Payment method breakdown ───────────────────────────────────────────────

  const methods = Object.keys(METHOD_CONFIG) as PaymentMethod[];

  const breakdown = methods.map((method) => {
    const methodPayments = payments.filter((p) => p.method === method);
    return {
      method,
      count: methodPayments.length,
      total: methodPayments.reduce((s, p) => s + p.amount, 0),
    };
  });

  const maxTotal = Math.max(...breakdown.map((b) => b.total), 1);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Calendar className="h-5 w-5 text-blue-600" />}
          label="Collected This Month"
          value={`$${collectedThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bgCls="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-violet-600" />}
          label="Collected This Year"
          value={`$${collectedThisYear.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bgCls="bg-violet-50"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label="All-Time Total"
          value={`$${allTimeTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bgCls="bg-green-50"
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          label="Pending (Outstanding)"
          value={`$${pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bgCls="bg-red-50"
          valueClass={pending > 0 ? 'text-red-600' : undefined}
        />
      </div>

      {/* ── Payment method breakdown ── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Payment Method Breakdown
        </h2>

        {allTimeTotal === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {breakdown
              .filter((b) => b.total > 0)
              .sort((a, b) => b.total - a.total)
              .map(({ method, count, total }) => {
                const cfg = METHOD_CONFIG[method];
                const Icon = cfg.Icon;
                const barWidth = Math.max(2, Math.round((total / maxTotal) * 100));

                return (
                  <div key={method} className="space-y-1.5">
                    {/* Label row */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center justify-center h-6 w-6 rounded-full"
                          style={{ backgroundColor: `${cfg.hex}18` }}
                        >
                          <span style={{ color: cfg.hex, display: 'flex' }}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                        </span>
                        <span className="font-medium">{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {count} payment{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums">
                        ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* CSS bar */}
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: cfg.hex,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  bgCls,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bgCls: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className={cn('inline-flex p-2 rounded-lg', bgCls)}>{icon}</div>
      <p className="text-xs text-muted-foreground leading-snug">{label}</p>
      <p className={cn('text-xl font-bold font-mono tracking-tight', valueClass)}>{value}</p>
    </div>
  );
}
