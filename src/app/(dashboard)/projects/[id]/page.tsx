'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { subscribeToDoc } from '@/lib/firestore/helpers';
import type { ProjectDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProjectHeader } from '@/components/projects/ProjectHeader';
import { TaskBoard } from '@/components/projects/TaskBoard';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToDoc<ProjectDoc>('projects', id, (data) => {
      setProject(data);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!project || project.status === 'deleted') {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <FolderOpen className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Project not found or has been archived.</p>
        <Button variant="outline" onClick={() => router.push('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Projects
      </Button>

      {/* Header card */}
      <ProjectHeader
        project={project}
        taskCount={project.taskCount}
        completedTaskCount={project.completedTaskCount}
      />

      {/* Tabs */}
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Task Board</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* Task Board tab */}
        <TabsContent value="board" className="mt-4">
          <TaskBoard projectId={id} />
        </TabsContent>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Description */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Description</h3>
              {project.description ? (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {project.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Notes</h3>
              {project.notes ? (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {project.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No notes added.</p>
              )}
            </div>

            {/* Tags */}
            {project.tags && project.tags.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3 lg:col-span-2">
                <h3 className="text-sm font-semibold">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
