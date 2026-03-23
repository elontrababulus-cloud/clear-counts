import type { Timestamp } from 'firebase/firestore';

// ─── Shared primitives ────────────────────────────────────────────────────────

export type Role = 'admin' | 'staff' | 'client';

export type Currency = string; // e.g. 'USD', 'ZWG'

export interface Address {
  city: string;
  country: string;
}

// Utility: strip auto-generated server fields from create/update inputs
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt' | 'deletedAt'>>;

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /** Set only when role === 'client' — points to ClientDoc.id */
  clientId?: string;
  createdAt: Timestamp;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export type ClientStatus = 'active' | 'inactive' | 'prospect' | 'deleted';

export interface ClientDoc {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: Address;
  currency: Currency;
  status: ClientStatus;
  tags: string[];
  notes?: string;
  vatNumber?: string;
  website?: string;
  createdBy: string; // uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  deletedAt?: Timestamp;
}

// ─── Contacts (sub-collection: clients/{clientId}/contacts) ──────────────────

export interface ContactDoc {
  id: string;
  clientId: string;
  name: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type LeadStatus = 'active' | 'deleted';

export interface LeadDoc {
  id: string;
  title: string;
  /** Optional — set when lead is tied to an existing client */
  clientId?: string;
  clientName: string;
  value: number;
  currency: Currency;
  stage: LeadStage;
  source: string;
  assignedTo: string; // uid
  expectedCloseDate: Timestamp;
  status: LeadStatus;
  createdBy: string; // uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  deletedAt?: Timestamp;
}

// ─── Lead Activities (sub-collection: leads/{leadId}/activities) ──────────────

export type LeadActivityType = 'call' | 'email' | 'meeting' | 'note';

export interface LeadActivityDoc {
  id: string;
  leadId: string;
  type: LeadActivityType;
  description: string;
  performedBy: string; // uid
  createdAt: Timestamp;
}

// ─── Line Items (embedded in quotes & invoices) ───────────────────────────────

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  /** Computed: quantity * unitPrice * (1 + taxPercent / 100) */
  total: number;
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'deleted';

export type DiscountType = 'flat' | 'percent';

export interface QuoteDoc {
  id: string;
  quoteNumber: string; // e.g. "QT-0001"
  clientId: string;
  /** Firebase Auth UID of the client user — used for client-side access control */
  clientUid: string;
  clientName: string;
  clientEmail?: string;
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  discountType: DiscountType;
  taxTotal: number;
  total: number;
  currency: Currency;
  status: QuoteStatus;
  validUntil: Timestamp;
  notes?: string;
  terms?: string;
  pdfUrl?: string;
  createdBy: string; // uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  deletedAt?: Timestamp;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | 'draft'
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'deleted';

export interface InvoiceDoc {
  id: string;
  invoiceNumber: string; // e.g. "INV-0001"
  clientId: string;
  /** Firebase Auth UID of the client user */
  clientUid: string;
  clientName: string;
  clientEmail?: string;
  /** Set when invoice was converted from a quote */
  quoteId?: string;
  lineItems: LineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: Currency;
  status: InvoiceStatus;
  issueDate: Timestamp;
  dueDate: Timestamp;
  paidAt?: Timestamp;
  notes?: string;
  terms?: string;
  createdBy: string; // uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  deletedAt?: Timestamp;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export type PaymentMethod =
  | 'cash'
  | 'ecocash'
  | 'bank_transfer'
  | 'paypal'
  | 'zipit';

export interface PaymentDoc {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  /** Firebase Auth UID of the client user */
  clientUid: string;
  clientName: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  /** Bank reference, EcoCash transaction ID, etc. */
  reference?: string;
  date: Timestamp;
  recordedBy: string; // uid
  createdAt: Timestamp;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'deleted';

export interface ProjectDoc {
  id: string;
  name: string;
  clientId: string;
  /** Firebase Auth UID of the client user */
  clientUid: string;
  clientName: string;
  status: ProjectStatus;
  startDate: Timestamp;
  dueDate: Timestamp;
  budget: number;
  currency: Currency;
  members: string[]; // uids
  taskCount: number;
  completedTaskCount: number;
  description?: string;
  notes?: string;
  tags?: string[];
  createdBy: string; // uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  deletedAt?: Timestamp;
}

// ─── Tasks (sub-collection: projects/{projectId}/tasks) ───────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskDoc {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string; // uid
  dueDate?: Timestamp;
  /** Position within the Kanban column, used for drag-and-drop ordering */
  order: number;
  createdBy: string; // uid
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Task Comments (sub-collection: projects/{pid}/tasks/{tid}/comments) ─────

export interface CommentDoc {
  id: string;
  taskId: string;
  projectId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
}

// ─── Company Settings (singleton: settings/company) ──────────────────────────

export interface CompanySettings {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  defaultCurrency: Currency;
  defaultTaxPercent: number;
  invoicePrefix: string; // e.g. "INV"
  quotePrefix: string;   // e.g. "QT"
  invoiceCounter: number;
  quoteCounter: number;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'quote_accepted'
  | 'quote_declined'
  | 'task_assigned'
  | 'project_updated'
  | 'lead_updated'
  | 'general';

export interface NotificationDoc {
  id: string;
  userId: string; // uid — recipient
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: Timestamp;
}

// ─── Audit Log (append-only: auditLog/{logId}) ────────────────────────────────

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export';

export interface AuditLogDoc {
  id: string;
  action: AuditAction;
  collection: string;
  documentId: string;
  performedBy: string; // uid
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: Timestamp;
}
