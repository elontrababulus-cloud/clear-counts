'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Pencil, Trash2, DollarSign, Calendar, User, Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { softDelete } from '@/lib/firestore/helpers';
import type { LeadDoc } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActivityLog } from './ActivityLog';
import { LeadForm } from './LeadForm';
import { COLUMN_META } from './KanbanColumn';
import { STAGE_COLORS } from './LeadCard';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface LeadDetailProps {
  lead: LeadDoc | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadDetail({ lead, open, onOpenChange }: LeadDetailProps) {
  const { role } = useAuth();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  if (!lead) return null;

  const meta = COLUMN_META[lead.stage];
  const closeDate = lead.expectedCloseDate
    ? format(new Date(lead.expectedCloseDate.seconds * 1000), 'MMM d, yyyy')
    : '—';
  const createdDate = lead.createdAt
    ? format(new Date(lead.createdAt.seconds * 1000), 'MMM d, yyyy')
    : '—';

  const handleDelete = async () => {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await softDelete('leads', lead.id);
      toast.success('Lead deleted');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete lead');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto flex flex-col gap-6">
          <SheetHeader>
            <SheetTitle className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-1 inline-block w-1 self-stretch rounded-full shrink-0',
                  STAGE_COLORS[lead.stage].replace('border-l-', 'bg-'),
                )}
              />
              <span className="leading-snug">{lead.title}</span>
            </SheetTitle>

            {/* Stage badge + actions */}
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn('text-xs', meta.badgeCls, 'border-0')}>
                {meta.label}
              </Badge>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  title="Open full page"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {role === 'admin' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailRow
              icon={<User className="h-3.5 w-3.5" />}
              label="Client"
              value={lead.clientName}
            />
            <DetailRow
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Value"
              value={`${lead.value.toLocaleString()} ${lead.currency}`}
              mono
            />
            <DetailRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Close Date"
              value={closeDate}
            />
            <DetailRow
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Source"
              value={lead.source.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            />
            <DetailRow label="Created" value={createdDate} className="col-span-2" />
          </div>

          <hr className="border-border" />

          {/* Activity log */}
          <ActivityLog leadId={lead.id} />
        </SheetContent>
      </Sheet>

      {/* Edit dialog */}
      <LeadForm
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
      />
    </>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  mono,
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-0.5', className)}>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</p>
    </div>
  );
}
