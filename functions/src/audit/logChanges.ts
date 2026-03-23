/**
 * Audit Log — Firestore onWrite triggers
 *
 * Fires on every create / update / delete for key collections and writes an
 * immutable entry to /auditLog/{id}.  Uses the firebase-admin SDK so it
 * bypasses Firestore security rules.
 *
 * Captured collections: invoices, quotes, clients, projects, payments, leads
 */

import {
  onDocumentWritten,
  type FirestoreEvent,
  type DocumentSnapshot,
} from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

type Action = 'created' | 'updated' | 'deleted';

interface AuditEntry {
  collection: string;
  docId: string;
  action: Action;
  performedBy: string | null;
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: FieldValue;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPlain(snap: DocumentSnapshot | undefined): Record<string, unknown> | null {
  if (!snap?.exists) return null;
  const data = snap.data() ?? {};
  // Strip server-only fields that aren't serialisable cleanly
  const { createdAt: _c, updatedAt: _u, ...rest } = data as Record<string, unknown>;
  void _c; void _u;
  return rest;
}

function changedKeys(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before) return Object.keys(after ?? {});
  if (!after) return Object.keys(before);
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...allKeys].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

function derivePerformedBy(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string | null {
  // After an update/create, updatedBy / createdBy is the most reliable source
  return (
    (after?.updatedBy as string | null) ??
    (after?.createdBy as string | null) ??
    (before?.createdBy as string | null) ??
    null
  );
}

async function writeAuditLog(
  collectionName: string,
  docId: string,
  event: FirestoreEvent<{ before: DocumentSnapshot; after: DocumentSnapshot } | undefined>,
): Promise<void> {
  const change = event.data;
  if (!change) return;

  const { before: beforeSnap, after: afterSnap } = change;
  const beforeData = toPlain(beforeSnap);
  const afterData = toPlain(afterSnap);

  let action: Action;
  if (!beforeSnap.exists) {
    action = 'created';
  } else if (!afterSnap.exists) {
    action = 'deleted';
  } else {
    action = 'updated';
  }

  const entry: AuditEntry = {
    collection: collectionName,
    docId,
    action,
    performedBy: derivePerformedBy(beforeData, afterData),
    changedFields: changedKeys(beforeData, afterData),
    before: action === 'created' ? null : beforeData,
    after: action === 'deleted' ? null : afterData,
    timestamp: FieldValue.serverTimestamp(),
  };

  await db.collection('auditLog').add(entry);
}

// ─── Trigger factory ──────────────────────────────────────────────────────────

const OPTS = {
  region: 'europe-west4',
  memory: '256MiB' as const,
  // Only listen to africa-south1 database (default DB)
} as const;

// ─── Per-collection triggers ──────────────────────────────────────────────────

export const auditInvoices = onDocumentWritten(
  { ...OPTS, document: 'invoices/{docId}' },
  (event) => writeAuditLog('invoices', event.params.docId, event),
);

export const auditQuotes = onDocumentWritten(
  { ...OPTS, document: 'quotes/{docId}' },
  (event) => writeAuditLog('quotes', event.params.docId, event),
);

export const auditClients = onDocumentWritten(
  { ...OPTS, document: 'clients/{docId}' },
  (event) => writeAuditLog('clients', event.params.docId, event),
);

export const auditProjects = onDocumentWritten(
  { ...OPTS, document: 'projects/{docId}' },
  (event) => writeAuditLog('projects', event.params.docId, event),
);

export const auditPayments = onDocumentWritten(
  { ...OPTS, document: 'payments/{docId}' },
  (event) => writeAuditLog('payments', event.params.docId, event),
);

export const auditLeads = onDocumentWritten(
  { ...OPTS, document: 'leads/{docId}' },
  (event) => writeAuditLog('leads', event.params.docId, event),
);
