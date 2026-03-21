'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, startOfMonth, subMonths, isPast } from 'date-fns';
import {
  Users,
  DollarSign,
  AlertCircle,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  UserPlus,
  CheckCircle2,
} from 'lucide-react';
import { where, orderBy, limit } from 'firebase/firestore';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type {
  ClientDoc,
  InvoiceDoc,
  PaymentDoc,
  ProjectDoc,
  LeadDoc,
  LeadStage,
} from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function monthKey(ts: { seconds: number }) {
  const d = new Date(ts.seconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function last7MonthKeys(): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className={cn(
            'w-2 rounded-sm transition-all',
            i === data.length - 1 ? 'bg-blue-500' : 'bg-blue-200',
          )}
          style={{ height: `${Math.max(4, Math.round((v / max) * 32))}px` }}
        />
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  changePct?: number | null;
  sparkline: number[];
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}

function StatCard({
  label, value, change, changePct, sparkline, icon: Icon, iconBg, iconColor, loading,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
      {loading ? (
        <>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-full" />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBg)}>
              <Icon size={15} className={iconColor} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {changePct != null && (
                changePct >= 0
                  ? <TrendingUp size={11} className="text-green-600" />
                  : <TrendingDown size={11} className="text-red-500" />
              )}
              <p className={cn(
                'text-xs',
                changePct != null && changePct >= 0 ? 'text-green-600' : changePct != null ? 'text-red-500' : 'text-gray-400',
              )}>
                {change}
              </p>
            </div>
          </div>
          <Sparkline data={sparkline} />
        </>
      )}
    </div>
  );
}

// ─── Invoice status badge ─────────────────────────────────────────────────────

const INV_STATUS_CLS: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600',
  unpaid:  'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-200 text-red-800',
};

function effectiveStatus(inv: InvoiceDoc): string {
  if (
    (inv.status === 'unpaid' || inv.status === 'partial') &&
    inv.dueDate && isPast(new Date(inv.dueDate.seconds * 1000))
  ) return 'overdue';
  return inv.status;
}

// ─── Lead pipeline ────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<LeadStage, string> = {
  new:         '#3B82F6',
  contacted:   '#8B5CF6',
  proposal:    '#F59E0B',
  negotiation: '#F97316',
  won:         '#10B981',
  lost:        '#EF4444',
};

const STAGE_LABELS: Record<LeadStage, string> = {
  new:         'New',
  contacted:   'Contacted',
  proposal:    'Proposal',
  negotiation: 'Negotiation',
  won:         'Won',
  lost:        'Lost',
};

const ALL_STAGES: LeadStage[] = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];

