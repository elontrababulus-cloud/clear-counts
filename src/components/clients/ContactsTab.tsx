'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Plus, Star, Trash2, Phone, Mail, UserRound } from 'lucide-react';
import { db } from '@/lib/firebase';
import { create, subscribeToCollection } from '@/lib/firestore/helpers';
import type { ContactDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  title: z.string(),
  email: z.string().email('Enter a valid email').or(z.literal('')),
  phone: z.string(),
  isPrimary: z.boolean(),
});

type FormData = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContactsTabProps {
  clientId: string;
}

// ─── Inline add-contact form ──────────────────────────────────────────────────

function AddContactForm({
  clientId,
  onSuccess,
  onCancel,
}: {
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', title: '', email: '', phone: '', isPrimary: false },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await create<ContactDoc>(`clients/${clientId}/contacts`, {
        clientId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        isPrimary: data.isPrimary,
      } as Omit<ContactDoc, 'id' | 'createdAt' | 'updatedAt'>);
      toast.success('Contact added');
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add contact');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3"
    >
      <p className="text-sm font-medium text-gray-900">New Contact</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="c-name">Name *</Label>
          <Input id="c-name" placeholder="Jane Smith" {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-title">Title / Role</Label>
          <Input id="c-title" placeholder="CEO" {...register('title')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" type="email" placeholder="jane@company.com" {...register('email')} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-phone">Phone</Label>
          <Input id="c-phone" type="tel" placeholder="+263 77 000 0000" {...register('phone')} />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          {...register('isPrimary')}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Primary contact</span>
      </label>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          className="bg-blue-700 hover:bg-blue-800 text-white border-transparent"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : 'Add Contact'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContactsTab({ clientId }: ContactsTabProps) {
  const { role } = useAuth();
  const [contacts, setContacts] = useState<ContactDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection<ContactDoc>(
      `clients/${clientId}/contacts`,
      [],
      (data) => {
        // Sort: primary first, then by name
        const sorted = [...data].sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.name.localeCompare(b.name);
        });
        setContacts(sorted);
        setLoading(false);
      },
    );
    return unsub;
  }, [clientId]);

  const handleDelete = async (contact: ContactDoc) => {
    if (!confirm(`Delete contact "${contact.name}"?`)) return;
    try {
      await deleteDoc(doc(db, `clients/${clientId}/contacts/${contact.id}`));
      toast.success('Contact deleted');
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl">
            <Skeleton className="w-9 h-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </p>
        <Button
          size="sm"
          className="bg-blue-700 hover:bg-blue-800 text-white border-transparent gap-1.5"
          onClick={() => setShowForm(true)}
        >
          <Plus size={14} />
          Add Contact
        </Button>
      </div>

      {/* Inline form */}
      {showForm && (
        <AddContactForm
          clientId={clientId}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Contact cards */}
      {contacts.length === 0 && !showForm ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <UserRound size={18} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No contacts yet</p>
          <p className="text-xs text-gray-400 mt-0.5">Click "Add Contact" to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-xl group"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0 select-none">
                {contact.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{contact.name}</span>
                  {contact.isPrimary && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 border gap-1">
                      <Star size={10} className="fill-blue-500 text-blue-500" />
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <Mail size={11} />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <Phone size={11} />
                      {contact.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Delete — admin only */}
              {role === 'admin' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                  onClick={() => handleDelete(contact)}
                  title="Delete contact"
                >
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
