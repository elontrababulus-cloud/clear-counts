'use client';

import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast } from 'date-fns';
import { GripVertical, Calendar, AlertCircle } from 'lucide-react';
import type { TaskDoc, TaskPriority } from '@/types';
import { cn } from '@/lib/utils';

// ─── Priority metadata ────────────────────────────────────────────────────────

export const PRIORITY_META: Record<TaskPriority, { label: string; cls: string }> = {
  low:    { label: 'Low',    cls: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', cls: 'bg-blue-100 text-blue-700' },
  high:   { label: 'High',   cls: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700' },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function MiniAvatar({ uid }: { uid: string }) {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-pink-500', 'bg-amber-500', 'bg-green-500'];
  const color = colors[uid.charCodeAt(0) % colors.length];
  return (
    <span className={cn('inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold text-white shrink-0', color)}>
      {uid.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ─── Static card (used for DragOverlay) ──────────────────────────────────────

interface StaticTaskCardProps {
  task: TaskDoc;
  isDragging?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const StaticTaskCard = forwardRef<HTMLDivElement, StaticTaskCardProps>(
  ({ task, isDragging, onClick, style, className }, ref) => {
    const priority = PRIORITY_META[task.priority];
    const dueDateStr = task.dueDate
      ? format(new Date(task.dueDate.seconds * 1000), 'MMM d')
      : null;
    const overdue =
      task.dueDate &&
      isPast(new Date(task.dueDate.seconds * 1000)) &&
      task.status !== 'done';

    return (
      <div
        ref={ref}
        style={style}
        onClick={onClick}
        className={cn(
          'group relative bg-card border border-border rounded-lg p-3 cursor-pointer',
          'hover:shadow-md transition-shadow select-none space-y-2',
          isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30',
          className,
        )}
      >
        {/* Drag handle */}
        <span className="absolute top-2 right-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </span>

        {/* Priority badge */}
        <div className="flex items-center gap-1.5">
          <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', priority.cls)}>
            {priority.label}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-medium leading-snug pr-5 line-clamp-2">{task.title}</p>

        {/* Footer: due date + assignee */}
        <div className="flex items-center justify-between gap-2">
          {dueDateStr ? (
            <span className={cn('flex items-center gap-1 text-xs', overdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
              {overdue && <AlertCircle className="h-3 w-3" />}
              <Calendar className="h-3 w-3" />
              {dueDateStr}
            </span>
          ) : (
            <span />
          )}
          {task.assignedTo && <MiniAvatar uid={task.assignedTo} />}
        </div>
      </div>
    );
  },
);
StaticTaskCard.displayName = 'StaticTaskCard';

// ─── Sortable card ────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: TaskDoc;
  onOpen: (task: TaskDoc) => void;
}

export function TaskCard({ task, onOpen }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { task } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StaticTaskCard task={task} isDragging={isDragging} onClick={() => onOpen(task)} />
    </div>
  );
}
