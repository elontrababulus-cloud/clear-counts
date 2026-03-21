'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { create, update } from '@/lib/firestore/helpers';
import type { LeadDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'] as const;
const SOURCES = ['referral', 'cold_call', 'whatsapp', 'website', 'walk_in'] as const;
const CURRENCIES = ['USD', 'ZWG', 'ZWL'] as const;

const SELECT_CLS = cn(
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  clientName: z.string().min(1, 'Client name is required'),
  clientId: z.string(),
  value: z.string().min(1, 'Value is required'),
  currency: z.enum(CURRENCIES),
  stage: z.enum(STAGES),
  source: z.enum(SOURCES),
  assignedTo: z.string(),
  expectedCloseDate: z.string().min(1, 'Expected close date is required'),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface LeadFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: LeadDoc | null;
  /** Called after successful create/update */
  onSaved?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadForm({ open, onOpenChange, lead, onSaved }: LeadFormProps) {
  const { user } = useAuth();
  const isEdit = !!lead;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      clientName: '',
      clientId: '',
      value: '0',
      currency: 'USD',
      stage: 'new',
      source: 'referral',
      assignedTo: '',
      expectedCloseDate: '',
      notes: '',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (lead) {
      const dateStr = lead.expectedCloseDate
        ? new Date(lead.expectedCloseDate.seconds * 1000).toISOString().split('T')[0]
        : '';
      reset({
        title: lead.title,
        clientName: lead.clientName,
        clientId: lead.clientId ?? '',
        value: String(lead.value),
        currency: (lead.currency as (typeof CURRENCIES)[number]) ?? 'USD',
        stage: lead.stage,
        source: (lead.source as (typeof SOURCES)[number]) ?? 'referral',
        assignedTo: lead.assignedTo ?? '',
        expectedCloseDate: dateStr,
        notes: '',
      });
    } else {
      reset({
        title: '',
        clientName: '',
        clientId: '',
        value: '0',
        currency: 'USD',
        stage: 'new',
        source: 'referral',
        assignedTo: '',
        expectedCloseDate: '',
        notes: '',
      });
    }
  }, [lead, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    try {
      const numericValue = parseFloat(values.value) || 0;
      const closeDate = Timestamp.fromDate(new Date(values.expectedCloseDate));

      if (isEdit && lead) {
        await update<LeadDoc>('leads', lead.id, {
          title: values.title,
          clientName: values.clientName,
          clientId: values.clientId || undefined,
          value: numericValue,
          currency: values.currency,
          stage: values.stage,
          source: values.source,
          assignedTo: values.assignedTo,
          expectedCloseDate: closeDate,
        });
        toast.success('Lead updated');
        onSaved?.(lead.id);
      } else {
        const id = await create<LeadDoc>('leads', {
          title: values.title,
          clientName: values.clientName,
          clientId: values.clientId || undefined,
          value: numericValue,
          currency: values.currency,
          stage: values.stage,
          source: values.source,
          assignedTo: values.assignedTo,
          expectedCloseDate: closeDate,
          status: 'active',
          createdBy: user.uid,
        });
        toast.success('Lead created');
        onSaved?.(id);
      }

      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Lead' : 'New Lead'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register('title')} placeholder="e.g. Website Redesign" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Client Name */}
          <div className="space-y-1">
            <Label htmlFor="clientName">Client Name *</Label>
            <Input id="clientName" {...register('clientName')} placeholder="Company or individual" />
            {errors.clientName && (
              <p className="text-xs text-destructive">{errors.clientName.message}</p>
            )}
          </div>

          {/* Value + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="value">Value *</Label>
              <Input id="value" type="number" min="0" step="0.01" {...register('value')} />
              {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" {...register('currency')} className={SELECT_CLS}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stage + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="stage">Stage</Label>
              <select id="stage" {...register('stage')} className={SELECT_CLS}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="source">Source</Label>
              <select id="source" {...register('source')} className={SELECT_CLS}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assigned To */}
          <div className="space-y-1">
            <Label htmlFor="assignedTo">Assigned To (UID)</Label>
            <Input id="assignedTo" {...register('assignedTo')} placeholder="Staff member UID" />
          </div>

          {/* Expected Close Date */}
          <div className="space-y-1">
            <Label htmlFor="expectedCloseDate">Expected Close Date *</Label>
            <Input id="expectedCloseDate" type="date" {...register('expectedCloseDate')} />
            {errors.expectedCloseDate && (
              <p className="text-xs text-destructive">{errors.expectedCloseDate.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
