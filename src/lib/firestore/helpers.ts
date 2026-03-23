/**
 * Firestore CRUD helpers
 *
 * All helpers work with both top-level collections ("invoices") and
 * sub-collections ("projects/abc/tasks") — just pass the full slash-separated
 * collection path.
 *
 * Soft-delete convention: callers must exclude status:'deleted' docs from
 * queries by passing `where('status', '!=', 'deleted')` in constraints.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  runTransaction,
  type QueryConstraint,
  type DocumentSnapshot,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { InvoiceDoc, InvoiceStatus, PaymentDoc, CompanySettings } from '@/types';

/** Current authenticated user's UID, or null when called outside auth context */
function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

// ─── Internal path utilities ──────────────────────────────────────────────────

/**
 * Build a CollectionReference from a slash-separated path.
 * e.g. "clients" | "projects/abc123/tasks"
 */
function colRef(path: string) {
  const segs = path.split('/').filter(Boolean);
  // Must be odd number of segments (collection, not document)
  const [first, ...rest] = segs;
  return rest.length === 0
    ? collection(db, first)
    : collection(db, first, ...rest);
}

/**
 * Build a DocumentReference from a collection path + document ID.
 */
function docRef(collectionPath: string, id: string) {
  const segs = collectionPath.split('/').filter(Boolean);
  const [first, ...rest] = segs;
  return rest.length === 0
    ? doc(db, first, id)
    : doc(db, first, ...rest, id);
}

// ─── Pagination types ─────────────────────────────────────────────────────────

export interface GetAllOptions {
  constraints?: QueryConstraint[];
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot | null;
}

export interface PaginatedResult<T> {
  data: T[];
  /** Pass this to the next call as `startAfterDoc` for the next page */
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

// ─── Generic CRUD ─────────────────────────────────────────────────────────────

/**
 * Fetch a single document by ID.
 * Returns `null` if the document does not exist.
 */
export async function getById<T>(
  collectionPath: string,
  id: string,
): Promise<T | null> {
  const snap = await getDoc(docRef(collectionPath, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

/**
 * Fetch a paginated list of documents.
 *
 * @example
 * const { data, lastDoc, hasMore } = await getAll<InvoiceDoc>('invoices', {
 *   constraints: [where('status', '!=', 'deleted'), orderBy('createdAt', 'desc')],
 *   pageSize: 20,
 *   startAfterDoc: previousLastDoc,
 * });
 */
export async function getAll<T>(
  collectionPath: string,
  options: GetAllOptions = {},
): Promise<PaginatedResult<T>> {
  const { constraints = [], pageSize = 20, startAfterDoc: cursorDoc } = options;

  const queryConstraints: QueryConstraint[] = [...constraints];
  if (cursorDoc) queryConstraints.push(startAfter(cursorDoc));
  // Fetch one extra to determine whether there's a next page
  queryConstraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(colRef(collectionPath), ...queryConstraints));

  const hasMore = snap.docs.length > pageSize;
  const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
  const data = pageDocs.map((d) => ({ id: d.id, ...d.data() } as T));

  return { data, lastDoc, hasMore };
}

/**
 * Subscribe to a real-time collection query.
 * Returns the Firestore `Unsubscribe` function — call it on component unmount.
 *
 * @example
 * const unsub = subscribeToCollection<ClientDoc>(
 *   'clients',
 *   [where('status', '!=', 'deleted'), orderBy('companyName')],
 *   (clients) => setClients(clients),
 * );
 */
export function subscribeToCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[],
  callback: (data: T[]) => void,
): Unsubscribe {
  const q = query(colRef(collectionPath), ...constraints);
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
    callback(data);
  });
}

/**
 * Subscribe to a single document in real-time.
 * Calls `callback(null)` if the document is deleted or does not exist.
 */
export function subscribeToDoc<T>(
  collectionPath: string,
  id: string,
  callback: (data: T | null) => void,
): Unsubscribe {
  return onSnapshot(docRef(collectionPath, id), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as T);
    } else {
      callback(null);
    }
  });
}

/**
 * Create a new document with an auto-generated ID.
 * Automatically injects `createdAt` and `updatedAt` server timestamps.
 * Returns the new document ID.
 */
