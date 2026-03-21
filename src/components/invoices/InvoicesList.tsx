'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { where, orderBy } from 'firebase/firestore';
import { format, isPast } from 'date-fns';
import { Plus, Search, FileText, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type { InvoiceDoc, InvoiceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { INVOICE_STATUS_META } from './InvoiceDetail';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Client-side overdue detection.
 * Returns 'overdue' if Firestore status is still unpaid/partial but due date has passed.
 */
function effectiveStatus(inv: InvoiceDoc): InvoiceStatus {
  if (
    (inv.status === 'unpaid' || inv.status === 'partial') &&
    inv.dueDate &&
    isPast(new Date(inv.dueDate.seconds * 1000))
  ) {
    return 'overdue';
  }
  return inv.status;
}

// ─── Status filters ───────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<InvoiceStatus | 'all'> = [
  'all', 'draft', 'unpaid', 'partial', 'paid', 'overdue',
];

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoicesList() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = subscribeToCollection<InvoiceDoc>(
      'invoices',
      [
        where('status', '!=', 'deleted'),
        orderBy('status'),
        orderBy('createdAt', 'desc'),
      ],
      (data) => {
        setInvoices(data);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const activeInvoices = invoices.filter((i) => i.status !== 'deleted');
  const totalInvoiced = activeInvoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = activeInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalOutstanding = activeInvoices.reduce((s, i) => s + i.amountDue, 0);
  const overdueCount = activeInvoices.filter(
    (i) => effectiveStatus(i) === 'overdue',
  ).length;

  // ── Filters ────────────────────────────────────────────────────────────────

  const filtered = invoices.filter((inv) => {
    const eff = effectiveStatus(inv);
    const matchStatus = statusFilter === 'all' || eff === statusFilter;
    const qLow = search.toLowerCase();
    const matchSearch =
      !qLow ||
      inv.invoiceNumber.toLowerCase().includes(qLow) ||
      inv.clientName.toLowerCase().includes(qLow);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <Button onClick={() => router.push('/invoices/new')}>
          <Plus className="h-4 w-4 mr-1" />
          New Invoice
        </Button>
      </div>

      {/* Stats row */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
            label="Total Invoiced"
            value={`$${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            bgCls="bg-blue-50"
          />
          <StatCard
            icon={<DollarSign className="h-5 w-5 text-green-600" />}
            label="Amount Paid"
            value={`$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            bgCls="bg-green-50"
          />
          <StatCard
            icon={<FileText className="h-5 w-5 text-amber-600" />}
            label="Outstanding"
            value={`$${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            bgCls="bg-amber-50"
          />
          <StatCard
            icon={<AlertCircle className="h-5 w-5 text-red-600" />}
            label="Overdue"
            value={String(overdueCount)}
            bgCls="bg-red-50"
            valueClass={overdueCount > 0 ? 'text-red-600' : undefined}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => {
            const meta = s !== 'all' ? INVOICE_STATUS_META[s] : null;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
                  active
                    ? meta
                      ? `${meta.cls} border-transparent`
                      : 'bg-primary text-primary-foreground border-transparent'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {s === 'all' ? 'All' : INVOICE_STATUS_META[s as InvoiceStatus].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">No invoices found.</p>
          <Button size="sm" onClick={() => router.push('/invoices/new')}>
            Create your first invoice
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Total', 'Amount Due', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const eff = effectiveStatus(inv);
                const meta = INVOICE_STATUS_META[eff];
                const issueDate = inv.issueDate
                  ? format(new Date(inv.issueDate.seconds * 1000), 'MMM d, yyyy')
                  : '—';
                const dueDate = inv.dueDate
                  ? format(new Date(inv.dueDate.seconds * 1000), 'MMM d, yyyy')
                  : '—';
                const isOverdue = eff === 'overdue';

                return (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    className={cn(
                      'border-b border-border last:border-0 cursor-pointer transition-colors',
                      isOverdue ? 'hover:bg-red-50/50' : 'hover:bg-muted/40',
                    )}
                  >
                    <td className={cn('px-4 py-3 font-mono font-medium', isOverdue && 'text-red-600')}>
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3">{inv.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{issueDate}</td>
                    <td className={cn('px-4 py-3', isOverdue && 'text-red-600 font-medium')}>
                      {dueDate}
                    </td>
                    <td className="px-4 py-3 font-mono">{inv.currency} {inv.total.toFixed(2)}</td>
                    <td className={cn('px-4 py-3 font-mono', inv.amountDue > 0 && 'font-medium text-red-600')}>
                      {inv.currency} {inv.amountDue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('border-0 text-xs', meta.cls)}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/invoices/${inv.id}`); }}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-bold font-mono tracking-tight', valueClass)}>{value}</p>
    </div>
  );
}
