'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  DollarSign,
  Calendar,
  User,
  Tag,
} from 'lucide-react';
import { subscribeToDoc, softDelete } from '@/lib/firestore/helpers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { LeadDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityLog } from '@/components/leads/ActivityLog';
import { LeadForm } from '@/components/leads/LeadForm';
import { COLUMN_META } from '@/components/leads/KanbanColumn';
import { STAGE_COLORS } from '@/components/leads/LeadCard';
import { cn } from '@/lib/utils';

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useAuth();
  const [lead, setLead] = useState<LeadDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToDoc<LeadDoc>('leads', id, (data) => {
      setLead(data);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await softDelete('leads', id);
      toast.success('Lead deleted');
      router.push('/leads');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete lead');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!lead || lead.status === 'deleted') {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-muted-foreground">Lead not found.</p>
        <Button variant="outline" onClick={() => router.push('/leads')}>
          Back to Leads
        </Button>
      </div>
    );
  }

  const meta = COLUMN_META[lead.stage];
  const closeDate = lead.expectedCloseDate
    ? format(new Date(lead.expectedCloseDate.seconds * 1000), 'MMM d, yyyy')
    : '—';
  const createdDate = lead.createdAt
    ? format(new Date(lead.createdAt.seconds * 1000), 'MMM d, yyyy')
    : '—';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/leads')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Leads
      </Button>

      {/* Header card */}
      <div
        className={cn(
          'rounded-xl border-l-4 border border-border bg-card p-6 space-y-4',
          STAGE_COLORS[lead.stage],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold leading-snug">{lead.title}</h1>
            <p className="text-sm text-muted-foreground">{lead.clientName}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
            {role === 'admin' && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive border-destructive/30"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Stage badge */}
        <Badge className={cn('border-0 text-sm', meta.badgeCls)}>{meta.label}</Badge>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Value"
            value={`${lead.value.toLocaleString()} ${lead.currency}`}
            mono
          />
          <Stat
            icon={<Calendar className="h-4 w-4" />}
            label="Close Date"
            value={closeDate}
          />
          <Stat
            icon={<Tag className="h-4 w-4" />}
            label="Source"
            value={lead.source.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          />
          <Stat
            icon={<User className="h-4 w-4" />}
            label="Created"
            value={createdDate}
          />
        </div>
      </div>

      {/* Activity log */}
      <div className="rounded-xl border border-border bg-card p-6">
        <ActivityLog leadId={id} />
      </div>

      {/* Edit dialog */}
      <LeadForm open={editOpen} onOpenChange={setEditOpen} lead={lead} />
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</p>
    </div>
  );
}