// ─── Activity item ────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: 'payment' | 'client' | 'invoice' | 'lead';
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  text: string;
  time: number; // epoch ms
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [clients, setClients] = useState<ClientDoc[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [leads, setLeads] = useState<LeadDoc[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const months = useMemo(() => last7MonthKeys(), []);
  const thisMonth = months[6];
  const lastMonth = months[5];

  useEffect(() => {
    // Unsubscribers
    const unsubs: (() => void)[] = [];

    unsubs.push(
      subscribeToCollection<ClientDoc>(
        'clients',
        [where('status', '!=', 'deleted')],
        (d) => { setClients(d); setLoading(false); },
      ),
    );

    unsubs.push(
      subscribeToCollection<InvoiceDoc>(
        'invoices',
        [where('status', 'in', ['unpaid', 'partial', 'overdue', 'paid'])],
        setInvoices,
      ),
    );

    // Payments from 7 months back for sparklines + activity
    const sevenMonthsAgo = subMonths(startOfMonth(new Date()), 6);
    unsubs.push(
      subscribeToCollection<PaymentDoc>(
        'payments',
        [where('date', '>=', { seconds: Math.floor(sevenMonthsAgo.getTime() / 1000), nanoseconds: 0 }), orderBy('date', 'desc')],
        setPayments,
      ),
    );

    unsubs.push(
      subscribeToCollection<ProjectDoc>(
        'projects',
        [where('status', '!=', 'deleted')],
        setProjects,
      ),
    );

    unsubs.push(
      subscribeToCollection<LeadDoc>(
        'leads',
        [where('status', '!=', 'deleted')],
        setLeads,
      ),
    );

    unsubs.push(
      subscribeToCollection<InvoiceDoc>(
        'invoices',
        [where('status', 'in', ['unpaid', 'partial', 'overdue', 'paid', 'draft']), orderBy('createdAt', 'desc'), limit(5)],
        setRecentInvoices,
      ),
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  // ── Stats calculations ─────────────────────────────────────────────────────

  // Total clients
  const totalClients = clients.length;
  const newThisMonth = clients.filter(
    (c) => c.createdAt && monthKey(c.createdAt) === thisMonth,
  ).length;
  const newLastMonth = clients.filter(
    (c) => c.createdAt && monthKey(c.createdAt) === lastMonth,
  ).length;
  const clientsPct = newLastMonth > 0
    ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)
    : null;
  const clientsSparkline = months.map(
    (m) => clients.filter((c) => c.createdAt && monthKey(c.createdAt) === m).length,
  );

  // Revenue this month
  const revenueThisMonth = payments
    .filter((p) => monthKey(p.date) === thisMonth)
    .reduce((s, p) => s + p.amount, 0);
  const revenueLastMonth = payments
    .filter((p) => monthKey(p.date) === lastMonth)
    .reduce((s, p) => s + p.amount, 0);
  const revenuePct = revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : null;
  const revenueSparkline = months.map(
    (m) => payments.filter((p) => monthKey(p.date) === m).reduce((s, p) => s + p.amount, 0),
  );

  // Outstanding
  const outstanding = invoices
    .filter((inv) => ['unpaid', 'partial', 'overdue'].includes(effectiveStatus(inv)))
    .reduce((s, inv) => s + (inv.amountDue ?? 0), 0);
  const outstandingCount = invoices.filter(
    (inv) => ['unpaid', 'partial', 'overdue'].includes(effectiveStatus(inv)),
  ).length;
  const outstandingSparkline = months.map((m) =>
    invoices
      .filter((inv) => inv.createdAt && monthKey(inv.createdAt) === m && ['unpaid', 'partial', 'overdue'].includes(inv.status))
      .reduce((s, inv) => s + (inv.amountDue ?? 0), 0),
  );

  // Active projects
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const projectsSparkline = months.map(
    (m) => projects.filter((p) => p.createdAt && monthKey(p.createdAt) === m).length,
  );

  // ── Lead pipeline ──────────────────────────────────────────────────────────

  const pipelineByStage = ALL_STAGES.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage);
    return {
      stage,
      count: stageLeads.length,
      value: stageLeads.reduce((s, l) => s + l.value, 0),
    };
  });
  const maxPipelineValue = Math.max(...pipelineByStage.map((s) => s.value), 1);

  // ── Activity feed ──────────────────────────────────────────────────────────

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    // Recent payments
    payments.slice(0, 4).forEach((p) => {
      items.push({
        id: `pay-${p.id}`,
        type: 'payment',
        icon: CreditCard,
        iconBg: 'bg-green-50',
        iconColor: 'text-green-600',
        text: `Payment of ${fmt(p.amount)} received from ${p.clientName}`,
        time: p.createdAt?.seconds ? p.createdAt.seconds * 1000 : p.date.seconds * 1000,
      });
    });

    // Recent clients
    clients
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      .slice(0, 3)
      .forEach((c) => {
        items.push({
          id: `client-${c.id}`,
          type: 'client',
          icon: UserPlus,
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
          text: `New client ${c.companyName} added`,
          time: c.createdAt?.seconds ? c.createdAt.seconds * 1000 : 0,
        });
      });

    // Paid invoices
    invoices
      .filter((inv) => inv.status === 'paid')
      .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0))
      .slice(0, 3)
      .forEach((inv) => {
        items.push({
          id: `inv-${inv.id}`,
          type: 'invoice',
          icon: CheckCircle2,
          iconBg: 'bg-emerald-50',
          iconColor: 'text-emerald-600',
          text: `Invoice ${inv.invoiceNumber} fully paid by ${inv.clientName}`,
          time: inv.paidAt?.seconds ? inv.paidAt.seconds * 1000 : inv.updatedAt?.seconds ? inv.updatedAt.seconds * 1000 : 0,
        });
      });

    return items.sort((a, b) => b.time - a.time).slice(0, 8);
  }, [payments, clients, invoices]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), "EEEE, MMMM d yyyy")} · Here's your business at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Clients"
          value={String(totalClients)}
          change={clientsPct != null ? `${clientsPct >= 0 ? '+' : ''}${clientsPct}% vs last month` : `+${newThisMonth} this month`}
          changePct={clientsPct}
          sparkline={clientsSparkline}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          loading={loading}
        />
        <StatCard
          label="Revenue This Month"
          value={fmt(revenueThisMonth)}
          change={revenuePct != null ? `${revenuePct >= 0 ? '+' : ''}${revenuePct}% vs last month` : 'No data last month'}
          changePct={revenuePct}
          sparkline={revenueSparkline}
          icon={DollarSign}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          loading={loading}
        />
        <StatCard
          label="Outstanding"
          value={fmt(outstanding)}
          change={`${outstandingCount} unpaid invoice${outstandingCount !== 1 ? 's' : ''}`}
          changePct={null}
          sparkline={outstandingSparkline}
          icon={AlertCircle}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={loading}
        />
        <StatCard
          label="Active Projects"
          value={String(activeProjects)}
          change={`${projects.filter((p) => p.status === 'completed').length} completed total`}
          changePct={null}
          sparkline={projectsSparkline}
          icon={Briefcase}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          loading={loading}
        />
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Invoices — left 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Recent Invoices</h3>
            <Link href="/invoices" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentInvoices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Receipt size={32} className="text-gray-300" />
              <p className="text-sm text-gray-400">No invoices yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Invoice</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">Client</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentInvoices.map((inv) => {
                  const status = effectiveStatus(inv);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-700 hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                        <p className="text-[10px] text-gray-400">
                          {inv.issueDate ? format(new Date(inv.issueDate.seconds * 1000), 'MMM d, yyyy') : '—'}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">{inv.clientName}</td>
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-semibold capitalize', INV_STATUS_CLS[status] ?? 'bg-gray-100 text-gray-600')}>
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-900 font-medium">
                        {fmt(inv.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Lead Pipeline mini-chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Lead Pipeline</h3>
              <Link href="/leads" className="text-xs text-blue-600 hover:underline">View all</Link>
            </div>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : leads.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400">No leads yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pipelineByStage.filter((s) => s.count > 0).map(({ stage, count, value }) => (
                  <div key={stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">{STAGE_LABELS[stage]}</span>
                      <span className="text-gray-500">{count} · {fmt(value)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((value / maxPipelineValue) * 100)}%`,
                          backgroundColor: STAGE_COLORS[stage],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No recent activity</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((item) => {
                  const Icon = item.icon;
                  const ago = item.time
                    ? (() => {
                        const diffMs = Date.now() - item.time;
                        const mins = Math.floor(diffMs / 60000);
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        return `${Math.floor(hrs / 24)}d ago`;
                      })()
                    : '';
                  return (
                    <li key={item.id} className="flex items-start gap-3">
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', item.iconBg)}>
                        <Icon size={13} className={item.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-snug">{item.text}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{ago}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
