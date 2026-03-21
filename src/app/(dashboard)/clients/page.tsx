'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { Plus, Search } from 'lucide-react';
import { db } from '@/lib/firebase';
import { subscribeToCollection } from '@/lib/firestore/helpers';
import type { ClientDoc, InvoiceDoc } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClientForm } from '@/components/clients/ClientForm';
import { ClientsTable } from '@/components/clients/ClientsTable';

const PAGE_SIZE = 25;
const CITIES = ['Harare', 'Bulawayo', 'Beitbridge'];

// ─── Outstanding-balance helper ───────────────────────────────────────────────

async function fetchBalances(clientIds: string[]): Promise<Record<string, number>> {
  if (clientIds.length === 0) return {};
  const result: Record<string, number> = {};

  // Firestore 'in' supports up to 30 values — chunk as needed
  const chunkSize = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    chunks.push(clientIds.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(
        collection(db, 'invoices'),
        where('clientId', 'in', chunk),
        where('status', 'in', ['unpaid', 'partial', 'overdue']),
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const inv = d.data() as InvoiceDoc;
        result[inv.clientId] = (result[inv.clientId] ?? 0) + inv.amountDue;
      });
    }),
  );

  return result;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { role } = useAuth();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<ClientDoc[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [page, setPage] = useState(0);

  // ── Form dialog ─────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDoc | null>(null);

  // ── Real-time subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToCollection<ClientDoc>(
      'clients',
      [
        where('status', 'in', ['active', 'inactive', 'prospect']),
        orderBy('companyName', 'asc'),
      ],
      (data) => {
        setClients(data);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // ── Fetch outstanding balances whenever client list changes ─────────────────
  useEffect(() => {
    if (clients.length === 0) {
      setBalances({});
      return;
    }
    fetchBalances(clients.map((c) => c.id)).then(setBalances);
  }, [clients]);

  // ── Client-side filtering ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clients.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (cityFilter !== 'all' && c.address.city !== cityFilter) return false;
      if (q) {
        return (
          c.companyName.toLowerCase().includes(q) ||
          c.contactName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [clients, search, statusFilter, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to page 0 when filters change
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };

  const openCreate = () => { setEditingClient(null); setFormOpen(true); };
  const openEdit = (client: ClientDoc) => { setEditingClient(client); setFormOpen(true); };

  const SELECT_CLS =
    'h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50';

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '…' : `${filtered.length} client${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-blue-700 hover:bg-blue-800 text-white border-transparent gap-1.5"
        >
          <Plus size={15} />
          Add Client
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => handleFilterChange(setSearch, e.target.value)}
            className="pl-8 h-8"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
          className={SELECT_CLS}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="prospect">Prospect</option>
        </select>

        {/* City filter */}
        <select
          value={cityFilter}
          onChange={(e) => handleFilterChange(setCityFilter, e.target.value)}
          className={SELECT_CLS}
        >
          <option value="all">All Cities</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <ClientsTable
        clients={paginated}
        balances={balances}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={openEdit}
        onDeleted={() => { /* real-time subscription auto-updates */ }}
        isAdmin={role === 'admin'}
      />

      {/* Create / Edit dialog */}
      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editingClient}
      />
    </>
  );
}
