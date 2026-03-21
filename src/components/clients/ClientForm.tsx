'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { create, update } from '@/lib/firestore/helpers';
import type { ClientDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const CITIES = ['Harare', 'Bulawayo', 'Beitbridge', 'Other'] as const;
const CURRENCIES = ['USD', 'ZWG', 'ZWL'] as const;

// Shared class for native <select> elements — matches Input visual style
const SELECT_CLS = cn(
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string(),
  addressCity: z.string().min(1, 'City is required'),
  addressCountry: z.string().min(1, 'Country is required'),
  currency: z.string().min(1, 'Currency is required'),
  status: z.enum(['active', 'inactive', 'prospect']),
  tagsInput: z.string(),
  notes: z.string(),
  vatNumber: z.string(),
  website: z.string(),
});

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  addressCity: 'Harare',
  addressCountry: 'Zimbabwe',
  currency: 'USD',
  status: 'active',
  tagsInput: '',
  notes: '',
  vatNumber: '',
  website: '',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Populate for edit mode; omit for create mode */
  client?: ClientDoc | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientForm({ open, onOpenChange, client }: ClientFormProps) {
  const { user } = useAuth();
  const isEdit = !!client;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  // Sync form when dialog opens (edit → populate, create → clear)
  useEffect(() => {
    if (!open) return;
    if (client) {
      reset({
        companyName: client.companyName,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone ?? '',
        addressCity: client.address.city,
        addressCountry: client.address.country,
        currency: client.currency,
        status: (client.status as 'active' | 'inactive' | 'prospect') ?? 'active',
        tagsInput: client.tags?.join(', ') ?? '',
        notes: client.notes ?? '',
        vatNumber: client.vatNumber ?? '',
        website: client.website ?? '',
      });
    } else {
      reset(DEFAULT_VALUES);
    }
  }, [open, client, reset]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    try {
      const payload: Omit<ClientDoc, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
        companyName: data.companyName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        address: { city: data.addressCity, country: data.addressCountry },
        currency: data.currency,
        status: data.status,
        tags: data.tagsInput
          ? data.tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        notes: data.notes,
        vatNumber: data.vatNumber,
        website: data.website,
        createdBy: user.uid,
      };

      if (isEdit && client) {
        await update<ClientDoc>('clients', client.id, payload);
        toast.success('Client updated');
      } else {
        await create<ClientDoc>('clients', payload);
        toast.success('Client added');
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save client. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Company Name + Contact Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                placeholder="Acme Corp"
                {...register('companyName')}
                aria-invalid={!!errors.companyName}
              />
              {errors.companyName && (
                <p className="text-xs text-red-600">{errors.companyName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Contact Name *</Label>
              <Input
                id="contactName"
                placeholder="John Doe"
                {...register('contactName')}
                aria-invalid={!!errors.contactName}
              />
              {errors.contactName && (
                <p className="text-xs text-red-600">{errors.contactName.message}</p>
              )}
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@company.com"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+263 77 000 0000"
                {...register('phone')}
              />
            </div>
          </div>

          {/* City + Country */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="addressCity">City</Label>
              <select id="addressCity" {...register('addressCity')} className={SELECT_CLS}>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addressCountry">Country</Label>
              <Input id="addressCountry" placeholder="Zimbabwe" {...register('addressCountry')} />
            </div>
          </div>

          {/* Currency + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" {...register('currency')} className={SELECT_CLS}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select id="status" {...register('status')} className={SELECT_CLS}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
          </div>

          {/* VAT Number + Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vatNumber">VAT Number</Label>
              <Input id="vatNumber" placeholder="VAT123456" {...register('vatNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://company.com"
                {...register('website')}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="tagsInput">
              Tags{' '}
              <span className="text-xs text-gray-400 font-normal">comma separated</span>
            </Label>
            <Input
              id="tagsInput"
              placeholder="VIP, Retail, Partner"
              {...register('tagsInput')}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Internal notes about this client…"
              {...register('notes')}
              className={cn(
                'flex w-full rounded-lg border border-input bg-transparent px-3 py-2',
                'text-sm outline-none transition-colors resize-none',
                'focus:border-ring focus:ring-3 focus:ring-ring/50',
                'placeholder:text-muted-foreground',
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-700 hover:bg-blue-800 text-white border-transparent"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
