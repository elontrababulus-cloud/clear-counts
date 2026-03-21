import { Phone, Building2, Banknote, Globe, Zap } from 'lucide-react';
import type { PaymentMethod } from '@/types';
import { cn } from '@/lib/utils';

// ─── Method config ────────────────────────────────────────────────────────────

export const METHOD_CONFIG: Record<
  PaymentMethod,
  {
    label: string;
    /** Hex colour used in PDF, CSV, and bar chart */
    hex: string;
    /** Tailwind-compatible classes for the badge */
    badgeCls: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  ecocash: {
    label: 'EcoCash',
    hex: '#10B981',
    badgeCls: 'bg-emerald-100 text-emerald-800',
    Icon: Phone,
  },
  bank_transfer: {
    label: 'Bank Transfer',
    hex: '#1E40AF',
    badgeCls: 'bg-blue-100 text-blue-800',
    Icon: Building2,
  },
  cash: {
    label: 'Cash',
    hex: '#64748B',
    badgeCls: 'bg-slate-100 text-slate-700',
    Icon: Banknote,
  },
  paypal: {
    label: 'PayPal',
    hex: '#0070BA',
    badgeCls: 'bg-sky-100 text-sky-800',
    Icon: Globe,
  },
  zipit: {
    label: 'ZIPIT',
    hex: '#7C3AED',
    badgeCls: 'bg-violet-100 text-violet-800',
    Icon: Zap,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface PaymentMethodBadgeProps {
  method: PaymentMethod;
  size?: 'sm' | 'md';
}

export function PaymentMethodBadge({ method, size = 'sm' }: PaymentMethodBadgeProps) {
  const cfg = METHOD_CONFIG[method];
  const Icon = cfg.Icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        cfg.badgeCls,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {cfg.label}
    </span>
  );
}
