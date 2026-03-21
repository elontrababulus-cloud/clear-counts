'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreHorizontal, Eye, Pencil, Trash2, Users } from 'lucide-react';
import { softDelete } from '@/lib/firestore/helpers';
import type { ClientDoc } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-blue-100 text-blue-700 border-blue-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  prospect: 'bg-amber-100 text-amber-700 border-amber-200',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        'capitalize border font-medium',
        STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500',
      )}
    >
      {status}
    </Badge>
  );
}

// ─── Currency formatter ───────────────────────────────────────────────────────

function formatBalance(amount: number, currency: string): string {
  if (amount === 0) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClientsTableProps {
  clients: ClientDoc[];
  balances: Record<string, number>;
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (client: ClientDoc) => void;
  onDeleted: () => void;
  isAdmin: boolean;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 8 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={8}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Users size={22} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">No clients yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Add your first client using the button above.
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Row actions menu ─────────────────────────────────────────────────────────

interface RowActionsProps {
  client: ClientDoc;
  isAdmin: boolean;
  onEdit: () => void;
  onView: () => void;
  onDeleted: () => void;
}

function RowActions({ client, isAdmin, onEdit, onView, onDeleted }: RowActionsProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${client.companyName}"? This cannot be undone.`)) return;
    try {
      await softDelete('clients', client.id);
      toast.success('Client deleted');
      onDeleted();
    } catch {
      toast.error('Failed to delete client');
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => { e.stopPropagation(); onView(); }}
        title="View client"
      >
        <Eye size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        title="Edit client"
      >
        <Pencil size={14} />
      </Button>
      {isAdmin && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={handleDelete}
          title="Delete client"
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClientsTable({
  clients,
  balances,
  loading,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDeleted,
  isAdmin,
}: ClientsTableProps) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="pl-4">Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>City</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeleton />
          ) : clients.length === 0 ? (
            <EmptyState />
          ) : (
            clients.map((client) => (
              <TableRow
                key={client.id}
                className="group/row cursor-pointer hover:bg-blue-50/40"
                onClick={() => router.push(`/clients/${client.id}`)}
              >
                {/* Company */}
                <TableCell className="pl-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0 select-none">
                      {client.companyName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900 truncate max-w-[140px]">
                      {client.companyName}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="text-gray-600 truncate max-w-[120px]">
                  {client.contactName}
                </TableCell>

                <TableCell className="text-gray-600 truncate max-w-[160px]">
                  <a
                    href={`mailto:${client.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {client.email}
                  </a>
                </TableCell>

                <TableCell className="text-gray-600">
                  {client.phone || '—'}
                </TableCell>

                <TableCell className="text-gray-600">
                  {client.address.city}
                </TableCell>

                {/* Outstanding balance */}
                <TableCell className="text-right font-medium">
                  <span
                    className={cn(
                      (balances[client.id] ?? 0) > 0
                        ? 'text-amber-600'
                        : 'text-gray-400',
                    )}
                  >
                    {formatBalance(balances[client.id] ?? 0, client.currency)}
                  </span>
                </TableCell>

                <TableCell>
                  <StatusBadge status={client.status} />
                </TableCell>

                <TableCell className="pr-2">
                  <RowActions
                    client={client}
                    isAdmin={isAdmin}
                    onEdit={() => onEdit(client)}
                    onView={() => router.push(`/clients/${client.id}`)}
                    onDeleted={onDeleted}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
