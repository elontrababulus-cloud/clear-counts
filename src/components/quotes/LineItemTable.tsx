'use client';

import { useCallback } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { LineItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newRow(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    unitPrice: 0,
    taxPercent: 0,
    total: 0,
  };
}

function computeTotal(row: LineItem): number {
  const gross = (row.quantity || 0) * (row.unitPrice || 0);
  return gross * (1 + (row.taxPercent || 0) / 100);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LineItemTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  disabled?: boolean;
}

// ─── Column header class ──────────────────────────────────────────────────────

const TH = 'px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap';
const NUM_INPUT = cn(
  'h-8 text-right font-mono text-sm border-0 shadow-none bg-transparent',
  'focus:ring-0 focus:border-b focus:border-primary rounded-none px-1',
);

// ─── Component ────────────────────────────────────────────────────────────────

export function LineItemTable({ items, onChange, disabled }: LineItemTableProps) {
  const update = useCallback(
    (id: string, field: keyof LineItem, raw: string) => {
      onChange(
        items.map((item) => {
          if (item.id !== id) return item;
          const numericFields: (keyof LineItem)[] = ['quantity', 'unitPrice', 'taxPercent'];
          const updated = numericFields.includes(field)
            ? { ...item, [field]: parseFloat(raw) || 0 }
            : { ...item, [field]: raw };
          return { ...updated, total: computeTotal(updated) };
        }),
      );
    },
    [items, onChange],
  );

  const addRow = () => onChange([...items, newRow()]);

  const removeRow = (id: string) => onChange(items.filter((r) => r.id !== id));

  // Totals
  const subtotal = items.reduce((s, r) => s + (r.quantity || 0) * (r.unitPrice || 0), 0);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className={cn(TH, 'w-full')}>Description</th>
              <th className={cn(TH, 'w-24 text-center')}>Qty</th>
              <th className={cn(TH, 'w-28 text-right')}>Unit Price</th>
              <th className={cn(TH, 'w-20 text-right')}>Tax %</th>
              <th className={cn(TH, 'w-28 text-right')}>Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No items yet. Click &quot;Add Row&quot; to start.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 group">
                {/* Description */}
                <td className="px-2 py-1">
                  <Input
                    className="h-8 border-0 shadow-none bg-transparent focus:ring-0 px-1"
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => update(item.id, 'description', e.target.value)}
                    disabled={disabled}
                  />
                </td>
                {/* Qty */}
                <td className="px-2 py-1">
                  <Input
                    className={cn(NUM_INPUT, 'text-center')}
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => update(item.id, 'quantity', e.target.value)}
                    disabled={disabled}
                  />
                </td>
                {/* Unit Price */}
                <td className="px-2 py-1">
                  <Input
                    className={NUM_INPUT}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => update(item.id, 'unitPrice', e.target.value)}
                    disabled={disabled}
                  />
                </td>
                {/* Tax % */}
                <td className="px-2 py-1">
                  <Input
                    className={NUM_INPUT}
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.taxPercent}
                    onChange={(e) => update(item.id, 'taxPercent', e.target.value)}
                    disabled={disabled}
                  />
                </td>
                {/* Line total */}
                <td className="px-2 py-1 text-right font-mono text-sm font-medium">
                  {computeTotal(item).toFixed(2)}
                </td>
                {/* Delete */}
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeRow(item.id)}
                    disabled={disabled}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Row
        </Button>
      )}

      {/* Subtotal hint */}
      <div className="text-xs text-right text-muted-foreground pr-8">
        Subtotal (excl. tax):{' '}
        <span className="font-mono font-medium text-foreground">${subtotal.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { newRow, computeTotal };
