'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { where, orderBy, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Check, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { create, update, getAll } from '@/lib/firestore/helpers';
import type { ProjectDoc, ClientDoc } from '@/types';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
  uid: string;
  displayName: string;
  email: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SELECT_CLS = cn(
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

const TEXTAREA_CLS = cn(
  'flex min-h-[72px] w-full rounded-lg border border-input bg-transparent px-3 py-2',
  'text-sm outline-none transition-colors resize-none',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
);

const STATUSES = ['planning', 'active', 'on_hold', 'completed'] as const;
const CURRENCIES = ['USD', 'ZWG', 'ZWL'] as const;

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  clientId: z.string().min(1, 'Client is required'),
  description: z.string(),
  status: z.enum(STATUSES),
  startDate: z.string().min(1, 'Start date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  budget: z.string(),
  currency: z.enum(CURRENCIES),
  tagsInput: z.string(),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project?: ProjectDoc | null;
  onSaved?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectForm({ open, onOpenChange, project, onSaved }: ProjectFormProps) {
  const { user } = useAuth();
  const isEdit = !!project;

  const [clients, setClients] = useState<ClientDoc[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDoc | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);

  // Load clients and staff users
  useEffect(() => {
    if (!open) return;
    getAll<ClientDoc>('clients', {
      constraints: [where('status', 'in', ['active', 'prospect']), orderBy('companyName')],
      pageSize: 200,
    }).then(({ data }) => setClients(data));

    getAll<StaffUser & { role: string }>('users', {
      constraints: [where('role', 'in', ['admin', 'staff']), orderBy('displayName')],
      pageSize: 100,
    }).then(({ data }) => setStaffUsers(data));
  }, [open]);

  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      clientId: '',
      description: '',
      status: 'planning',
      startDate: todayStr,
      dueDate: '',
      budget: '0',
      currency: 'USD',
      tagsInput: '',
      notes: '',
    },
  });

  // Populate when editing
  useEffect(() => {
    if (!open) return;
    if (project) {
      const start = project.startDate
        ? new Date(project.startDate.seconds * 1000).toISOString().split('T')[0]
        : todayStr;
      const due = project.dueDate
        ? new Date(project.dueDate.seconds * 1000).toISOString().split('T')[0]
        : '';
      reset({
        name: project.name,
        clientId: project.clientId,
        description: project.description ?? '',
        status: project.status as (typeof STATUSES)[number],
        startDate: start,
        dueDate: due,
        budget: String(project.budget),
        currency: (project.currency as (typeof CURRENCIES)[number]) ?? 'USD',
        tagsInput: project.tags?.join(', ') ?? '',
        notes: project.notes ?? '',
      });
      setSelectedMembers(project.members ?? []);
    } else {
      reset({
        name: '', clientId: '', description: '', status: 'planning',
        startDate: todayStr, dueDate: '', budget: '0', currency: 'USD',
        tagsInput: '', notes: '',
      });
      setSelectedMembers([]);
      setSelectedClient(null);
      setClientSearch('');
    }
  }, [open, project, reset, todayStr]);

  // Pre-select client when editing
  useEffect(() => {
    if (project && clients.length > 0) {
      const c = clients.find((cl) => cl.id === project.clientId);
      if (c) { setSelectedClient(c); setClientSearch(c.companyName); }
    }
  }, [project, clients]);

  const filteredClients = clients.filter((c) =>
    c.companyName.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  const handleClientSelect = useCallback(
    (client: ClientDoc) => {
      setSelectedClient(client);
      setClientSearch(client.companyName);
      setValue('clientId', client.id, { shouldValidate: true });
      setClientDropdownOpen(false);
    },
    [setValue],
  );

  const toggleMember = (uid: string) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((m) => m !== uid) : [...prev, uid],
    );
  };

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    const tags = values.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name: values.name,
      clientId: selectedClient?.id ?? project?.clientId ?? '',
      clientUid: selectedClient?.createdBy ?? project?.clientUid ?? '',
      clientName: selectedClient?.companyName ?? project?.clientName ?? '',
      description: values.description,
      status: values.status as ProjectDoc['status'],
      startDate: Timestamp.fromDate(new Date(values.startDate)),
      dueDate: Timestamp.fromDate(new Date(values.dueDate)),
      budget: parseFloat(values.budget) || 0,
      currency: values.currency,
      members: selectedMembers,
      tags,
      notes: values.notes,
    };

    try {
      if (isEdit && project) {
        await update<ProjectDoc>('projects', project.id, payload);
        toast.success('Project updated');
        onSaved?.(project.id);
      } else {
        const id = await create<ProjectDoc>('projects', {
          ...payload,
          taskCount: 0,
          completedTaskCount: 0,
          createdBy: user.uid,
        });
        toast.success('Project created');
        onSaved?.(id);
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save project');
    }
  };

  const memberNames = selectedMembers
    .map((uid) => staffUsers.find((u) => u.uid === uid)?.displayName ?? uid.slice(0, 6))
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Project' : 'New Project'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">Project Name *</Label>
            <Input id="name" {...register('name')} placeholder="e.g. Website Redesign" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Client selector */}
          <div className="space-y-1 relative">
            <Label>Client *</Label>
            <Input
              placeholder="Search clients…"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setClientDropdownOpen(true);
                if (!e.target.value) { setSelectedClient(null); setValue('clientId', ''); }
              }}
              onFocus={() => setClientDropdownOpen(true)}
              onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
              autoComplete="off"
            />
            <input type="hidden" {...register('clientId')} />
            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
            {clientDropdownOpen && filteredClients.length > 0 && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-44 overflow-y-auto">
                {filteredClients.slice(0, 20).map((c) => (
                  <button key={c.id} type="button" onMouseDown={() => handleClientSelect(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60">
                    {c.companyName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <select id="status" {...register('status')} className={SELECT_CLS}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" {...register('currency')} className={SELECT_CLS}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input id="dueDate" type="date" {...register('dueDate')} />
              {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-1">
            <Label htmlFor="budget">Budget (USD)</Label>
            <Input id="budget" type="number" min="0" step="0.01" {...register('budget')} />
          </div>

          {/* Team Members multi-select */}
          <div className="space-y-1 relative">
            <Label>Team Members</Label>
            <button
              type="button"
              onClick={() => setMemberDropdownOpen((v) => !v)}
              className={cn(
                SELECT_CLS,
                'flex items-center justify-between text-left',
                !memberNames && 'text-muted-foreground',
              )}
            >
              <span className="truncate">{memberNames || 'Select team members…'}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-2" />
            </button>
            {memberDropdownOpen && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-44 overflow-y-auto">
                {staffUsers.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No staff users found</p>
                ) : (
                  staffUsers.map((u) => {
                    const checked = selectedMembers.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => toggleMember(u.uid)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60"
                      >
                        <span className={cn(
                          'flex h-4 w-4 items-center justify-center rounded border',
                          checked ? 'bg-primary border-primary' : 'border-input',
                        )}>
                          {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                        </span>
                        <span>{u.displayName || u.email}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <textarea id="description" {...register('description')} className={TEXTAREA_CLS} rows={3} placeholder="Project description…" />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <Label htmlFor="tagsInput">Tags</Label>
            <Input id="tagsInput" {...register('tagsInput')} placeholder="e.g. branding, development, urgent" />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <textarea id="notes" {...register('notes')} className={TEXTAREA_CLS} rows={3} placeholder="Internal notes…" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
