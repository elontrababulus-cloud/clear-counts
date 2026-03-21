'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDocs, query, collection, where, orderBy, limit } from 'firebase/firestore';
import { Search, Users, Receipt, Briefcase, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { ClientDoc, InvoiceDoc, ProjectDoc } from '@/types';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'client' | 'invoice' | 'project';
  label: string;
  sub: string;
  href: string;
}

// ─── Firestore prefix query helper ───────────────────────────────────────────

async function prefixQuery<T>(
  collectionName: string,
  field: string,
  q: string,
  lim: number,
): Promise<T[]> {
  const end = q + '\uf8ff';
  const snap = await getDocs(
    query(
      collection(db, collectionName),
      where(field, '>=', q),
      where(field, '<=', end),
      limit(lim),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query_, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const [clientsByCompany, invoices, projects] = await Promise.all([
        prefixQuery<ClientDoc>('clients', 'companyName', q, 5),
        prefixQuery<InvoiceDoc>('invoices', 'invoiceNumber', q.toUpperCase(), 5),
        prefixQuery<ProjectDoc>('projects', 'name', q, 5),
      ]);

      const items: SearchResult[] = [
        ...clientsByCompany
          .filter((c) => c.status !== 'deleted')
          .map((c) => ({
            id: c.id,
            type: 'client' as const,
            label: c.companyName,
            sub: c.contactName || c.email,
            href: `/clients/${c.id}`,
          })),
        ...invoices
          .filter((inv) => inv.status !== 'deleted')
          .map((inv) => ({
            id: inv.id,
            type: 'invoice' as const,
            label: inv.invoiceNumber,
            sub: `${inv.clientName} · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(inv.total)}`,
            href: `/invoices/${inv.id}`,
          })),
        ...projects
          .filter((p) => p.status !== 'deleted')
          .map((p) => ({
            id: p.id,
            type: 'project' as const,
            label: p.name,
            sub: p.clientName,
            href: `/projects/${p.id}`,
          })),
      ];
      setResults(items);
      setActiveIndex(0);
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query_), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query_, runSearch]);

  const navigate = (result: SearchResult) => {
    router.push(result.href);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[activeIndex]) {
      navigate(results[activeIndex]);
    }
  };

  const TYPE_ICON = {
    client: Users,
    invoice: Receipt,
    project: Briefcase,
  };

  const TYPE_COLOR = {
    client: 'text-blue-500',
    invoice: 'text-amber-500',
    project: 'text-purple-500',
  };

  const grouped = (['client', 'invoice', 'project'] as const).map((type) => ({
    type,
    label: type === 'client' ? 'Clients' : type === 'invoice' ? 'Invoices' : 'Projects',
    items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-44 lg:w-60 text-sm text-gray-400 hover:border-gray-300 transition-colors"
      >
        <Search size={13} className="flex-shrink-0" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-mono bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
          ⌘K
        </kbd>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-9 z-50 w-80 lg:w-96 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query_}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search clients, invoices, projects…"
              className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
              autoComplete="off"
            />
            {query_ && (
              <button onClick={() => { setQuery(''); setResults([]); }} className="text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {searching && (
              <div className="text-center py-6 text-xs text-gray-400">Searching…</div>
            )}
            {!searching && query_.length >= 2 && results.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-400">No results for "{query_}"</div>
            )}
            {!searching && query_.length < 2 && (
              <div className="text-center py-6 text-xs text-gray-400">Type at least 2 characters to search</div>
            )}
            {grouped.map(({ type, label, items }) => {
              const Icon = TYPE_ICON[type];
              return (
                <div key={type}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50">
                    {label}
                  </div>
                  {items.map((result) => {
                    const idx = results.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        onClick={() => navigate(result)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                          activeIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50',
                        )}
                      >
                        <Icon size={14} className={cn('shrink-0', TYPE_COLOR[type])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{result.label}</p>
                          <p className="text-[11px] text-gray-500 truncate">{result.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>Esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}
