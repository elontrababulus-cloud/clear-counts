'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { update } from '@/lib/firestore/helpers';
import { toast } from 'sonner';
import type { LeadDoc, LeadStage } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { StaticLeadCard } from './LeadCard';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: LeadStage[] = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];

// ─── Props ────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  leads: LeadDoc[];
  onOpen: (lead: LeadDoc) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KanbanBoard({ leads, onOpen }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Group leads by stage
  const byStage = STAGES.reduce<Record<LeadStage, LeadDoc[]>>((acc, stage) => {
    acc[stage] = leads.filter((l) => l.stage === stage);
    return acc;
  }, {} as Record<LeadStage, LeadDoc[]>);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // `over.id` is either a stage string (dropped on an empty column)
    // or a lead ID (dropped onto another card — same column or different)
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    let newStage: LeadStage;
    if (STAGES.includes(overId as LeadStage)) {
      newStage = overId as LeadStage;
    } else {
      // Dropped on a card — find that card's stage
      const targetLead = leads.find((l) => l.id === overId);
      if (!targetLead) return;
      newStage = targetLead.stage;
    }

    if (newStage === lead.stage) return; // No change

    try {
      await update<LeadDoc>('leads', leadId, { stage: newStage });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update lead stage');
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={byStage[stage]}
            onOpen={onOpen}
          />
        ))}
      </div>

      {/* Drag overlay — renders a snapshot of the dragged card */}
      <DragOverlay>
        {activeLead ? (
          <StaticLeadCard lead={activeLead} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
