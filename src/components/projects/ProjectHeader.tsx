'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Calendar, DollarSign, Users } from 'lucide-react';
import type { ProjectDoc, ProjectStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectForm } from './ProjectForm';
import { cn } from '@/lib/utils';

// ─── Status metadata ──────────────────────────────────────────────────────────

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; cls: string }
> = {
  planning:  { label: 'Planning',   cls: 'bg-slate-100 text-slate-700' },
  active:    { label: 'Active',     cls: 'bg-green-100 text-green-700' },
  on_hold:   { label: 'On Hold',    cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed',  cls: 'bg-blue-100 text-blue-700' },
  deleted:   { label: 'Archived',   cls: 'bg-slate-100 text-slate-400' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProjectHeaderProps {
  project: ProjectDoc;
  taskCount: number;
  completedTaskCount: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectHeader({ project, taskCount, completedTaskCount }: ProjectHeaderProps) {
  const [editOpen, setEditOpen] = useState(false);

  const meta = PROJECT_STATUS_META[project.status];
  const pct = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;

  const startDate = project.startDate
    ? format(new Date(project.startDate.seconds * 1000), 'MMM d, yyyy')
    : '—';
  const dueDate = project.dueDate
    ? format(new Date(project.dueDate.seconds * 1000), 'MMM d, yyyy')
    : '—';

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        {/* Top row: name + status + edit */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge className={cn('border-0', meta.cls)}>{meta.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{project.clientName}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat icon={<Calendar className="h-4 w-4" />} label="Start" value={startDate} />
          <Stat icon={<Calendar className="h-4 w-4" />} label="Due" value={dueDate} />
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Budget"
            value={`${project.currency} ${project.budget.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            mono
          />
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Team"
            value={`${project.members?.length ?? 0} member${(project.members?.length ?? 0) !== 1 ? 's' : ''}`}
          />
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Task Progress</span>
            <span>{completedTaskCount} / {taskCount} tasks · {pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Team avatars */}
        {project.members && project.members.length > 0 && (
          <div className="flex items-center gap-1">
            {project.members.slice(0, 5).map((uid) => (
              <MemberAvatar key={uid} uid={uid} />
            ))}
            {project.members.length > 5 && (
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium text-muted-foreground border-2 border-background">
                +{project.members.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      <ProjectForm
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</p>
      <p className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function MemberAvatar({ uid }: { uid: string }) {
  const initials = uid.slice(0, 2).toUpperCase();
  const colors = [
    'bg-blue-500', 'bg-violet-500', 'bg-pink-500',
    'bg-amber-500', 'bg-green-500', 'bg-red-500',
  ];
  const color = colors[uid.charCodeAt(0) % colors.length];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold text-white',
        'border-2 border-background',
        color,
      )}
      title={uid}
    >
      {initials}
    </span>
  );
}
