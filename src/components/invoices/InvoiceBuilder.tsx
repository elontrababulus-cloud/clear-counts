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
  getById,
  getNextCounter,
  formatInvoiceNumber,
  subscribeToDoc,
} from '@/lib/firestore/helpers';
import { useAuth } from '@/hooks/useAuth';
import type { InvoiceDoc, ClientDoc, LineItem, QuoteDoc, CompanySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { LineItemTable, computeTotal } from '@/components/quotes/LineItemTable';
import dynamic from 'next/dynamic';
const InvoicePDFExport = dynamic(() => import('./InvoicePDFExport').then(m => m.InvoicePDFExport), { ssr: false });
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
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string(),
  terms: z.string(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoiceBuilderProps {
  /** Existing invoice to edit */
  invoice?: InvoiceDoc | null;
  /** Pre-fill from quote (new invoice from quote) */
  quoteId?: string;
  onSaved?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoiceBuilder({ invoice, quoteId, onSaved }: InvoiceBuilderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const isEdit = !!invoice;

  // ── Clients ───────────────────────────────────────────────────────────────

  const [clients, setClients] = useState<ClientDoc[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDoc | null>(null);
  useEffect(() => {
    getAll<ClientDoc>('clients', {
      constraints: [where('status', 'in', ['active', 'prospect']), orderBy('companyName')],
      pageSize: 200,
    }).then(({ data }) => setClients(data));
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  useEffect(() => {
    const unsub = subscribeToDoc<CompanySettings>('settings', 'company', setSettings);
    return unsub;
  }, []);

  // ── Invoice number ────────────────────────────────────────────────────────

  const [invoiceNumber, setInvoiceNumber] = useState<string>(invoice?.invoiceNumber ?? '');
  const [loadingNumber, setLoadingNumber] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setInvoiceNumber(invoice!.invoiceNumber);
      return;
    }
    setLoadingNumber(true);
    getNextCounter('invoiceCounter')
      .then((n) => setInvoiceNumber(formatInvoiceNumber(n, settings ?? {})))
      .catch(() => setInvoiceNumber('INV-####'))
      .finally(() => setLoadingNumber(false));
  }, [isEdit, invoice, settings]);

  // ── Line items ────────────────────────────────────────────────────────────

  const [lineItems, setLineItems] = useState<LineItem[]>(invoice?.lineItems ?? []);

  // ── Prefill from quote ────────────────────────────────────────────────────

  useEffect(() => {
    if (!quoteId || isEdit) return;
    getById<QuoteDoc>('quotes', quoteId).then((q) => {
      if (!q) return;
      setLineItems(q.lineItems);
      // Pre-select the client
      getAll<ClientDoc>('clients', {
        constraints: [where('status', 'in', ['active', 'prospect']), orderBy('companyName')],
        pageSize: 200,
      }).then(({ data }) => {
        const c = data.find((cl) => cl.id === q.clientId);
        if (c) {
          setSelectedClient(c);
          setClientSearch(c.companyName);
          setValue('clientId', c.id, { shouldValidate: true });
          setValue('currency', (q.currency as (typeof CURRENCIES)[number]) ?? 'USD');
          setValue('notes', q.notes ?? '');
          setValue('terms', q.terms ?? '');
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, isEdit]);

  // ── Form ──────────────────────────────────────────────────────────────────

  const todayStr = new Date().toISOString().split('T')[0];
  const net14Str = new Date(Date.now() + 14 * 86400_000).toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: invoice?.clientId ?? '',
      currency: (invoice?.currency as (typeof CURRENCIES)[number]) ?? 'USD',
      issueDate: invoice?.issueDate
        ? new Date(invoice.issueDate.seconds * 1000).toISOString().split('T')[0]
        : todayStr,
      dueDate: invoice?.dueDate
        ? new Date(invoice.dueDate.seconds * 1000).toISOString().split('T')[0]
        : net14Str,
      notes: invoice?.notes ?? '',
      terms: invoice?.terms ?? '',
    },
  });

  // Pre-select client when editing
  useEffect(() => {
    if (invoice && clients.length > 0) {
      const c = clients.find((cl) => cl.id === invoice.clientId);
      if (c) {
        setSelectedClient(c);
        setClientSearch(c.companyName);
      }
    }
  }, [invoice, clients]);

  // ── Totals ────────────────────────────────────────────────────────────────

  const subtotal = lineItems.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const taxTotal = lineItems.reduce((s, r) => s + computeTotal(r) - r.quantity * r.unitPrice, 0);
  const total = subtotal + taxTotal;

  // ── Client selector ───────────────────────────────────────────────────────

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

  const save = async (values: FormValues, status: InvoiceDoc['status']) => {
    if (!user) return;
    if (lineItems.length === 0) { toast.error('Add at least one line item'); return; }
    if (!selectedClient) { toast.error('Select a client'); return; }

    const payload = {
      invoiceNumber,
      clientId: selectedClient.id,
      clientUid: selectedClient.createdBy,
      clientName: selectedClient.companyName,
      lineItems,
      subtotal,
      taxTotal,
      total,
      currency: values.currency,
      status,
      issueDate: Timestamp.fromDate(new Date(values.issueDate)),
      dueDate: Timestamp.fromDate(new Date(values.dueDate)),
      notes: values.notes,
      terms: values.terms,
      quoteId: quoteId ?? invoice?.quoteId,
    };

    try {
      if (isEdit && invoice) {
        await update<InvoiceDoc>('invoices', invoice.id, payload);
        toast.success('Invoice saved');
        onSaved?.(invoice.id);
      } else {
        const id = await create<InvoiceDoc>('invoices', {
          ...payload,
          amountPaid: 0,
          amountDue: total,
          createdBy: user.uid,
        });
        toast.success('Invoice created');
        onSaved?.(id);
        router.push(`/invoices/${id}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save invoice');
    }
  };

  const onSaveDraft = handleSubmit((v) => save(v, 'draft'));
  const onSend = handleSubmit((v) => save(v, 'unpaid'));

  const previewInvoice: InvoiceDoc | null = isEdit && invoice
    ? { ...invoice, lineItems, subtotal, taxTotal, total }
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? `Edit ${invoiceNumber}` : 'New Invoice'}
          </h1>
          {quoteId && !isEdit && (
            <p className="text-xs text-muted-foreground mt-0.5">Pre-filled from quote</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEdit && previewInvoice && <InvoicePDFExport invoice={previewInvoice} />}
          <Button variant="outline" onClick={onSaveDraft} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Draft
          </Button>
          <Button onClick={onSend} disabled={isSubmitting}>
            <Send className="h-4 w-4 mr-1" />
            Send Invoice
          </Button>
        </div>
      </div>

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* Details card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Invoice Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Invoice number */}
            <div className="space-y-1">
              <Label>Invoice Number</Label>
              {loadingNumber ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Input value={invoiceNumber} readOnly className="font-mono bg-muted/40" />
              )}
            </div>

            {/* Currency */}
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" {...register('currency')} className={SELECT_CLS}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Issue Date */}
            <div className="space-y-1">
              <Label htmlFor="issueDate">Issue Date *</Label>
              <Input id="issueDate" type="date" {...register('issueDate')} />
              {errors.issueDate && <p className="text-xs text-destructive">{errors.issueDate.message}</p>}
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input id="dueDate" type="date" {...register('dueDate')} />
              {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
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
                  if (!e.target.value) { setSelectedClient(null); setValue('clientId', ''); }
                }}
                onFocus={() => setClientDropdownOpen(true)}
                onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
                autoComplete="off"
              />
              <input type="hidden" {...register('clientId')} />
              {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
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
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Line Items</h2>
          <LineItemTable items={lineItems} onChange={setLineItems} />
        </div>

        {/* Totals */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Totals</h2>
          <div className="ml-auto w-64 space-y-1.5">
            <SummaryRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
            <SummaryRow label="Tax" value={`$${taxTotal.toFixed(2)}`} />
            <div className="flex justify-between border-t border-border pt-2 font-bold text-base">
              <span>Total</span>
              <span className="font-mono">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Notes &amp; Terms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" {...register('notes')} placeholder="Notes for the client…" className={TEXTAREA_CLS} rows={4} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="terms">Payment Terms</Label>
              <textarea id="terms" {...register('terms')} placeholder="e.g. Payment due within 14 days…" className={TEXTAREA_CLS} rows={4} />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {isEdit && previewInvoice && <InvoicePDFExport invoice={previewInvoice} />}
          <Button variant="outline" onClick={onSaveDraft} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Draft
          </Button>
          <Button onClick={onSend} disabled={isSubmitting}>
            <Send className="h-4 w-4 mr-1" />
            Send Invoice
          </Button>
        </div>
      </form>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
