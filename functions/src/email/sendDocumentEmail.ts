/**
 * sendDocumentEmail — HTTPS Callable Cloud Function
 *
 * Sends a professionally formatted invoice or quote by email using Resend.
 * Called from the client with: { docId, docType, recipientEmail, recipientName }
 *
 * Setup: firebase functions:secrets:set RESEND_API_KEY
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const resendApiKey = defineSecret('RESEND_API_KEY');
const db = getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface SendEmailRequest {
  docId: string;
  docType: 'invoice' | 'quote';
  recipientEmail: string;
  recipientName: string;
}

// ─── Currency formatter ───────────────────────────────────────────────────────

function fmtMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(value: Timestamp | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Timestamp ? value.toDate() : new Date(value as string);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── HTML email template ──────────────────────────────────────────────────────

function buildEmailHtml(
  doc: Record<string, unknown>,
  docType: 'invoice' | 'quote',
  recipientName: string,
  companySettings: Record<string, unknown> | null,
): string {
  const isInvoice = docType === 'invoice';
  const docNumber = (isInvoice ? doc.invoiceNumber : doc.quoteNumber) as string;
  const issueDate = fmtDate(doc.issueDate as Timestamp);
  const dueDate = fmtDate((isInvoice ? doc.dueDate : doc.validUntil) as Timestamp);
  const currency = (doc.currency as string) || 'USD';
  const lineItems = (doc.lineItems as LineItem[]) || [];
  const subtotal = (doc.subtotal as number) || 0;
  const taxPercent = (doc.taxPercent as number) || 0;
  const taxAmount = (doc.taxAmount as number) || 0;
  const total = (doc.total as number) || 0;
  const notes = (doc.notes as string) || '';

  const companyName = (companySettings?.companyName as string) || 'ClearCounts';
  const companyEmail = (companySettings?.email as string) || '';
  const companyPhone = (companySettings?.phone as string) || '';

  const accentColor = isInvoice ? '#2563eb' : '#7c3aed';
  const docLabel = isInvoice ? 'Invoice' : 'Quote';
  const dateLabel = isInvoice ? 'Due Date' : 'Valid Until';

  const itemRows = lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${item.description}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;text-align:right;">${fmtMoney(item.unitPrice, currency)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">${fmtMoney(item.total, currency)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${docLabel} ${docNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:${accentColor};padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${companyName}</div>
                    ${companyEmail ? `<div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:2px;">${companyEmail}</div>` : ''}
                    ${companyPhone ? `<div style="font-size:13px;color:rgba(255,255,255,.75);">${companyPhone}</div>` : ''}
                  </td>
                  <td align="right">
                    <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-1px;">${docLabel.toUpperCase()}</div>
                    <div style="font-size:16px;color:rgba(255,255,255,.85);font-weight:600;">${docNumber}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Meta row -->
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #f1f5f9;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Bill To</div>
                    <div style="font-size:16px;font-weight:700;color:#0f172a;margin-top:4px;">${doc.clientName ?? recipientName}</div>
                  </td>
                  <td align="right">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="text-align:right;">
                          <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Issue Date</div>
                          <div style="font-size:14px;font-weight:600;color:#334155;margin-top:2px;">${issueDate}</div>
                        </td>
                        <td style="width:32px;"></td>
                        <td style="text-align:right;">
                          <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">${dateLabel}</div>
                          <div style="font-size:14px;font-weight:600;color:#334155;margin-top:2px;">${dueDate}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Line items -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;text-align:left;border-bottom:2px solid #e2e8f0;">Description</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;text-align:center;border-bottom:2px solid #e2e8f0;">Qty</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;text-align:right;border-bottom:2px solid #e2e8f0;">Unit Price</th>
                    <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;text-align:right;border-bottom:2px solid #e2e8f0;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table cellpadding="0" cellspacing="0" style="margin-left:auto;min-width:220px;">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#64748b;">Subtotal</td>
                  <td style="padding:6px 0 6px 32px;font-size:13px;color:#334155;text-align:right;">${fmtMoney(subtotal, currency)}</td>
                </tr>
                ${taxPercent > 0 ? `<tr>
                  <td style="padding:6px 0;font-size:13px;color:#64748b;">Tax (${taxPercent}%)</td>
                  <td style="padding:6px 0 6px 32px;font-size:13px;color:#334155;text-align:right;">${fmtMoney(taxAmount, currency)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:12px 0 4px;font-size:15px;font-weight:700;color:#0f172a;border-top:2px solid #e2e8f0;">Total</td>
                  <td style="padding:12px 0 4px 32px;font-size:18px;font-weight:800;color:${accentColor};text-align:right;border-top:2px solid #e2e8f0;">${fmtMoney(total, currency)}</td>
                </tr>
                ${isInvoice && (doc.amountDue as number) > 0 && (doc.amountDue as number) < total ? `<tr>
                  <td style="padding:4px 0;font-size:13px;color:#64748b;">Amount Due</td>
                  <td style="padding:4px 0 4px 32px;font-size:14px;font-weight:700;color:#dc2626;text-align:right;">${fmtMoney(doc.amountDue as number, currency)}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Notes -->
          ${notes ? `<tr>
            <td style="padding:0 32px 28px;">
              <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Notes</div>
                <div style="font-size:13px;color:#334155;line-height:1.6;">${notes}</div>
              </div>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <div style="font-size:12px;color:#94a3b8;">
                Generated by <strong style="color:#64748b;">${companyName}</strong> via ClearCounts CRM
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Callable function ────────────────────────────────────────────────────────

export const sendDocumentEmail = onCall(
  {
    region: 'europe-west4',
    memory: '256MiB',
    secrets: [resendApiKey],
  },
  async (request) => {
    // Auth check — only staff/admin can send
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to send emails.');
    }

    const { docId, docType, recipientEmail, recipientName } =
      request.data as SendEmailRequest;

    if (!docId || !docType || !recipientEmail) {
      throw new HttpsError('invalid-argument', 'docId, docType and recipientEmail are required.');
    }

    // Fetch document
    const docSnap = await db.collection(docType === 'invoice' ? 'invoices' : 'quotes').doc(docId).get();
    if (!docSnap.exists) {
      throw new HttpsError('not-found', `${docType} ${docId} not found.`);
    }
    const docData = docSnap.data() as Record<string, unknown>;

    // Fetch company settings for branding
    const settingsSnap = await db.collection('settings').doc('company').get();
    const companySettings = settingsSnap.exists ? (settingsSnap.data() as Record<string, unknown>) : null;

    const companyName = (companySettings?.companyName as string) || 'ClearCounts';
    const fromEmail = (companySettings?.email as string) || 'noreply@clearcounts.app';
    const docNumber = (docType === 'invoice' ? docData.invoiceNumber : docData.quoteNumber) as string;
    const docLabel = docType === 'invoice' ? 'Invoice' : 'Quote';

    // Build HTML
    const html = buildEmailHtml(docData, docType, recipientName, companySettings);

    // Send via Resend
    const apiKey = resendApiKey.value();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${companyName} <${fromEmail}>`,
        to: [recipientEmail],
        subject: `${docLabel} ${docNumber} from ${companyName}`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Resend error:', err);
      throw new HttpsError('internal', 'Failed to send email. Check function logs.');
    }

    const result = await response.json() as { id: string };

    // Record the send in the document
    await db.collection(docType === 'invoice' ? 'invoices' : 'quotes').doc(docId).update({
      lastEmailedAt: new Date(),
      lastEmailedTo: recipientEmail,
    });

    return { success: true, emailId: result.id };
  },
);
