import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { createTw } from 'react-pdf-tailwind';
import { format } from 'date-fns';
import type { QuoteDoc, CompanySettings } from '@/types';

// Register fonts using locally hosted files for 100% reliability
Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Inter-SemiBold.ttf', fontWeight: 600 },
    { src: '/fonts/Inter-Bold.ttf', fontWeight: 700 },
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
  // Use built-in 'Courier' for monospace to avoid "Font not registered" errors
  mono: { fontFamily: 'Courier', fontSize: 10 },
  badge: {
    marginTop: 8,
    borderWidth: 1.5,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: 700,
  },
  sent: { color: '#2563eb', borderColor: '#2563eb' },
  accepted: { color: '#16a34a', borderColor: '#16a34a' },
  declined: { color: '#dc2626', borderColor: '#dc2626' },
});

// Use TW ONLY for layout spacing/flex
const tw = createTw({});

interface QuotePDFDocumentProps {
  quote: QuoteDoc;
  settings: Partial<CompanySettings> | null;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (ts: { seconds: number } | null | undefined) => {
  if (!ts) return '—';
  return format(new Date(ts.seconds * 1000), 'MMMM d, yyyy');
};

export function QuotePDFDocument({ quote, settings }: QuotePDFDocumentProps) {
  const companyName = settings?.name ?? 'ClearCounts';
  const companyEmail = settings?.email ?? '';

  const statusStyle = quote.status === 'accepted' ? styles.accepted 
                    : quote.status === 'declined' ? styles.declined
                    : quote.status === 'sent' ? styles.sent
                    : styles.secondaryText;

  const subtotal = quote.lineItems.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const discountAmount = quote.discountType === 'percent' ? subtotal * (quote.discount / 100) : (quote.discount ?? 0);

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
            <Text style={styles.heading2}>QUOTE</Text>
            <Text style={[tw('text-sm'), styles.secondaryText, styles.mono]}>{quote.quoteNumber}</Text>
            <View style={[styles.badge, statusStyle, { alignSelf: 'flex-end' }]}>
              <Text>{quote.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Meta Box */}
        <View style={tw('flex-row justify-between bg-gray-50 rounded-lg p-6 mb-10')}>
          <View style={tw('flex-1')}>
            <Text style={[tw('text-[9pt] uppercase tracking-widest mb-1'), styles.secondaryText, styles.bold]}>Bill To</Text>
            <Text style={tw('text-base font-bold')}>{quote.clientName}</Text>
          </View>
          <View style={tw('flex-1 text-right')}>
            <View style={tw('flex-row justify-end gap-4 mb-1')}>
              <Text style={[tw('text-[9pt]'), styles.secondaryText]}>Date:</Text>
              <Text style={[tw('text-[9pt]'), styles.bold]}>{fmtDate(quote.createdAt)}</Text>
            </View>
            <View style={tw('flex-row justify-end gap-4 mb-1')}>
              <Text style={[tw('text-[9pt]'), styles.secondaryText]}>Valid Until:</Text>
              <Text style={[tw('text-[9pt]'), styles.bold]}>{fmtDate(quote.validUntil)}</Text>
            </View>
            <View style={tw('flex-row justify-end gap-4')}>
              <Text style={[tw('text-[9pt]'), styles.secondaryText]}>Currency:</Text>
              <Text style={[tw('text-[9pt]'), styles.bold]}>{quote.currency}</Text>
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
          {quote.lineItems.map((item, i) => (
            <View key={item.id} style={[tw('flex-row p-3 border-b border-gray-100'), { backgroundColor: i % 2 !== 0 ? '#f9fafb' : '#ffffff' }]}>
              <Text style={tw('flex-[3] text-[10pt]')}>{item.description}</Text>
              <Text style={tw('flex-1 text-[10pt] text-right')}>{item.quantity}</Text>
              <Text style={[tw('flex-1 text-[10pt] text-right'), styles.mono]}>{fmt(item.unitPrice)}</Text>
              <Text style={tw('flex-1 text-[10pt] text-right')}>{item.taxPercent}%</Text>
              <Text style={[tw('flex-1 text-[10pt] text-right font-bold'), styles.mono]}>{fmt(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={tw('flex-row justify-end mb-10')}>
          <View style={[tw('w-[200pt] pt-2'), { borderTopWidth: 2, borderTopColor: '#0f172a' }]}>
             <View style={tw('flex-row justify-between mb-1')}>
              <Text style={[tw('text-[10pt]'), styles.secondaryText]}>Subtotal</Text>
              <Text style={[tw('text-[10pt]'), styles.mono]}>{quote.currency} {fmt(subtotal)}</Text>
            </View>
            {discountAmount > 0 && (
              <View style={tw('flex-row justify-between mb-1')}>
                <Text style={[tw('text-[10pt]'), styles.secondaryText]}>Discount</Text>
                <Text style={[tw('text-[10pt]'), styles.mono]}>-{quote.currency} {fmt(discountAmount)}</Text>
              </View>
            )}
            <View style={tw('flex-row justify-between mb-2')}>
              <Text style={[tw('text-[10pt]'), styles.secondaryText]}>Tax</Text>
              <Text style={[tw('text-[10pt]'), styles.mono]}>{quote.currency} {fmt(quote.taxTotal)}</Text>
            </View>
            <View style={[tw('flex-row justify-between border-t border-gray-200 pt-2'), { borderTopWidth: 2, borderTopColor: '#0f172a' }]}>
              <Text style={tw('text-[12pt] font-bold')}>Total</Text>
              <Text style={[tw('text-[12pt] font-bold'), styles.mono]}>{quote.currency} {fmt(quote.total)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        {(quote.notes || quote.terms) && (
          <View style={tw('border-t border-gray-100 pt-10 flex-row gap-6')}>
            {quote.notes && (
              <View style={tw('flex-1')}>
                <Text style={[tw('text-[9pt] uppercase tracking-widest mb-1'), styles.secondaryText, styles.bold]}>Notes</Text>
                <Text style={tw('text-[9pt] text-gray-700 leading-normal')}>{quote.notes}</Text>
              </View>
            )}
            {quote.terms && (
              <View style={tw('flex-1')}>
                <Text style={[tw('text-[9pt] uppercase tracking-widest mb-1'), styles.secondaryText, styles.bold]}>Payment Terms</Text>
                <Text style={tw('text-[9pt] text-gray-700 leading-normal')}>{quote.terms}</Text>
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
