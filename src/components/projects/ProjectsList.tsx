'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { FolderOpen, Plus, Users, DollarSign } from 'lucide-react';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type { ProjectDoc, ProjectStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectForm } from './ProjectForm';
import { PROJECT_STATUS_META } from './ProjectHeader';
import { cn } from '@/lib/utils';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectsList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection<ProjectDoc>(
      'projects',
      [],
      (docs) => {
        setProjects(docs.filter((p) => p.status !== 'deleted'));
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const active = projects.filter((p) => p.status === 'active').length;
  const completed = projects.filter((p) => p.status === 'completed').length;
  const onHold = projects.filter((p) => p.status === 'on_hold').length;
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active" value={active} sub="ongoing projects" />
        <StatCard label="Completed" value={completed} sub="delivered" />
        <StatCard label="On Hold" value={onHold} sub="paused" />
        <StatCard
          label="Total Budget"
          value={`$${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub="across all projects"
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">All Projects</h2>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Project
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">No projects yet. Create your first one.</p>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Project</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Due</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Budget</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Team</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((project) => {
                const meta = PROJECT_STATUS_META[project.status];
                const pct =
                  project.taskCount > 0
                    ? Math.round((project.completedTaskCount / project.taskCount) * 100)
                    : 0;
                const dueDate = project.dueDate
                  ? format(new Date(project.dueDate.seconds * 1000), 'MMM d, yyyy')
                  : '—';

                return (
                  <tr
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <p className="font-medium">{project.name}</p>
                      {project.tags && project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {project.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {project.clientName}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge className={cn('border-0 text-xs', meta.cls)}>{meta.label}</Badge>
                    </td>

                    {/* Due date */}
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {dueDate}
                    </td>

                    {/* Budget */}
                    <td className="px-4 py-3 font-mono text-sm hidden lg:table-cell">
                      {project.currency} {project.budget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Team */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground mr-0.5" />
                        <span className="text-muted-foreground">{project.members?.length ?? 0}</span>
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-8 shrink-0">
                          {pct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {project.completedTaskCount}/{project.taskCount} tasks
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProjectForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
