'use client';

import { useEffect, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type { PaymentDoc, PaymentMethod } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentMethodBadge, METHOD_CONFIG } from './PaymentMethodBadge';
import { cn } from '@/lib/utils';

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(payments: PaymentDoc[]) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const headers = ['Date', 'Client', 'Invoice Number', 'Method', 'Reference', 'Amount (USD)', 'Recorded By'];

  const rows = payments.map((p) => {
    const dateStr = p.date
      ? format(new Date(p.date.seconds * 1000), 'yyyy-MM-dd')
      : '';
    return [
      dateStr,
      p.clientName,
      p.invoiceNumber,
      METHOD_CONFIG[p.method]?.label ?? p.method,
      p.reference ?? '',
      p.amount.toFixed(2),
      p.recordedBy,
    ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',');
  });

  const csv = BOM + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const ALL_METHODS = Object.keys(METHOD_CONFIG) as PaymentMethod[];

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentsTable() {
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [clientSearch, setClientSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsub = subscribeToCollection<PaymentDoc>(
      'payments',
      [orderBy('date', 'desc')],
      (data) => {
        setPayments(data);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = payments.filter((p) => {
    if (methodFilter !== 'all' && p.method !== methodFilter) return false;

    if (clientSearch) {
      const q = clientSearch.toLowerCase();
      if (
        !p.clientName.toLowerCase().includes(q) &&
        !p.invoiceNumber.toLowerCase().includes(q)
      ) return false;
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime() / 1000;
      if (!p.date || p.date.seconds < from) return false;
    }

    if (dateTo) {
      // Include the entire "to" day
      const to = new Date(dateTo).getTime() / 1000 + 86400;
      if (!p.date || p.date.seconds > to) return false;
    }

    return true;
  });

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => setPage(1), [methodFilter, clientSearch, dateFrom, dateTo]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Client or invoice #…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-52"
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 text-sm w-36"
            title="From date"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 text-sm w-36"
            title="To date"
          />
        </div>

        {/* Method filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setMethodFilter('all')}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
              methodFilter === 'all'
                ? 'bg-primary text-primary-foreground border-transparent'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            All
          </button>
          {ALL_METHODS.map((m) => {
            const cfg = METHOD_CONFIG[m];
            const active = methodFilter === m;
            return (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
                  active
                    ? 'border-transparent text-white'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
                style={active ? { backgroundColor: cfg.hex } : undefined}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary + export row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
          {filtered.length > 0 && (
            <>
              {' '}·{' '}
              <span className="font-mono font-medium text-foreground">
                $
                {filtered
                  .reduce((s, p) => s + p.amount, 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <p className="text-sm">No payments match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {['Date', 'Client', 'Invoice #', 'Method', 'Reference', 'Amount', 'Recorded By'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => {
                const dateStr = p.date
                  ? format(new Date(p.date.seconds * 1000), 'MMM d, yyyy')
                  : '—';

                return (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {dateStr}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate">{p.clientName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <PaymentMethodBadge method={p.method} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium tabular-nums whitespace-nowrap">
                      ${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.recordedBy.slice(0, 8)}…
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Page {safePage} of {totalPages} · {filtered.length} results
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Page number pills — show at most 5 around current page */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
              .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                if (idx > 0 && (n as number) - (arr[idx - 1] as number) > 1) acc.push('…');
                acc.push(n);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '…' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={cn(
                      'h-8 w-8 rounded-lg text-sm transition-colors',
                      safePage === item
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    {item}
                  </button>
                ),
              )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
