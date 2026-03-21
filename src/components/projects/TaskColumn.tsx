'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { TaskDoc, TaskStatus } from '@/types';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';

// ─── Column metadata ──────────────────────────────────────────────────────────

export const COLUMN_META: Record<TaskStatus, { label: string; headerCls: string; dotCls: string }> = {
  todo:        { label: 'To Do',       headerCls: 'text-slate-700',  dotCls: 'bg-slate-400' },
  in_progress: { label: 'In Progress', headerCls: 'text-blue-700',   dotCls: 'bg-blue-500' },
  review:      { label: 'Review',      headerCls: 'text-amber-700',  dotCls: 'bg-amber-500' },
  done:        { label: 'Done',        headerCls: 'text-green-700',  dotCls: 'bg-green-500' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskColumnProps {
  status: TaskStatus;
  tasks: TaskDoc[];
  onOpen: (task: TaskDoc) => void;
  onAddTask: (status: TaskStatus) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskColumn({ status, tasks, onOpen, onAddTask }: TaskColumnProps) {
  const meta = COLUMN_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const ids = tasks.map((t) => t.id);
  const done = tasks.filter((t) => t.status === 'done').length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="flex flex-col min-h-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dotCls)} />
          <span className={cn('text-sm font-semibold', meta.headerCls)}>{meta.label}</span>
          <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(status)}
          className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={`Add task to ${meta.label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar (only for done column) */}
      {status === 'done' && tasks.length > 0 && (
        <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Drop zone */}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'flex flex-col gap-2 flex-1 min-h-[120px] rounded-xl p-2 transition-colors',
            isOver ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-muted/40',
          )}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpen} />
          ))}

          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-full min-h-[80px]">
              <p className="text-xs text-muted-foreground">Drop tasks here</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
