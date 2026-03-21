'use client';

import { useState } from 'react';
import { format, isPast } from 'date-fns';
import { Pencil, Trash2, Calendar, AlertCircle, Flag, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { update, softDelete } from '@/lib/firestore/helpers';
import type { TaskDoc, TaskStatus, TaskPriority } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CommentsSection } from './CommentsSection';
import { TaskForm } from './TaskForm';
import { PRIORITY_META } from './TaskCard';
import { cn } from '@/lib/utils';

// ─── Status options ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review',      label: 'Review' },
  { value: 'done',        label: 'Done' },
];

const STATUS_CLS: Record<TaskStatus, string> = {
  todo:        'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-amber-100 text-amber-700',
  done:        'bg-green-100 text-green-700',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskDetailProps {
  task: TaskDoc | null;
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTaskUpdated?: (task: TaskDoc) => void;
  onTaskDeleted?: (taskId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskDetail({
  task,
  projectId,
  open,
  onOpenChange,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailProps) {
  const { role } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  if (!task) return null;

  const priority = PRIORITY_META[task.priority];
  const dueDateStr = task.dueDate
    ? format(new Date(task.dueDate.seconds * 1000), 'MMM d, yyyy')
    : null;
  const overdue =
    task.dueDate && isPast(new Date(task.dueDate.seconds * 1000)) && task.status !== 'done';

  // Inline status change
  const handleStatusChange = async (newStatus: TaskStatus) => {
    // Optimistic update
    const optimistic = { ...task, status: newStatus };
    onTaskUpdated?.(optimistic);
    try {
      await update<TaskDoc>(`projects/${projectId}/tasks`, task.id, { status: newStatus });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
      onTaskUpdated?.(task); // revert
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    try {
      await softDelete(`projects/${projectId}/tasks`, task.id);
      toast.success('Task deleted');
      onTaskDeleted?.(task.id);
      onOpenChange(false);
    } catch {
      toast.error('Failed to delete task');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto flex flex-col gap-5">
          <SheetHeader>
            <SheetTitle className="leading-snug pr-4">{task.title}</SheetTitle>

            {/* Actions */}
            <div className="flex items-center gap-1 mt-1">
              <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Edit
              </Button>
              {role === 'admin' && (
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Status selector */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    task.status === opt.value
                      ? `${STATUS_CLS[opt.value]} border-transparent`
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <MetaItem icon={<Flag className="h-3.5 w-3.5" />} label="Priority">
              <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-semibold', priority.cls)}>
                {priority.label}
              </span>
            </MetaItem>

            <MetaItem icon={<Calendar className="h-3.5 w-3.5" />} label="Due Date">
              {dueDateStr ? (
                <span className={cn('text-sm font-medium', overdue && 'text-red-600 flex items-center gap-1')}>
                  {overdue && <AlertCircle className="h-3.5 w-3.5" />}
                  {dueDateStr}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </MetaItem>

            {task.assignedTo && (
              <MetaItem icon={<User className="h-3.5 w-3.5" />} label="Assigned To" className="col-span-2">
                <span className="text-sm font-mono text-muted-foreground">{task.assignedTo}</span>
              </MetaItem>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Description</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <hr className="border-border" />

          {/* Comments */}
          <CommentsSection projectId={projectId} taskId={task.id} />
        </SheetContent>
      </Sheet>

      <TaskForm
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        task={task}
        onSaved={(updated) => onTaskUpdated?.(updated)}
      />
    </>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function MetaItem({
  icon, label, children, className,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-0.5', className)}>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</p>
      {children}
    </div>
  );
}
