/**
 * checkOverdue — Scheduled Cloud Function
 *
 * Runs every day at 06:00 Zimbabwe time (Africa/Harare = UTC+2).
 * Queries all invoices with status 'unpaid' or 'partial' where dueDate < now,
 * batch-updates them to 'overdue', and creates a notification for each.
 *
 * Deploy: firebase deploy --only functions:checkOverdue
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

// ─── Firestore helper ─────────────────────────────────────────────────────────

const db = getFirestore();

// ─── Types (mirrored from src/types — no cross-package import in functions) ───

interface InvoiceDoc {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  total: number;
  amountDue: number;
  currency: string;
  status: string;
  dueDate: Timestamp;
  assignedTo?: string;
  createdBy: string;
}

// ─── Scheduled function ───────────────────────────────────────────────────────

export const checkOverdue = onSchedule(
  {
    // "0 6 * * *" = 06:00 every day
    schedule: '0 6 * * *',
    timeZone: 'Africa/Harare',
    memory: '256MiB',
    region: 'europe-west4',
  },
  async () => {
    const now = Timestamp.now();

    // Query invoices that are unpaid/partial and past due
    const snap = await db
      .collection('invoices')
      .where('status', 'in', ['unpaid', 'partial'])
      .where('dueDate', '<', now)
      .get();

    if (snap.empty) {
      console.log('checkOverdue: no overdue invoices found');
      return;
    }

    console.log(`checkOverdue: marking ${snap.size} invoice(s) as overdue`);

    // Process in batches of 500 (Firestore write limit per batch)
    const BATCH_SIZE = 500;
    const docs = snap.docs as FirebaseFirestore.QueryDocumentSnapshot[];

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);

      for (const docSnap of chunk) {
        const invoice = { id: docSnap.id, ...docSnap.data() } as InvoiceDoc;

        // Update invoice status
        batch.update(docSnap.ref, {
          status: 'overdue',
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Create notification for the staff member who owns the invoice
        const recipientUid = invoice.assignedTo ?? invoice.createdBy;
        if (recipientUid) {
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            userId: recipientUid,
            type: 'invoice_overdue',
            title: 'Invoice Overdue',
            body: `${invoice.invoiceNumber} for ${invoice.clientName} is overdue — ${invoice.currency} ${invoice.amountDue.toFixed(2)} outstanding.`,
            link: `/invoices/${invoice.id}`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      await batch.commit();
      console.log(`checkOverdue: committed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }

    console.log('checkOverdue: done');
  },
);
