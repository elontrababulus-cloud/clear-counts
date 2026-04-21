'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useCustomFields } from '@/hooks/useCustomFields';
import type { CustomFieldDefinition } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  entity: CustomFieldDefinition['entity'];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  className?: string;
}

const SELECT_CLS = cn(
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

export function DynamicFieldRenderer({ entity, values, onChange, className }: Props) {
  const { fields, loading } = useCustomFields(entity);

  if (loading || fields.length === 0) return null;

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100", className)}>
      <div className="col-span-full">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Custom Fields</h4>
      </div>
      
      {fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <Label htmlFor={field.key}>
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          
          {field.type === 'select' ? (
            <select
              id={field.key}
              value={values[field.key] || ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={SELECT_CLS}
              required={field.required}
            >
              <option value="">Select {field.label}...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'boolean' ? (
            <div className="flex items-center h-9">
              <input
                id={field.key}
                type="checkbox"
                checked={!!values[field.key]}
                onChange={(e) => onChange(field.key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
              />
            </div>
          ) : (
            <Input
              id={field.key}
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
              value={values[field.key] || ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              required={field.required}
            />
          )}
        </div>
      ))}
    </div>
  );
}
