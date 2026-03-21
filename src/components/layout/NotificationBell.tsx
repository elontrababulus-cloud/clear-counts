'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  CheckCheck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Briefcase,
  UserPlus,
  Info,
} from 'lucide-react';
import { orderBy, limit, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToCollection, update } from '@/lib/firestore/helpers';
import type { NotificationDoc, NotificationType } from '@/types';
import { cn } from '@/lib/utils';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const NOTIF_ICON: Record<NotificationType, React.ElementType> = {
  invoice_paid:    CreditCard,
  invoice_overdue: AlertCircle,
  quote_accepted:  CheckCircle2,
  quote_declined:  XCircle,
  task_assigned:   ClipboardList,
  project_updated: Briefcase,
  lead_updated:    UserPlus,
  general:         Info,
};

const NOTIF_COLOR: Record<NotificationType, { bg: string; text: string }> = {
  invoice_paid:    { bg: 'bg-green-100', text: 'text-green-600' },
  invoice_overdue: { bg: 'bg-red-100',   text: 'text-red-600' },
  quote_accepted:  { bg: 'bg-green-100', text: 'text-green-600' },
  quote_declined:  { bg: 'bg-red-100',   text: 'text-red-600' },
  task_assigned:   { bg: 'bg-blue-100',  text: 'text-blue-600' },
  project_updated: { bg: 'bg-purple-100', text: 'text-purple-600' },
  lead_updated:    { bg: 'bg-amber-100', text: 'text-amber-600' },
  general:         { bg: 'bg-gray-100',  text: 'text-gray-600' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToCollection<NotificationDoc>(
      'notifications',
      [
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10),
      ],
      setNotifications,
    );
    return unsub;
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    setMarkingAll(true);
    try {
      await Promise.all(
        unread.map((n) => update<NotificationDoc>('notifications', n.id, { read: true })),
      );
    } catch {
      toast.error('Failed to mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClick = async (notif: NotificationDoc) => {
    if (!notif.read) {
      update<NotificationDoc>('notifications', notif.id, { read: true }).catch(() => null);
    }
    setOpen(false);
    if (notif.link) router.push(notif.link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-full transition-colors',
          open ? 'bg-gray-100' : 'hover:bg-gray-100',
        )}
        aria-label="Notifications"
      >
        <Bell size={16} className="text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900">Notifications</h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell size={28} className="mx-auto text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">You're all caught up!</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const Icon = NOTIF_ICON[n.type] ?? Info;
                  const color = NOTIF_COLOR[n.type] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
                  const ago = n.createdAt
                    ? formatDistanceToNow(new Date(n.createdAt.seconds * 1000), { addSuffix: true })
                    : '';

                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                          !n.read && 'bg-blue-50/50 hover:bg-blue-50',
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', color.bg)}>
                          <Icon size={14} className={color.text} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className={cn('text-xs font-medium leading-snug', !n.read ? 'text-gray-900' : 'text-gray-700')}>
                            {n.title}
                          </p>
                          <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">{n.body}</p>
                          <p className="text-[10px] text-gray-400">{ago}</p>
                        </div>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
