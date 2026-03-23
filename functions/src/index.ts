/**
 * ClearCounts CRM — Firebase Cloud Functions entry point
 *
 * Initialize firebase-admin once here, then re-export all functions.
 * Each module imports getFirestore() lazily — the admin app is already
 * initialized by the time any module-level code runs.
 */

import { initializeApp } from 'firebase-admin/app';

initializeApp();

// ── Invoices ──────────────────────────────────────────────────────────────────
export { checkOverdue } from './invoices/checkOverdue';

// ── Audit Log — onWrite triggers for key collections ─────────────────────────
export {
  auditInvoices,
  auditQuotes,
  auditClients,
  auditProjects,
  auditPayments,
  auditLeads,
} from './audit/logChanges';

// ── Email delivery ────────────────────────────────────────────────────────────
export { sendDocumentEmail } from './email/sendDocumentEmail';
