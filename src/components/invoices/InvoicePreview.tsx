/**
 * InvoicePreview
 *
 * Print-ready / PDF-ready layout for invoices. Uses inline styles so
 * html2canvas captures correctly without CSS variable resolution.
 * Also used inline on the detail page as a read-only preview.
 */

import { format } from 'date-fns';
import type { InvoiceDoc, CompanySettings } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoicePreviewProps {
  invoice: InvoiceDoc;
  settings?: Partial<CompanySettings> | null;
  /** When true, renders with a visible border and shadow for inline preview */
  inline?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts: { seconds: number } | null | undefined) {
  if (!ts) return '—';
  return format(new Date(ts.seconds * 1000), 'MMMM d, yyyy');
}

// ─── Status metadata ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft:   'DRAFT',
  unpaid:  'UNPAID',
  partial: 'PARTIAL',
  paid:    'PAID',
  overdue: 'OVERDUE',
  deleted: 'VOID',
};

const STATUS_COLOR: Record<string, string> = {
  draft:   '#6b7280',
  unpaid:  '#2563eb',
  partial: '#d97706',
  paid:    '#16a34a',
  overdue: '#dc2626',
  deleted: '#9ca3af',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoicePreview({ invoice, settings, inline }: InvoicePreviewProps) {
  const companyName = settings?.name ?? 'ClearCounts';
  const companyEmail = settings?.email ?? '';
  const currency = invoice.currency ?? 'USD';
  const paidPercent = invoice.total > 0
    ? Math.min(100, Math.round((invoice.amountPaid / invoice.total) * 100))
    : 0;

  return (
    <div
      id="invoice-preview-root"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        color: '#111827',
        background: '#ffffff',
        width: '794px',
        padding: '48px',
        boxSizing: 'border-box',
        ...(inline
          ? { border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 1px 4px #0001' }
          : {}),
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {companyName}
          </div>
          {companyEmail && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{companyEmail}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-1px' }}>
            INVOICE
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{invoice.invoiceNumber}</div>
          <div
            style={{
              marginTop: '6px',
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: '99px',
              border: `1.5px solid ${STATUS_COLOR[invoice.status] ?? '#6b7280'}`,
              color: STATUS_COLOR[invoice.status] ?? '#6b7280',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {STATUS_LABEL[invoice.status] ?? invoice.status.toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Meta ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '32px',
          padding: '20px 24px',
          background: '#f8fafc',
          borderRadius: '8px',
        }}
      >
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Bill To
          </div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{invoice.clientName}</div>
          {invoice.quoteId && (
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              Ref. Quote {invoice.quoteId}
            </div>
          )}
        </div>
        <div>
          <MetaRow label="Invoice Date" value={fmtDate(invoice.issueDate)} />
          <MetaRow label="Due Date" value={fmtDate(invoice.dueDate)} />
          {invoice.paidAt && <MetaRow label="Paid On" value={fmtDate(invoice.paidAt)} />}
          <MetaRow label="Currency" value={currency} />
        </div>
      </div>

      {/* ── Line items ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr style={{ background: '#0f172a', color: '#ffffff' }}>
            {['Description', 'Qty', 'Unit Price', 'Tax %', 'Amount'].map((h, i) => (
              <th
                key={h}
                style={{
                  padding: '8px 12px',
                  textAlign: i === 0 ? 'left' : 'right',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid #e5e7eb' }}>{item.description}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>{item.quantity}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #e5e7eb' }}>{fmt(item.unitPrice)}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>{item.taxPercent}%</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
        <div style={{ width: '280px' }}>
          <TotalRow label="Subtotal" value={`${currency} ${fmt(invoice.subtotal)}`} />
          <TotalRow label="Tax" value={`${currency} ${fmt(invoice.taxTotal)}`} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #0f172a', marginTop: '4px', fontWeight: 700, fontSize: '15px' }}>
            <span>Total</span>
            <span style={{ fontFamily: 'monospace' }}>{currency} {fmt(invoice.total)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <>
              <TotalRow label="Amount Paid" value={`− ${currency} ${fmt(invoice.amountPaid)}`} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #dc2626', marginTop: '4px', fontWeight: 700, fontSize: '14px', color: '#dc2626' }}>
                <span>Balance Due</span>
                <span style={{ fontFamily: 'monospace' }}>{currency} {fmt(invoice.amountDue)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Payment progress bar ── */}
      {invoice.amountPaid > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
            Payment Progress: {paidPercent}% paid
          </div>
          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${paidPercent}%`, background: '#16a34a', borderRadius: '99px' }} />
          </div>
        </div>
      )}

      {/* ── Footer: notes + terms ── */}
      {(invoice.notes || invoice.terms) && (
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px', display: 'grid', gridTemplateColumns: invoice.notes && invoice.terms ? '1fr 1fr' : '1fr', gap: '24px' }}>
          {invoice.notes && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Notes</div>
              <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.6 }}>{invoice.notes}</div>
            </div>
          )}
          {invoice.terms && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Payment Terms</div>
              <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.6 }}>{invoice.terms}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '10px', color: '#9ca3af' }}>
        Generated by ClearCounts CRM
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', fontSize: '12px' }}>
      <span style={{ color: '#6b7280', minWidth: '90px' }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}