export async function create<T>(
  collectionPath: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const uid = currentUid();
  const payload: DocumentData = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // Only inject if not already provided by the caller
    ...(!('createdBy' in (data as object)) && uid ? { createdBy: uid } : {}),
    updatedBy: uid,
  };
  const ref = await addDoc(colRef(collectionPath), payload);
  return ref.id;
}

/**
 * Create a document with a specific ID (e.g. for the settings singleton).
 * Automatically injects `createdAt` and `updatedAt` server timestamps.
 */
export async function createWithId<T>(
  collectionPath: string,
  id: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const payload: DocumentData = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(docRef(collectionPath, id), payload);
}

/**
 * Partial-update a document.
 * Automatically updates `updatedAt` server timestamp.
 */
export async function update<T>(
  collectionPath: string,
  id: string,
  data: Partial<Omit<T, 'id' | 'createdAt'>>,
): Promise<void> {
  const payload: DocumentData = {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: currentUid(),
  };
  await updateDoc(docRef(collectionPath, id), payload);
}

/**
 * Soft-delete a document by setting `status: 'deleted'` and `deletedAt`.
 * The document is NOT removed from Firestore — it must be excluded in queries.
 */
export async function softDelete(
  collectionPath: string,
  id: string,
): Promise<void> {
  await updateDoc(docRef(collectionPath, id), {
    status: 'deleted',
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUid(),
  });
}

// ─── Finance helpers ──────────────────────────────────────────────────────────

/**
 * Atomically convert a quote into an invoice.
 * Creates the invoice document and returns the new invoice ID.
 * Both operations are committed in a single batch write.
 */
export async function convertQuoteToInvoice(
  quoteId: string,
  invoiceData: Omit<InvoiceDoc, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const batch = writeBatch(db);

  // New invoice ref with auto-generated ID
  const invoiceRef = doc(colRef('invoices'));
  batch.set(invoiceRef, {
    ...invoiceData,
    quoteId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Mark the source quote with the resulting invoice ID
  batch.update(docRef('quotes', quoteId), {
    invoiceId: invoiceRef.id,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return invoiceRef.id;
}

/**
 * Atomically record a payment against an invoice.
 *
 * - Creates a new PaymentDoc
 * - Updates invoice: amountPaid, amountDue, status (and paidAt when fully paid)
 *
 * Returns the new payment ID.
 */
export async function recordPayment(
  invoiceId: string,
  paymentData: Omit<PaymentDoc, 'id' | 'createdAt'>,
  newStatus: InvoiceStatus,
  amountPaid: number,
  amountDue: number,
): Promise<string> {
  const batch = writeBatch(db);

  // Create payment
  const paymentRef = doc(colRef('payments'));
  batch.set(paymentRef, {
    ...paymentData,
    createdAt: serverTimestamp(),
  });

  // Update invoice
  const invoiceUpdate: DocumentData = {
    amountPaid,
    amountDue,
    status: newStatus,
    updatedAt: serverTimestamp(),
  };
  if (newStatus === 'paid') {
    invoiceUpdate.paidAt = serverTimestamp();
  }
  batch.update(docRef('invoices', invoiceId), invoiceUpdate);

  await batch.commit();
  return paymentRef.id;
}

// ─── Counter helpers ──────────────────────────────────────────────────────────

/**
 * Atomically increment and return the next counter value from the
 * `settings/company` singleton document.
 *
 * Used to generate sequential invoice and quote numbers.
 */
export async function getNextCounter(
  field: 'invoiceCounter' | 'quoteCounter',
): Promise<number> {
  const settingsRef = docRef('settings', 'company');

  return runTransaction(db, async (txn) => {
    const snap = await txn.get(settingsRef);
    const current = snap.exists()
      ? ((snap.data() as CompanySettings)[field] ?? 0)
      : 0;
    const next = current + 1;
    // setDoc with merge so the doc is created if it doesn't exist yet
    txn.set(settingsRef, { [field]: next } as Partial<CompanySettings>, {
      merge: true,
    });
    return next;
  });
}

/**
 * Format an invoice number from a counter value.
 * @example formatInvoiceNumber(1)  // "INV-0001"
 */
export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(4, '0')}`;
}

/**
 * Format a quote number from a counter value.
 * @example formatQuoteNumber(1)  // "QT-0001"
 */
export function formatQuoteNumber(n: number): string {
  return `QT-${String(n).padStart(4, '0')}`;
}
