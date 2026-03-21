'use client';

import { useEffect, useState } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { Plus, LayoutGrid, List, Search } from 'lucide-react';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type { LeadDoc, LeadStage } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { KanbanBoard } from '@/components/leads/KanbanBoard';
import { LeadDetail } from '@/components/leads/LeadDetail';
import { LeadForm } from '@/components/leads/LeadForm';
import { COLUMN_META } from '@/components/leads/KanbanColumn';
import { STAGE_COLORS } from '@/components/leads/LeadCard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'kanban' | 'list';

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadDoc | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Real-time subscription
  useEffect(() => {
    const unsub = subscribeToCollection<LeadDoc>(
      'leads',
      [
        where('status', '!=', 'deleted'),
        orderBy('status'),
        orderBy('createdAt', 'desc'),
      ],
      (data) => {
        setLeads(data);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  function handleOpen(lead: LeadDoc) {
    setSelectedLead(lead);
    setDetailOpen(true);
  }

  // Filter
  const filtered = leads.filter((l) => {
    const matchesStage = stageFilter === 'all' || l.stage === stageFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      l.title.toLowerCase().includes(q) ||
      l.clientName.toLowerCase().includes(q);
    return matchesStage && matchesSearch;
  });

  const totalValue = filtered.reduce((sum, l) => sum + l.value, 0);

  // Stage filter chips
  const stages: Array<LeadStage | 'all'> = ['all', 'new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads & Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} ·{' '}
            <span className="font-mono">${totalValue.toLocaleString()}</span> pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                view === 'kanban'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                view === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {/* Stage chips */}
        <div className="flex flex-wrap gap-1.5">
          {stages.map((s) => {
            const active = stageFilter === s;
            const meta = s !== 'all' ? COLUMN_META[s] : null;
            return (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
                  active
                    ? meta
                      ? `${meta.badgeCls} border-transparent`
                      : 'bg-primary text-primary-foreground border-transparent'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {s === 'all' ? 'All' : COLUMN_META[s].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col min-w-[260px] gap-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-6 w-full" />
              {Array.from({ length: 2 }).map((__, j) => (
                <Skeleton key={j} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard leads={filtered} onOpen={handleOpen} />
      ) : (
        <LeadListView leads={filtered} onOpen={handleOpen} />
      )}

      {/* New lead dialog */}
      <LeadForm open={createOpen} onOpenChange={setCreateOpen} />

      {/* Detail sheet */}
      <LeadDetail
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function LeadListView({
  leads,
  onOpen,
}: {
  leads: LeadDoc[];
  onOpen: (lead: LeadDoc) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <p className="text-sm">No leads found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {['Title', 'Client', 'Stage', 'Value', 'Close Date'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const meta = COLUMN_META[lead.stage];
            const closeDate = lead.expectedCloseDate
              ? format(new Date(lead.expectedCloseDate.seconds * 1000), 'MMM d, yyyy')
              : '—';

            return (
              <tr
                key={lead.id}
                onClick={() => onOpen(lead)}
                className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-block w-1 h-4 rounded-full mr-2 align-middle',
                      STAGE_COLORS[lead.stage].replace('border-l-', 'bg-'),
                    )}
                  />
                  {lead.title}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{lead.clientName}</td>
                <td className="px-4 py-3">
                  <Badge className={cn('text-xs border-0', meta.badgeCls)}>
                    {meta.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono">
                  ${lead.value.toLocaleString()} {lead.currency}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{closeDate}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
