/**
 * ClearCounts CRM — Firebase Cloud Functions entry point
 *
 * Initialize firebase-admin once here, then re-export all functions.
 * Each module imports getFirestore() lazily — the admin app is already
 * initialized by the time any module-level code runs.
 */

import { initializeApp } from 'firebase-admin/app';

// Initialize the Firebase Admin SDK (uses Application Default Credentials
// in production; uses the emulator when FIREBASE_EMULATOR_HOST is set).
initializeApp();

// ── Invoices ──────────────────────────────────────────────────────────────────
export { checkOverdue } from './invoices/checkOverdue';
