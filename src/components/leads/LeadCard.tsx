'use client';

import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { GripVertical, Calendar, DollarSign } from 'lucide-react';
import type { LeadDoc, LeadStage } from '@/types';
import { cn } from '@/lib/utils';

// ─── Stage colours ────────────────────────────────────────────────────────────

export const STAGE_COLORS: Record<LeadStage, string> = {
  new: 'border-l-blue-500',
  contacted: 'border-l-violet-500',
  proposal: 'border-l-pink-500',
  negotiation: 'border-l-amber-500',
  won: 'border-l-green-500',
  lost: 'border-l-slate-400',
};

// ─── Static card (used in DragOverlay) ────────────────────────────────────────

interface StaticCardProps {
  lead: LeadDoc;
  isDragging?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const StaticLeadCard = forwardRef<HTMLDivElement, StaticCardProps>(
  ({ lead, isDragging, onClick, style, className }, ref) => {
    const closeDate = lead.expectedCloseDate
      ? format(new Date(lead.expectedCloseDate.seconds * 1000), 'MMM d, yyyy')
      : null;

    return (
      <div
        ref={ref}
        style={style}
        onClick={onClick}
        className={cn(
          'group relative bg-card border border-border rounded-lg p-3 cursor-pointer',
          'hover:shadow-md transition-shadow select-none',
          'border-l-4',
          STAGE_COLORS[lead.stage],
          isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30',
          className,
        )}
      >
        {/* Drag handle */}
        <span className="absolute top-2 right-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </span>

        {/* Title */}
        <p className="text-sm font-medium leading-snug pr-5 line-clamp-2">{lead.title}</p>

        {/* Client */}
        <p className="text-xs text-muted-foreground mt-1 truncate">{lead.clientName}</p>

        {/* Metadata row */}
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-xs font-mono font-medium">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            {lead.value.toLocaleString()} {lead.currency}
          </span>
          {closeDate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {closeDate}
            </span>
          )}
        </div>
      </div>
    );
  },
);
StaticLeadCard.displayName = 'StaticLeadCard';

// ─── Sortable card (used inside KanbanColumn) ─────────────────────────────────

interface LeadCardProps {
  lead: LeadDoc;
  onOpen: (lead: LeadDoc) => void;
}

export function LeadCard({ lead, onOpen }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { lead } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StaticLeadCard lead={lead} isDragging={isDragging} onClick={() => onOpen(lead)} />
    </div>
  );
}
