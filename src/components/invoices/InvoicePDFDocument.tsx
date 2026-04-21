import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { createTw } from 'react-pdf-tailwind';
import { format } from 'date-fns';
import type { InvoiceDoc, CompanySettings } from '@/types';

// Register fonts if needed
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFu_AZ9hiA.woff2', fontWeight: 700 },
  ],
});

const tw = createTw({
  theme: {
    fontFamily: {
      sans: ['Inter'],
    },
    colors: {
      primary: '#0f172a',
      secondary: '#64748b',
      unpaid: '#2563eb',
      paid: '#16a34a',
      partial: '#d97706',
      overdue: '#dc2626',
      white: '#ffffff',
      gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        700: '#374151',
      },
      red: {
        200: '#fecaca',
      },
    },
  },
});

interface InvoicePDFDocumentProps {
  invoice: InvoiceDoc;
  settings: Partial<CompanySettings> | null;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (ts: { seconds: number } | null | undefined) => {
  if (!ts) return '—';
  return format(new Date(ts.seconds * 1000), 'MMMM d, yyyy');
};

export function InvoicePDFDocument({ invoice, settings }: InvoicePDFDocumentProps) {
  const companyName = settings?.name ?? 'ClearCounts';
  const companyEmail = settings?.email ?? '';

  const statusColors: any = {
    unpaid: 'text-unpaid border-unpaid',
    paid: 'text-paid border-paid',
    partial: 'text-partial border-partial',
    overdue: 'text-overdue border-overdue',
    draft: 'text-secondary border-secondary',
  };

  return (
    <Document>
      <Page size="A4" style={tw('p-12 font-sans text-[12pt] text-primary')}>
        {/* Header */}
        <View style={tw('flex-row justify-between items-start mb-10')}>
          <View style={tw('flex-row items-center gap-4')}>
            {settings?.logoUrl && (
              <Image 
                src={{ uri: settings.logoUrl, method: 'GET', headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }} 
                style={tw('h-14 w-auto')} 
              />
            )}
            <View>
              <Text style={tw('text-2xl font-bold tracking-tighter')}>{companyName}</Text>
              {companyEmail ? <Text style={tw('text-sm text-secondary')}>{companyEmail}</Text> : null}
            </View>
          </View>
          <View style={tw('text-right')}>
            <Text style={tw('text-3xl font-bold tracking-tighter')}>INVOICE</Text>
            <Text style={tw('text-sm text-secondary font-mono')}>{invoice.invoiceNumber}</Text>
            <View style={tw(`mt-2 self-end border-[1.5pt] rounded-full px-3 py-1 ${statusColors[invoice.status] || 'text-secondary border-secondary'}`)}>
              <Text style={tw('text-[8pt] font-bold')}>{invoice.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Meta Box */}
        <View style={tw('flex-row justify-between bg-gray-50 rounded-lg p-6 mb-10')}>
          <View style={tw('flex-1')}>
            <Text style={tw('text-[9pt] font-bold text-secondary uppercase tracking-widest mb-1')}>Bill To</Text>
            <Text style={tw('text-base font-bold')}>{invoice.clientName}</Text>
            {invoice.quoteId && <Text style={tw('text-[9pt] text-secondary mt-1')}>Ref: {invoice.quoteId}</Text>}
          </View>
          <View style={tw('flex-1 text-right')}>
            <View style={tw('flex-row justify-end gap-4 mb-1')}>
              <Text style={tw('text-[9pt] text-secondary')}>Date:</Text>
              <Text style={tw('text-[9pt] font-bold')}>{fmtDate(invoice.issueDate)}</Text>
            </View>
            <View style={tw('flex-row justify-end gap-4 mb-1')}>
              <Text style={tw('text-[9pt] text-secondary')}>Due:</Text>
              <Text style={tw('text-[9pt] font-bold')}>{fmtDate(invoice.dueDate)}</Text>
            </View>
            <View style={tw('flex-row justify-end gap-4')}>
              <Text style={tw('text-[9pt] text-secondary')}>Currency:</Text>
              <Text style={tw('text-[9pt] font-bold')}>{invoice.currency}</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={tw('mb-10')}>
          {/* Header */}
          <View style={tw('flex-row bg-primary text-white p-2')}>
            <Text style={tw('flex-[3] text-[9pt] font-bold')}>Description</Text>
            <Text style={tw('flex-1 text-[9pt] font-bold text-right')}>Qty</Text>
            <Text style={tw('flex-1 text-[9pt] font-bold text-right')}>Price</Text>
            <Text style={tw('flex-1 text-[9pt] font-bold text-right')}>Tax %</Text>
            <Text style={tw('flex-1 text-[9pt] font-bold text-right')}>Total</Text>
          </View>
          {/* Rows */}
          {invoice.lineItems.map((item, i) => (
            <View key={item.id} style={tw(`flex-row p-3 border-b border-gray-100 ${i % 2 !== 0 ? 'bg-gray-50' : ''}`)}>
              <Text style={tw('flex-[3] text-[10pt]')}>{item.description}</Text>
              <Text style={tw('flex-1 text-[10pt] text-right')}>{item.quantity}</Text>
              <Text style={tw('flex-1 text-[10pt] text-right font-mono')}>{fmt(item.unitPrice)}</Text>
              <Text style={tw('flex-1 text-[10pt] text-right')}>{item.taxPercent}%</Text>
              <Text style={tw('flex-1 text-[10pt] text-right font-bold font-mono')}>{fmt(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={tw('flex-row justify-end mb-10')}>
          <View style={tw('w-[200pt] border-t-2 border-primary pt-2')}>
            <View style={tw('flex-row justify-between mb-1')}>
              <Text style={tw('text-[10pt] text-secondary')}>Subtotal</Text>
              <Text style={tw('text-[10pt] font-mono')}>{invoice.currency} {fmt(invoice.subtotal)}</Text>
            </View>
            <View style={tw('flex-row justify-between mb-2')}>
              <Text style={tw('text-[10pt] text-secondary')}>Tax</Text>
              <Text style={tw('text-[10pt] font-mono')}>{invoice.currency} {fmt(invoice.taxTotal)}</Text>
            </View>
            <View style={tw('flex-row justify-between border-t border-gray-200 pt-2')}>
              <Text style={tw('text-[12pt] font-bold')}>Total</Text>
              <Text style={tw('text-[12pt] font-bold font-mono')}>{invoice.currency} {fmt(invoice.total)}</Text>
            </View>
            {invoice.amountPaid > 0 && (
              <>
                <View style={tw('flex-row justify-between mt-2')}>
                  <Text style={tw('text-[10pt] text-secondary')}>Paid</Text>
                  <Text style={tw('text-[10pt] font-mono text-paid')}>-{invoice.currency} {fmt(invoice.amountPaid)}</Text>
                </View>
                <View style={tw('flex-row justify-between mt-1 pt-2 border-t border-red-200')}>
                  <Text style={tw('text-[11pt] font-bold text-overdue')}>Balance</Text>
                  <Text style={tw('text-[11pt] font-bold font-mono text-overdue')}>{invoice.currency} {fmt(invoice.amountDue)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Footer */}
        {(invoice.notes || invoice.terms) && (
          <View style={tw('border-t border-gray-100 pt-10 flex-row gap-6')}>
            {invoice.notes && (
              <View style={tw('flex-1')}>
                <Text style={tw('text-[9pt] font-bold text-secondary uppercase tracking-widest mb-1')}>Notes</Text>
                <Text style={tw('text-[9pt] text-gray-700 leading-normal')}>{invoice.notes}</Text>
              </View>
            )}
            {invoice.terms && (
              <View style={tw('flex-1')}>
                <Text style={tw('text-[9pt] font-bold text-secondary uppercase tracking-widest mb-1')}>Terms</Text>
                <Text style={tw('text-[9pt] text-gray-700 leading-normal')}>{invoice.terms}</Text>
              </View>
            )}
          </View>
        )}

        <View style={tw('mt-auto text-center')}>
          <Text style={tw('text-[7pt] text-gray-300')}>Generated by ClearCounts CRM</Text>
        </View>
      </Page>
    </Document>
  );
}
