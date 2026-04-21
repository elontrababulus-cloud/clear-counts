import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { createTw } from 'react-pdf-tailwind';
import { format } from 'date-fns';
import type { InvoiceDoc, CompanySettings } from '@/types';

// Register fonts
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFu_AZ9hiA.woff2', fontWeight: 700 },
  ],
});

// Native styles for reliable rendering
const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Inter',
    fontSize: 12,
    color: '#0f172a',
  },
  primaryText: { color: '#0f172a' },
  secondaryText: { color: '#64748b' },
  bold: { fontWeight: 700 },
  heading1: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5 },
  heading2: { fontSize: 30, fontWeight: 700, letterSpacing: -1 },
  mono: { fontFamily: 'Courier' }, // Fallback mono handling
  badge: {
    marginTop: 8,
    borderWidth: 1.5,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: 700,
  },
  unpaid: { color: '#2563eb', borderColor: '#2563eb' },
  paid: { color: '#16a34a', borderColor: '#16a34a' },
  partial: { color: '#d97706', borderColor: '#d97706' },
  overdue: { color: '#dc2626', borderColor: '#dc2626' },
});

// Use TW ONLY for layout spacing/flex
const tw = createTw({});

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

  const statusStyle = invoice.status === 'paid' ? styles.paid 
                    : invoice.status === 'partial' ? styles.partial
                    : invoice.status === 'overdue' ? styles.overdue
                    : invoice.status === 'unpaid' ? styles.unpaid
                    : styles.secondaryText;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
              <Text style={styles.heading1}>{companyName}</Text>
              {companyEmail ? <Text style={[tw('text-sm'), styles.secondaryText]}>{companyEmail}</Text> : null}
            </View>
          </View>
          <View style={tw('text-right')}>
            <Text style={styles.heading2}>INVOICE</Text>
            <Text style={[tw('text-sm font-mono'), styles.secondaryText]}>{invoice.invoiceNumber}</Text>
            <View style={[styles.badge, statusStyle, { alignSelf: 'flex-end' }]}>
              <Text>{invoice.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Meta Box */}
        <View style={tw('flex-row justify-between bg-gray-50 rounded-lg p-6 mb-10')}>
          <View style={tw('flex-1')}>
            <Text style={[tw('text-[9pt] uppercase tracking-widest mb-1'), styles.secondaryText, styles.bold]}>Bill To</Text>
            <Text style={tw('text-base font-bold')}>{invoice.clientName}</Text>
            {invoice.quoteId && <Text style={[tw('text-[9pt] mt-1'), styles.secondaryText]}>Ref: {invoice.quoteId}</Text>}
          </View>
          <View style={tw('flex-1 text-right')}>
            <View style={tw('flex-row justify-end gap-4 mb-1')}>
              <Text style={[tw('text-[9pt]'), styles.secondaryText]}>Date:</Text>
              <Text style={[tw('text-[9pt]'), styles.bold]}>{fmtDate(invoice.issueDate)}</Text>
            </View>
            <View style={tw('flex-row justify-end gap-4 mb-1')}>
              <Text style={[tw('text-[9pt]'), styles.secondaryText]}>Due:</Text>
              <Text style={[tw('text-[9pt]'), styles.bold]}>{fmtDate(invoice.dueDate)}</Text>
            </View>
            <View style={tw('flex-row justify-end gap-4')}>
              <Text style={[tw('text-[9pt]'), styles.secondaryText]}>Currency:</Text>
              <Text style={[tw('text-[9pt]'), styles.bold]}>{invoice.currency}</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={tw('mb-10')}>
          <View style={[tw('flex-row p-2'), { backgroundColor: '#0f172a' }]}>
            <Text style={tw('flex-[3] text-[9pt] font-bold text-white')}>Description</Text>
            <Text style={tw('flex-1 text-[9pt] font-bold text-right text-white')}>Qty</Text>
            <Text style={tw('flex-1 text-[9pt] font-bold text-right text-white')}>Price</Text>
            <Text style={tw('flex-1 text-[9pt] font-bold text-right text-white')}>Tax %</Text>
            <Text style={tw('flex-1 text-[9pt] font-bold text-right text-white')}>Total</Text>
          </View>
          {invoice.lineItems.map((item, i) => (
            <View key={item.id} style={tw(`flex-row p-3 border-b border-gray-100 ${i % 2 !== 0 ? 'bg-gray-50' : ''}`)}>
              <Text style={tw('flex-[3] text-[10pt]')}>{item.description}</Text>
              <Text style={tw('flex-1 text-[10pt] text-right')}>{item.quantity}</Text>
              <Text style={tw('flex-1 text-[10pt] text-right font-mono')}>{fmt(item.unitPrice)}</Text>
              <Text style={tw('flex-1 text-[10pt] text-right')}>{item.taxPercent}%</Text>
              <Text style={tw('flex-1 text-[10pt] text-right font-bold')}>{fmt(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={tw('flex-row justify-end mb-10')}>
          <View style={tw('w-[200pt] border-t-2 border-primary pt-2')}>
            <View style={tw('flex-row justify-between mb-1')}>
              <Text style={[tw('text-[10pt]'), styles.secondaryText]}>Subtotal</Text>
              <Text style={tw('text-[10pt] font-mono')}>{invoice.currency} {fmt(invoice.subtotal)}</Text>
            </View>
            <View style={tw('flex-row justify-between mb-2')}>
              <Text style={[tw('text-[10pt]'), styles.secondaryText]}>Tax</Text>
              <Text style={tw('text-[10pt] font-mono')}>{invoice.currency} {fmt(invoice.taxTotal)}</Text>
            </View>
            <View style={[tw('flex-row justify-between border-t border-gray-200 pt-2'), { borderTopWidth: 2, borderTopColor: '#0f172a' }]}>
              <Text style={tw('text-[12pt] font-bold')}>Total</Text>
              <Text style={tw('text-[12pt] font-bold font-mono')}>{invoice.currency} {fmt(invoice.total)}</Text>
            </View>
            {invoice.amountPaid > 0 && (
              <>
                <View style={tw('flex-row justify-between mt-2')}>
                  <Text style={[tw('text-[10pt]'), styles.secondaryText]}>Paid</Text>
                  <Text style={[tw('text-[10pt] font-mono'), styles.paid]}>-{invoice.currency} {fmt(invoice.amountPaid)}</Text>
                </View>
                <View style={[tw('flex-row justify-between mt-1 pt-2 border-t border-red-200')]}>
                  <Text style={[tw('text-[11pt] font-bold'), styles.overdue]}>Balance</Text>
                  <Text style={[tw('text-[11pt] font-bold font-mono'), styles.overdue]}>{invoice.currency} {fmt(invoice.amountDue)}</Text>
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
                <Text style={[tw('text-[9pt] uppercase tracking-widest mb-1'), styles.secondaryText, styles.bold]}>Notes</Text>
                <Text style={tw('text-[9pt] text-gray-700 leading-normal')}>{invoice.notes}</Text>
              </View>
            )}
            {invoice.terms && (
              <View style={tw('flex-1')}>
                <Text style={[tw('text-[9pt] uppercase tracking-widest mb-1'), styles.secondaryText, styles.bold]}>Terms</Text>
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
