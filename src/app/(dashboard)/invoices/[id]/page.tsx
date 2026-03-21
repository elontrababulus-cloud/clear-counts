'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { subscribeToDoc } from '@/lib/firestore/helpers';
import type { InvoiceDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail';

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToDoc<InvoiceDoc>('invoices', id, (data) => {
      setInvoice(data);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!invoice || invoice.status === 'deleted') {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <FileText className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Invoice not found or has been voided.</p>
        <Button variant="outline" onClick={() => router.push('/invoices')}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  return <InvoiceDetail invoice={invoice} />;
}
