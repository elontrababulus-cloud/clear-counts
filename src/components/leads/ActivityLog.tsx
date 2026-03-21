'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Phone, Mail, Calendar, FileText, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToCollection, create } from '@/lib/firestore/helpers';
import { orderBy } from 'firebase/firestore';
import type { LeadActivityDoc, LeadActivityType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_TYPES: { value: LeadActivityType; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: 'call', label: 'Call', Icon: Phone },
  { value: 'email', label: 'Email', Icon: Mail },
  { value: 'meeting', label: 'Meeting', Icon: Calendar },
  { value: 'note', label: 'Note', Icon: FileText },
];

const TYPE_COLORS: Record<LeadActivityType, string> = {
  call: 'bg-blue-100 text-blue-700',
  email: 'bg-purple-100 text-purple-700',
  meeting: 'bg-green-100 text-green-700',
  note: 'bg-amber-100 text-amber-700',
};

const SELECT_CLS = cn(
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
);

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note']),
  description: z.string().min(1, 'Description is required'),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityLogProps {
  leadId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityLog({ leadId }: ActivityLogProps) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<LeadActivityDoc[]>([]);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'note', description: '' },
  });

  useEffect(() => {
    const unsub = subscribeToCollection<LeadActivityDoc>(
      `leads/${leadId}/activities`,
      [orderBy('createdAt', 'desc')],
      setActivities,
    );
    return unsub;
  }, [leadId]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    try {
      await create<LeadActivityDoc>(`leads/${leadId}/activities`, {
        leadId,
        type: values.type,
        description: values.description,
        performedBy: user.uid,
      });
      toast.success('Activity logged');
      reset({ type: 'note', description: '' });
      setShowForm(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to log activity');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">Activity Log</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Log Activity
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="border rounded-lg p-3 space-y-3 bg-muted/30"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <select {...register('type')} className={SELECT_CLS}>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description *</Label>
            <Input {...register('description')} placeholder="What happened?" />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); reset(); }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </form>
      )}

      {/* Activity list */}
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No activities yet.</p>
      ) : (
        <ol className="space-y-3">
          {activities.map((a) => {
            const meta = ACTIVITY_TYPES.find((t) => t.value === a.type);
            const Icon = meta?.Icon ?? FileText;
            const ts = a.createdAt
              ? format(new Date(a.createdAt.seconds * 1000), 'MMM d, yyyy · h:mm a')
              : '';

            return (
              <li key={a.id} className="flex gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
                    TYPE_COLORS[a.type],
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{a.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ts}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
