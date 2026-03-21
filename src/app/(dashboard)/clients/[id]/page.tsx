'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { where, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { ArrowLeft, FileText, Briefcase } from 'lucide-react';
import { subscribeToDoc, subscribeToCollection } from '@/lib/firestore/helpers';
import type { ClientDoc, InvoiceDoc, ProjectDoc } from '@/types';
import { ClientCard } from '@/components/clients/ClientCard';
import { ContactsTab } from '@/components/clients/ContactsTab';
import { ClientForm } from '@/components/clients/ClientForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ─── Invoice status colors ────────────────────────────────────────────────────

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  unpaid:   'bg-red-100 text-red-700',
  partial:  'bg-amber-100 text-amber-700',
  paid:     'bg-green-100 text-green-700',
  overdue:  'bg-red-200 text-red-800',
};

const PROJECT_STATUS_STYLES: Record<string, string> = {
  planning:  'bg-gray-100 text-gray-600',
  active:    'bg-blue-100 text-blue-700',
  on_hold:   'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function safeDateFormat(ts: unknown, fmt: string): string {
  try {
    if (!ts) return '—';
    // Firestore Timestamp has .toDate()
    const date = (ts as { toDate: () => Date }).toDate();
    return format(date, fmt);
  } catch {
    return '—';
  }
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ─── Skeleton screens ─────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex gap-4">
      <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-32" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ client }: { client: ClientDoc }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Details */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Company Details</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Company Name', value: client.companyName },
            { label: 'Contact Name', value: client.contactName },
            { label: 'Email', value: client.email },
            { label: 'Phone', value: client.phone || '—' },
            { label: 'City', value: client.address.city },
            { label: 'Country', value: client.address.country },
            { label: 'Currency', value: client.currency },
            { label: 'VAT Number', value: client.vatNumber || '—' },
            { label: 'Website', value: client.website || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Tags */}
        {client.tags && client.tags.length > 0 && (
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Tags</dt>
            <div className="flex flex-wrap gap-1.5">
              {client.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Notes</h3>
        {client.notes ? (
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {client.notes}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">No notes added.</p>
        )}
      </div>
    </div>
  );
}

// ─── Invoices tab ─────────────────────────────────────────────────────────────

function InvoicesTab({ clientId, currency }: { clientId: string; currency: string }) {
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCollection<InvoiceDoc>(
      'invoices',
      [
        where('clientId', '==', clientId),
        where('status', 'in', ['draft', 'unpaid', 'partial', 'paid', 'overdue']),
        orderBy('createdAt', 'desc'),
      ],
      (data) => { setInvoices(data); setLoading(false); },
    );
    return unsub;
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-white">
        <FileText size={28} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No invoices for this client yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left font-medium text-gray-500 px-4 py-2.5">Invoice #</th>
            <th className="text-right font-medium text-gray-500 px-4 py-2.5">Amount</th>
            <th className="text-right font-medium text-gray-500 px-4 py-2.5">Due</th>
            <th className="text-left font-medium text-gray-500 px-4 py-2.5">Due Date</th>
            <th className="text-left font-medium text-gray-500 px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(inv.total, inv.currency)}
              </td>
              <td className="px-4 py-3 text-right text-amber-600 font-medium">
                {inv.amountDue > 0 ? formatCurrency(inv.amountDue, inv.currency) : '—'}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {safeDateFormat(inv.dueDate, 'dd MMM yyyy')}
              </td>
              <td className="px-4 py-3">
                <Badge
                  className={cn(
                    'capitalize border-0',
                    INVOICE_STATUS_STYLES[inv.status] ?? 'bg-gray-100 text-gray-600',
                  )}
                >
                  {inv.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Projects tab ─────────────────────────────────────────────────────────────

function ProjectsTab({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCollection<ProjectDoc>(
      'projects',
      [
        where('clientId', '==', clientId),
        where('status', 'in', ['planning', 'active', 'on_hold', 'completed']),
        orderBy('createdAt', 'desc'),
      ],
      (data) => { setProjects(data); setLoading(false); },
    );
    return unsub;
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-white">
        <Briefcase size={28} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No projects for this client yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left font-medium text-gray-500 px-4 py-2.5">Project</th>
            <th className="text-left font-medium text-gray-500 px-4 py-2.5">Status</th>
            <th className="text-right font-medium text-gray-500 px-4 py-2.5">Budget</th>
            <th className="text-left font-medium text-gray-500 px-4 py-2.5">Due Date</th>
            <th className="text-right font-medium text-gray-500 px-4 py-2.5">Tasks</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((proj) => (
            <tr key={proj.id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="px-4 py-3 font-medium text-gray-900">{proj.name}</td>
              <td className="px-4 py-3">
                <Badge
                  className={cn(
                    'capitalize border-0',
                    PROJECT_STATUS_STYLES[proj.status] ?? 'bg-gray-100 text-gray-600',
                  )}
                >
                  {proj.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(proj.budget, proj.currency)}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {safeDateFormat(proj.dueDate, 'dd MMM yyyy')}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {proj.completedTaskCount}/{proj.taskCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail page ──────────────────────────────────────────────────────────────

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [client, setClient] = useState<ClientDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToDoc<ClientDoc>('clients', id, (data) => {
      setClient(data);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <HeaderSkeleton />
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Client not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/clients')}>
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={() => router.push('/clients')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={14} />
        Clients
      </button>

      {/* Client header card */}
      <ClientCard client={client} onEdit={() => setFormOpen(true)} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab client={client} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab clientId={id} currency={client.currency} />
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <ProjectsTab clientId={id} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ContactsTab clientId={id} />
        </TabsContent>
      </Tabs>

      {/* Edit form */}
      <ClientForm open={formOpen} onOpenChange={setFormOpen} client={client} />
    </div>
  );
}
