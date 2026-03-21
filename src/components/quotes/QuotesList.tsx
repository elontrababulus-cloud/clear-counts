'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { where, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Plus, Search, FileText } from 'lucide-react';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type { QuoteDoc, QuoteStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

export const QUOTE_STATUS_META: Record<
  QuoteStatus,
  { label: string; cls: string }
> = {
  draft:    { label: 'Draft',    cls: 'bg-slate-100 text-slate-600' },
  sent:     { label: 'Sent',     cls: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-700' },
  deleted:  { label: 'Void',     cls: 'bg-amber-100 text-amber-700' },
};

const STATUS_FILTERS: Array<QuoteStatus | 'all'> = [
  'all', 'draft', 'sent', 'accepted', 'declined',
];

// ─── Component ────────────────────────────────────────────────────────────────

export function QuotesList() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = subscribeToCollection<QuoteDoc>(
      'quotes',
      [
        where('status', '!=', 'deleted'),
        orderBy('status'),
        orderBy('createdAt', 'desc'),
      ],
      (data) => {
        setQuotes(data);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const filtered = quotes.filter((q) => {
    const matchStatus = statusFilter === 'all' || q.status === statusFilter;
    const qLow = search.toLowerCase();
    const matchSearch =
      !qLow ||
      q.quoteNumber.toLowerCase().includes(qLow) ||
      q.clientName.toLowerCase().includes(qLow);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => router.push('/quotes/new')}>
          <Plus className="h-4 w-4 mr-1" />
          New Quote
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search quotes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => {
            const meta = s !== 'all' ? QUOTE_STATUS_META[s] : null;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs border transition-colors capitalize',
                  active
                    ? meta
                      ? `${meta.cls} border-transparent`
                      : 'bg-primary text-primary-foreground border-transparent'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {s === 'all' ? 'All' : QUOTE_STATUS_META[s].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">No quotes found.</p>
          <Button size="sm" onClick={() => router.push('/quotes/new')}>
            Create your first quote
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {['Quote #', 'Client', 'Created', 'Valid Until', 'Total', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const meta = QUOTE_STATUS_META[q.status];
                const createdDate = q.createdAt
                  ? format(new Date(q.createdAt.seconds * 1000), 'MMM d, yyyy')
                  : '—';
                const validUntil = q.validUntil
                  ? format(new Date(q.validUntil.seconds * 1000), 'MMM d, yyyy')
                  : '—';

                return (
                  <tr
                    key={q.id}
                    onClick={() => router.push(`/quotes/${q.id}`)}
                    className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium">{q.quoteNumber}</td>
                    <td className="px-4 py-3">{q.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{createdDate}</td>
                    <td className="px-4 py-3 text-muted-foreground">{validUntil}</td>
                    <td className="px-4 py-3 font-mono">
                      {q.currency} {q.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('border-0 text-xs', meta.cls)}>
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/quotes/${q.id}`);
                        }}
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
