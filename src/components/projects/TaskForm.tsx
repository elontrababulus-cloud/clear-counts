'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { where, orderBy, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { create, update } from '@/lib/firestore/helpers';
import type { TaskDoc, TaskStatus, TaskPriority } from '@/types';
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

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const SELECT_CLS = cn(
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
);

const TEXTAREA_CLS = cn(
  'flex min-h-[72px] w-full rounded-lg border border-input bg-transparent px-3 py-2',
  'text-sm outline-none transition-colors resize-none',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
);

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string(),
  priority: z.enum(PRIORITIES),
  assignedTo: z.string(),
  dueDate: z.string(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  /** Default status when creating a new task */
  defaultStatus?: TaskStatus;
  /** Existing task to edit */
  task?: TaskDoc | null;
  /** Number of tasks currently in this column (used to set initial order) */
  columnCount?: number;
  onSaved?: (task: TaskDoc) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskForm({
  open,
  onOpenChange,
  projectId,
  defaultStatus = 'todo',
  task,
  columnCount = 0,
  onSaved,
}: TaskFormProps) {
  const { user } = useAuth();
  const isEdit = !!task;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      assignedTo: '',
      dueDate: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (task) {
      reset({
        title: task.title,
        description: task.description,
        priority: task.priority,
        assignedTo: task.assignedTo ?? '',
        dueDate: task.dueDate
          ? new Date(task.dueDate.seconds * 1000).toISOString().split('T')[0]
          : '',
      });
    } else {
      reset({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '' });
    }
  }, [open, task, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    try {
      const dueDate = values.dueDate
        ? Timestamp.fromDate(new Date(values.dueDate))
        : undefined;

      if (isEdit && task) {
        const updated: Partial<TaskDoc> = {
          title: values.title,
          description: values.description,
          priority: values.priority as TaskPriority,
          assignedTo: values.assignedTo,
          dueDate,
        };
        await update<TaskDoc>(`projects/${projectId}/tasks`, task.id, updated);
        toast.success('Task updated');
        onSaved?.({ ...task, ...updated });
      } else {
        const newTask: Omit<TaskDoc, 'id' | 'createdAt' | 'updatedAt'> = {
          projectId,
          title: values.title,
          description: values.description,
          priority: values.priority as TaskPriority,
          assignedTo: values.assignedTo,
          status: defaultStatus,
          order: columnCount,
          dueDate,
          createdBy: user.uid,
        };
        const id = await create<TaskDoc>(`projects/${projectId}/tasks`, newTask);
        toast.success('Task created');
        onSaved?.({ id, ...newTask, createdAt: Timestamp.now() });
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save task');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register('title')} placeholder="Task title" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="desc">Description</Label>
            <textarea id="desc" {...register('description')} className={TEXTAREA_CLS} rows={3} placeholder="Optional details…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" {...register('priority')} className={SELECT_CLS}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" {...register('dueDate')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="assignedTo">Assigned To (UID)</Label>
            <Input id="assignedTo" {...register('assignedTo')} placeholder="Staff member UID" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
