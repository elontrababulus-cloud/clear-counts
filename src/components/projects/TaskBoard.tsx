'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { update, subscribeToCollection } from '@/lib/firestore/helpers';
import type { TaskDoc, TaskStatus } from '@/types';
import { TaskColumn } from './TaskColumn';
import { StaticTaskCard } from './TaskCard';
import { TaskDetail } from './TaskDetail';
import { TaskForm } from './TaskForm';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskBoardProps {
  projectId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskBoard({ projectId }: TaskBoardProps) {
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [activeTask, setActiveTask] = useState<TaskDoc | null>(null);

  // Detail sheet
  const [detailTask, setDetailTask] = useState<TaskDoc | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // New task form
  const [formOpen, setFormOpen] = useState(false);
  const [formStatus, setFormStatus] = useState<TaskStatus>('todo');

  const isDraggingRef = useRef(false);

  // ── Real-time subscription ──────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeToCollection<TaskDoc>(
      `projects/${projectId}/tasks`,
      [orderBy('order', 'asc')],
      (docs) => {
        if (!isDraggingRef.current) {
          setTasks(docs.filter((t) => t.status !== 'deleted' as unknown));
        }
      },
    );
    return unsub;
  }, [projectId]);

  // ── DnD sensors ────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Find which column a given dnd `over.id` refers to */
  function resolveTargetStatus(overId: string): TaskStatus | null {
    if (COLUMNS.includes(overId as TaskStatus)) return overId as TaskStatus;
    const overTask = tasks.find((t) => t.id === overId);
    return overTask?.status ?? null;
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = ({ active }: DragStartEvent) => {
    isDraggingRef.current = true;
    setActiveTask(active.data.current?.task as TaskDoc ?? null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    isDraggingRef.current = false;
    setActiveTask(null);

    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    const targetStatus = resolveTargetStatus(String(over.id));
    if (!targetStatus) return;

    const newStatus = targetStatus;
    const statusChanged = draggedTask.status !== newStatus;

    // Re-order within same column
    const sourceTasks = tasks.filter((t) => t.status === draggedTask.status);
    const targetTasks = statusChanged
      ? tasks.filter((t) => t.status === newStatus)
      : sourceTasks;

    const oldIndex = sourceTasks.findIndex((t) => t.id === draggedTask.id);
    const overInTarget = targetTasks.findIndex((t) => t.id === over.id);
    const newIndex = overInTarget >= 0 ? overInTarget : targetTasks.length;

    // Optimistic update
    setTasks((prev) => {
      const withoutDragged = prev.filter((t) => t.id !== draggedTask.id);
      const updatedDragged = { ...draggedTask, status: newStatus };
      const targetList = withoutDragged.filter((t) => t.status === newStatus);

      // Insert at new position
      targetList.splice(newIndex, 0, updatedDragged);

      // Rebuild full list preserving other columns
      const otherCols = withoutDragged.filter((t) => t.status !== newStatus);
      return [...otherCols, ...targetList].sort((a, b) => {
        const aOrder = targetList.indexOf(a) >= 0 ? targetList.indexOf(a) : (a.order ?? 999);
        const bOrder = targetList.indexOf(b) >= 0 ? targetList.indexOf(b) : (b.order ?? 999);
        return aOrder - bOrder;
      });
    });

    // Persist to Firestore
    try {
      const updates: Promise<void>[] = [];
      if (statusChanged) {
        updates.push(
          update<TaskDoc>(`projects/${projectId}/tasks`, draggedTask.id, {
            status: newStatus,
            order: newIndex,
          }),
        );
      } else if (oldIndex !== newIndex) {
        // Same column reorder — update order fields
        const reordered = arrayMove(sourceTasks, oldIndex, newIndex);
        reordered.forEach((t, i) => {
          if (t.order !== i) {
            updates.push(update<TaskDoc>(`projects/${projectId}/tasks`, t.id, { order: i }));
          }
        });
      }
      await Promise.all(updates);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task');
    }
  };

  // ── Column helpers ─────────────────────────────────────────────────────────

  const tasksForColumn = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleOpenDetail = (task: TaskDoc) => {
    setDetailTask(task);
    setDetailOpen(true);
  };

  const handleAddTask = (status: TaskStatus) => {
    setFormStatus(status);
    setFormOpen(true);
  };

  const handleTaskUpdated = (updated: TaskDoc) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setDetailTask(updated);
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleTaskCreated = (task: TaskDoc) => {
    setTasks((prev) => [...prev, task]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={tasksForColumn(status)}
              onOpen={handleOpenDetail}
              onAddTask={handleAddTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <StaticTaskCard task={activeTask} isDragging />}
        </DragOverlay>
      </DndContext>

      {/* Task detail sheet */}
      <TaskDetail
        task={detailTask}
        projectId={projectId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />

      {/* New task form */}
      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        projectId={projectId}
        defaultStatus={formStatus}
        columnCount={tasksForColumn(formStatus).length}
        onSaved={handleTaskCreated}
      />
    </>
  );
}
