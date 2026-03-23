'use client';

import { useState } from 'react';
import { Mail, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SendEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId: string;
  docType: 'invoice' | 'quote';
  docNumber: string;
  /** Pre-fill from the client record */
  defaultEmail?: string;
  defaultName?: string;
}

export function SendEmailModal({
  open,
  onOpenChange,
  docId,
  docType,
  docNumber,
  defaultEmail = '',
  defaultName = '',
}: SendEmailModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Recipient email is required');
      return;
    }

    setSending(true);
    try {
      const functions = getFunctions(app, 'europe-west4');
      const sendEmail = httpsCallable(functions, 'sendDocumentEmail');
      await sendEmail({
        docId,
        docType,
        recipientEmail: email.trim(),
        recipientName: name.trim() || email.trim(),
      });
      toast.success(`${docType === 'invoice' ? 'Invoice' : 'Quote'} ${docNumber} sent to ${email}`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send email';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">
                Send {docType === 'invoice' ? 'Invoice' : 'Quote'} by Email
              </h2>
              <p className="text-xs text-muted-foreground">{docNumber}</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rec-email">Recipient Email *</Label>
            <Input
              id="rec-email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-name">Recipient Name</Label>
            <Input
              id="rec-name"
              type="text"
              placeholder="John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          A professionally formatted email will be sent with all{' '}
          {docType === 'invoice' ? 'invoice' : 'quote'} details, line items, and totals.
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
