'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FileText,
  Receipt,
  CreditCard,
  Briefcase,
  LogOut,
  Menu,
  Settings,
} from 'lucide-react';

// ─── Navigation config ────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    section: 'MAIN',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'CRM',
    items: [
      { href: '/clients', label: 'Clients', icon: Users },
      { href: '/leads', label: 'Leads', icon: UserPlus },
    ],
  },
  {
    section: 'FINANCE',
    items: [
      { href: '/quotes', label: 'Quotes', icon: FileText },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    section: 'WORK',
    items: [{ href: '/projects', label: 'Projects', icon: Briefcase }],
  },
] as const;

// Bottom nav items (mobile only)
const BOTTOM_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients',   label: 'Clients',   icon: Users },
  { href: '/leads',     label: 'Leads',     icon: UserPlus },
  { href: '/invoices',  label: 'Invoices',  icon: Receipt },
  { href: '/projects',  label: 'Projects',  icon: Briefcase },
] as const;

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':  { title: 'Dashboard',  subtitle: 'Overview of your business' },
  '/clients':    { title: 'Clients',    subtitle: 'Manage your client relationships' },
  '/leads':      { title: 'Leads',      subtitle: 'Track potential clients' },
  '/quotes':     { title: 'Quotes',     subtitle: 'Manage estimates and quotes' },
  '/invoices':   { title: 'Invoices',   subtitle: 'Track payments and billing' },
  '/payments':   { title: 'Payments',   subtitle: 'Payment history and records' },
  '/projects':   { title: 'Projects',   subtitle: 'Manage ongoing work' },
  '/settings':   { title: 'Settings',   subtitle: 'Company and account settings' },
};

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const { user, userDoc, role, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
    onNavClick?.();
  };

  const rawName = userDoc?.displayName ?? user?.displayName ?? user?.email?.split('@')[0] ?? 'User';
  const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Staff';
  const initials = rawName
    .split(' ')
    .map((n: string) => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0F172A', color: 'white' }}>
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 h-14 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-xs font-bold select-none flex-shrink-0">
          CC
        </div>
        <span className="font-semibold text-sm tracking-tight">Clearcounts CRM</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV_SECTIONS.map(({ section, items }) => (
          <div key={section}>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1"
              style={{ color: 'rgba(148,163,184,0.6)' }}
            >
              {section}
            </p>
            <ul className="space-y-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavClick}
                      className={cn(
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
                        isActive
                          ? 'bg-blue-700 text-white font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-white/5',
                      )}
                    >
                      <Icon size={15} className="flex-shrink-0" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: Settings + User */}
      <div
        className="px-3 py-3 flex-shrink-0 space-y-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Settings link */}
        <Link
          href="/settings"
          onClick={onNavClick}
          className={cn(
            'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
            pathname === '/settings'
              ? 'bg-blue-700 text-white font-medium'
              : 'text-slate-400 hover:text-white hover:bg-white/5',
          )}
        >
          <Settings size={15} className="flex-shrink-0" />
          Settings
        </Link>

        {/* User info */}
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold flex-shrink-0 select-none">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{rawName}</p>
            <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.7)' }}>{displayRole}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors text-slate-400 hover:text-red-400"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard layout ─────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    );
  }

  if (!user) return null;

  const meta =
    PAGE_META[pathname] ??
    Object.entries(PAGE_META).find(([key]) => pathname.startsWith(key + '/'))?.[1] ??
    { title: 'Clearcounts CRM', subtitle: '' };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F4F5F7' }}>
      {/* ── Desktop sidebar ─────────────────────── */}
      <aside className="hidden md:flex flex-col w-[220px] flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Right column: topbar + content ──────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header
          className="h-14 bg-white flex items-center gap-3 px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #E5E7EB' }}
        >
          {/* Mobile: Sheet trigger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger className="md:hidden rounded-md p-1.5 text-gray-500 hover:bg-gray-100 transition-colors focus-visible:outline-none">
              <Menu size={20} aria-label="Open navigation" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[220px] p-0 border-r-0"
              style={{ backgroundColor: '#0F172A' }}
              showCloseButton={false}
            >
              <SidebarContent onNavClick={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 leading-none truncate">
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{meta.subtitle}</p>
            )}
          </div>

          {/* Global search */}
          <GlobalSearch />

          {/* Notification bell */}
          <NotificationBell />
        </header>

        {/* Main content — with fade-in animation */}
        <main
          key={pathname}
          className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6"
          style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
        >
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation ────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-blue-700' : 'text-gray-400 hover:text-gray-600',
                )}
              >
                <Icon
                  size={18}
                  className={isActive ? 'text-blue-700' : 'text-gray-400'}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Fade-slide animation keyframe */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
