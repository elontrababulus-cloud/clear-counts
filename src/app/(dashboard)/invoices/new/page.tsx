'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder';

function NewInvoiceContent() {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quoteId') ?? undefined;
  return <InvoiceBuilder quoteId={quoteId} />;
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
      <NewInvoiceContent />
    </Suspense>
  );
}
