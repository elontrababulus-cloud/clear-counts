'use client';

import { Mail, Phone, MapPin, Pencil, Globe, Hash } from 'lucide-react';
import type { ClientDoc } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Status badge colors (matches ClientsTable) ───────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-blue-100 text-blue-700 border-blue-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  prospect: 'bg-amber-100 text-amber-700 border-amber-200',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClientCardProps {
  client: ClientDoc;
  onEdit: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientCard({ client, onEdit }: ClientCardProps) {
  const initials = client.companyName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold select-none flex-shrink-0">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Name + status */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">{client.companyName}</h1>
            <Badge
              className={cn(
                'capitalize border font-medium',
                STATUS_STYLES[client.status] ?? 'bg-gray-100 text-gray-500',
              )}
            >
              {client.status}
            </Badge>
          </div>

          <p className="text-sm text-gray-500">{client.contactName}</p>

          {/* Contact details */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            <a
              href={`mailto:${client.email}`}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Mail size={13} className="flex-shrink-0" />
              {client.email}
            </a>
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Phone size={13} className="flex-shrink-0" />
                {client.phone}
              </a>
            )}
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin size={13} className="flex-shrink-0" />
              {client.address.city}, {client.address.country}
            </span>
            {client.website && (
              <a
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Globe size={13} className="flex-shrink-0" />
                {client.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {client.vatNumber && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <Hash size={13} className="flex-shrink-0" />
                {client.vatNumber}
              </span>
            )}
          </div>

          {/* Tags */}
          {client.tags && client.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {client.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Edit button */}
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 self-start"
          onClick={onEdit}
        >
          <Pencil size={13} className="mr-1.5" />
          Edit
        </Button>
      </div>
    </div>
  );
}
