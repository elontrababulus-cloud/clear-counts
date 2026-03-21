'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { where, orderBy, Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, Send } from 'lucide-react';
import {
  create,
  update,
  getAll,
  getNextCounter,
  formatQuoteNumber,
} from '@/lib/firestore/helpers';
import { useAuth } from '@/hooks/useAuth';
import type { QuoteDoc, ClientDoc, LineItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { LineItemTable, computeTotal } from './LineItemTable';
import { QuotePDFExport } from './QuotePDFExport';
import { cn } from '@/lib/utils';

// ─── Styles ───────────────────────────────────────────────────────────────────

const SELECT_CLS = cn(
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

const TEXTAREA_CLS = cn(
  'flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2',
  'text-sm outline-none transition-colors resize-none',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

const CURRENCIES = ['USD', 'ZWG', 'ZWL'] as const;

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  clientId: z.string().min(1, 'Select a client'),
  currency: z.enum(CURRENCIES),
  validUntil: z.string().min(1, 'Valid until date is required'),
  discountType: z.enum(['flat', 'percent']),
  discount: z.string(),
  notes: z.string(),
  terms: z.string(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuoteBuilderProps {
  /** Existing quote to edit — undefined means create mode */
  quote?: QuoteDoc | null;
  /** Called after successful save, with the saved quote ID */
  onSaved?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuoteBuilder({ quote, onSaved }: QuoteBuilderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const isEdit = !!quote;

  // ── Clients list ──────────────────────────────────────────────────────────

  const [clients, setClients] = useState<ClientDoc[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDoc | null>(null);

  useEffect(() => {
    getAll<ClientDoc>('clients', {
      constraints: [
        where('status', 'in', ['active', 'prospect']),
        orderBy('companyName'),
      ],
      pageSize: 200,
    }).then(({ data }) => setClients(data));
  }, []);

  // ── Quote number ──────────────────────────────────────────────────────────

  const [quoteNumber, setQuoteNumber] = useState<string>(quote?.quoteNumber ?? '');
  const [loadingNumber, setLoadingNumber] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setQuoteNumber(quote!.quoteNumber);
      return;
    }
    setLoadingNumber(true);
    getNextCounter('quoteCounter')
      .then((n) => setQuoteNumber(formatQuoteNumber(n)))
      .catch(() => setQuoteNumber('QT-####'))
      .finally(() => setLoadingNumber(false));
  }, [isEdit, quote]);

  // ── Line items ────────────────────────────────────────────────────────────

  const [lineItems, setLineItems] = useState<LineItem[]>(quote?.lineItems ?? []);

  // ── Form ──────────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: quote?.clientId ?? '',
      currency: (quote?.currency as (typeof CURRENCIES)[number]) ?? 'USD',
      validUntil: quote?.validUntil
        ? new Date(quote.validUntil.seconds * 1000).toISOString().split('T')[0]
        : '',
      discountType: quote?.discountType ?? 'flat',
      discount: String(quote?.discount ?? 0),
      notes: quote?.notes ?? '',
      terms: quote?.terms ?? '',
    },
  });

  // Pre-select client when editing
  useEffect(() => {
    if (quote && clients.length > 0) {
      const c = clients.find((cl) => cl.id === quote.clientId);
      if (c) {
        setSelectedClient(c);
        setClientSearch(c.companyName);
      }
    }
  }, [quote, clients]);

  // ── Totals calculation ────────────────────────────────────────────────────

  const discountType = watch('discountType');
  const discountRaw = watch('discount');

  const subtotal = lineItems.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const taxTotal = lineItems.reduce((s, r) => s + computeTotal(r) - r.quantity * r.unitPrice, 0);
  const discountVal = parseFloat(discountRaw) || 0;
  const discountAmount =
    discountType === 'percent' ? subtotal * (discountVal / 100) : discountVal;
  const total = subtotal - discountAmount + taxTotal;

  // ── Client selector helpers ───────────────────────────────────────────────

  const filteredClients = clients.filter((c) =>
    c.companyName.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  const handleClientSelect = useCallback(
    (client: ClientDoc) => {
      setSelectedClient(client);
      setClientSearch(client.companyName);
      setValue('clientId', client.id, { shouldValidate: true });
      setClientDropdownOpen(false);
    },
    [setValue],
  );

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = async (values: FormValues, status: QuoteDoc['status']) => {
    if (!user) return;
    if (lineItems.length === 0) {
      toast.error('Add at least one line item');
      return;
    }

    const client = selectedClient;
    if (!client) {
      toast.error('Select a client');
      return;
    }

    const validUntilTs = Timestamp.fromDate(new Date(values.validUntil));

    const payload = {
      quoteNumber,
      clientId: client.id,
      clientUid: client.createdBy, // closest proxy for client UID
      clientName: client.companyName,
      lineItems,
      subtotal,
      discount: parseFloat(values.discount) || 0,
      discountType: values.discountType,
      taxTotal,
      total,
      currency: values.currency,
      status,
      validUntil: validUntilTs,
      notes: values.notes,
      terms: values.terms,
    };

    try {
      if (isEdit && quote) {
        await update<QuoteDoc>('quotes', quote.id, payload);
        toast.success('Quote saved');
        onSaved?.(quote.id);
      } else {
        const id = await create<QuoteDoc>('quotes', {
          ...payload,
          createdBy: user.uid,
        });
        toast.success('Quote created');
        onSaved?.(id);
        router.push(`/quotes/${id}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save quote');
    }
  };

  const onSaveDraft = handleSubmit((v) => save(v, 'draft'));
  const onSend = handleSubmit((v) => save(v, 'sent'));

  // ── Preview quote (used by PDF export when in edit mode) ──────────────────

  const previewQuote: QuoteDoc | null = isEdit && quote
    ? {
        ...quote,
        lineItems,
        subtotal,
        taxTotal,
        total,
        discount: parseFloat(discountRaw) || 0,
        discountType,
        notes: watch('notes'),
        terms: watch('terms'),
      }
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? `Edit ${quoteNumber}` : 'New Quote'}
          </h1>
          {loadingNumber && !isEdit && (
            <p className="text-xs text-muted-foreground mt-0.5">Generating quote number…</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEdit && previewQuote && (
            <QuotePDFExport quote={previewQuote} />
          )}
          <Button variant="outline" onClick={onSaveDraft} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Draft
          </Button>
          <Button onClick={onSend} disabled={isSubmitting}>
            <Send className="h-4 w-4 mr-1" />
            Send Quote
          </Button>
        </div>
      </div>

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* ── Client + Meta ── */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Quote Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quote number (read-only) */}
            <div className="space-y-1">
              <Label>Quote Number</Label>
              {loadingNumber ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Input value={quoteNumber} readOnly className="font-mono bg-muted/40" />
              )}
            </div>

            {/* Valid Until */}
            <div className="space-y-1">
              <Label htmlFor="validUntil">Valid Until *</Label>
              <Input id="validUntil" type="date" {...register('validUntil')} />
              {errors.validUntil && (
                <p className="text-xs text-destructive">{errors.validUntil.message}</p>
              )}
            </div>

            {/* Client selector */}
            <div className="space-y-1 relative sm:col-span-2">
              <Label htmlFor="clientSearch">Client *</Label>
              <Input
                id="clientSearch"
                placeholder="Search clients…"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientDropdownOpen(true);
                  if (!e.target.value) {
                    setSelectedClient(null);
                    setValue('clientId', '');
                  }
                }}
                onFocus={() => setClientDropdownOpen(true)}
                onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
                autoComplete="off"
              />
              {/* Hidden field for validation */}
              <input type="hidden" {...register('clientId')} />
              {errors.clientId && (
                <p className="text-xs text-destructive">{errors.clientId.message}</p>
              )}

              {/* Dropdown */}
              {clientDropdownOpen && filteredClients.length > 0 && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.slice(0, 20).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => handleClientSelect(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between"
                    >
                      <span>{c.companyName}</span>
                      <span className="text-xs text-muted-foreground">{c.currency}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Currency */}
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" {...register('currency')} className={SELECT_CLS}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Line Items ── */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Line Items
          </h2>
          <LineItemTable items={lineItems} onChange={setLineItems} />
        </div>

        {/* ── Totals ── */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Totals
          </h2>

          {/* Discount row */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label>Discount Type</Label>
              <select {...register('discountType')} className={cn(SELECT_CLS, 'w-32')}>
                <option value="flat">Flat</option>
                <option value="percent">Percent</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="discount">Discount</Label>
              <div className="relative">
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('discount')}
                  className="w-28 pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  {discountType === 'percent' ? '%' : watch('currency')}
                </span>
              </div>
            </div>
          </div>

          {/* Summary table */}
          <div className="ml-auto w-72 space-y-1.5">
            <SummaryRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
            {discountAmount > 0 && (
              <SummaryRow
                label={`Discount${discountType === 'percent' ? ` (${discountVal}%)` : ''}`}
                value={`− $${discountAmount.toFixed(2)}`}
              />
            )}
            <SummaryRow label="Tax" value={`$${taxTotal.toFixed(2)}`} />
            <div className="flex justify-between border-t border-border pt-2 font-bold text-base">
              <span>Total</span>
              <span className="font-mono">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ── Notes & Terms ── */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Notes &amp; Terms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                {...register('notes')}
                placeholder="Internal notes or message to client…"
                className={TEXTAREA_CLS}
                rows={4}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="terms">Payment Terms</Label>
              <textarea
                id="terms"
                {...register('terms')}
                placeholder="e.g. Payment due within 14 days of acceptance…"
                className={TEXTAREA_CLS}
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {isEdit && previewQuote && (
            <QuotePDFExport quote={previewQuote} />
          )}
          <Button variant="outline" onClick={onSaveDraft} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Draft
          </Button>
          <Button onClick={onSend} disabled={isSubmitting}>
            <Send className="h-4 w-4 mr-1" />
            Send Quote
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
