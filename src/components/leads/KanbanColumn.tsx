'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { LeadDoc, LeadStage } from '@/types';
import { LeadCard } from './LeadCard';
import { cn } from '@/lib/utils';

// ─── Column header colours ────────────────────────────────────────────────────

export const COLUMN_META: Record<
  LeadStage,
  { label: string; headerCls: string; badgeCls: string }
> = {
  new:         { label: 'New',         headerCls: 'bg-blue-50 border-blue-200',    badgeCls: 'bg-blue-100 text-blue-700' },
  contacted:   { label: 'Contacted',   headerCls: 'bg-violet-50 border-violet-200', badgeCls: 'bg-violet-100 text-violet-700' },
  proposal:    { label: 'Proposal',    headerCls: 'bg-pink-50 border-pink-200',    badgeCls: 'bg-pink-100 text-pink-700' },
  negotiation: { label: 'Negotiation', headerCls: 'bg-amber-50 border-amber-200',  badgeCls: 'bg-amber-100 text-amber-700' },
  won:         { label: 'Won',         headerCls: 'bg-green-50 border-green-200',  badgeCls: 'bg-green-100 text-green-700' },
  lost:        { label: 'Lost',        headerCls: 'bg-slate-50 border-slate-200',  badgeCls: 'bg-slate-100 text-slate-600' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: LeadStage;
  leads: LeadDoc[];
  onOpen: (lead: LeadDoc) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KanbanColumn({ stage, leads, onOpen }: KanbanColumnProps) {
  const meta = COLUMN_META[stage];
  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);

  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const leadIds = leads.map((l) => l.id);

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] shrink-0">
      {/* Column header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 rounded-t-lg border',
          meta.headerCls,
        )}
      >
        <span className="text-sm font-semibold">{meta.label}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-xs font-medium',
              meta.badgeCls,
            )}
          >
            {leads.length}
          </span>
        </div>
      </div>

      {/* Pipeline value */}
      <div className="px-3 py-1.5 bg-muted/40 border-x border-border text-xs text-muted-foreground">
        ${totalValue.toLocaleString()}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 flex flex-col gap-2 p-2 border border-t-0 rounded-b-lg min-h-[200px]',
          'overflow-y-auto max-h-[calc(100vh-280px)]',
          isOver ? 'bg-primary/5 border-primary/30' : 'bg-muted/20 border-border',
          'transition-colors',
        )}
      >
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Drop leads here</p>
        )}
      </div>
    </div>
  );
}
