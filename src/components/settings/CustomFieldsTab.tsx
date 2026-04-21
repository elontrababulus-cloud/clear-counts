'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { create, remove, update } from '@/lib/firestore/helpers';
import { useCustomFields } from '@/hooks/useCustomFields';
import type { CustomFieldDefinition, CustomFieldType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

const ENTITIES = [
  { value: 'clients', label: 'Clients' },
  { value: 'leads', label: 'Leads' },
  { value: 'projects', label: 'Projects' },
  { value: 'invoices', label: 'Invoices' },
] as const;

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select / Dropdown' },
  { value: 'boolean', label: 'Checkbox' },
];

const SELECT_CLS = cn(
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
);

export function CustomFieldsTab() {
  const [selectedEntity, setSelectedEntity] = useState<CustomFieldDefinition['entity']>('clients');
  const { fields, loading } = useCustomFields(selectedEntity);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');

  const openCreate = () => {
    setEditingField(null);
    setLabel('');
    setType('text');
    setRequired(false);
    setOptions('');
    setDialogOpen(true);
  };

  const openEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setLabel(field.label);
    setType(field.type);
    setRequired(field.required);
    setOptions(field.options?.join(', ') ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error('Label is required');
      return;
    }

    setSaving(true);
    try {
      const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const payload: Omit<CustomFieldDefinition, 'id'> = {
        entity: selectedEntity,
        label: label.trim(),
        key,
        type,
        required,
        order: editingField ? editingField.order : fields.length,
        createdAt: Timestamp.now(),
        ...(type === 'select' ? { options: options.split(',').map(s => s.trim()).filter(Boolean) } : {}),
      };

      if (editingField) {
        await update('custom_fields', editingField.id, payload);
        toast.success('Field updated');
      } else {
        await create('custom_fields', payload);
        toast.success('Field created');
      }
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save field');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this field? Data stored in this field will remain in documents but won\'t be visible in forms.')) return;
    try {
      await remove('custom_fields', id);
      toast.success('Field deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete field');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {ENTITIES.map((e) => (
            <button
              key={e.value}
              onClick={() => setSelectedEntity(e.value as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                selectedEntity === e.value 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Field
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 text-gray-300 animate-spin" />
          </div>
        ) : fields.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No custom fields defined for {selectedEntity}.</p>
            <p className="text-xs text-gray-400 mt-1">Add fields to capture extra data during creation.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between p-4 hover:bg-gray-50 group">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-gray-300 cursor-grab active:cursor-grabbing" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{field.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase font-bold text-gray-400">{field.type}</span>
                      {field.required && (
                        <span className="text-[10px] bg-red-50 text-red-600 px-1.5 rounded-full font-medium">Required</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(field)}>
                    <Settings className="h-4 w-4 text-gray-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => handleDelete(field.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add Custom Field'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="fieldLabel">Label *</Label>
              <Input 
                id="fieldLabel" 
                value={label} 
                onChange={(e) => setLabel(e.target.value)} 
                placeholder="e.g. VAT Number" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fieldType">Type</Label>
                <select 
                  id="fieldType" 
                  className={SELECT_CLS} 
                  value={type} 
                  onChange={(e) => setType(e.target.value as any)}
                >
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={required} 
                    onChange={(e) => setRequired(e.target.checked)} 
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Required field</span>
                </label>
              </div>
            </div>
            {type === 'select' && (
              <div className="space-y-1.5">
                <Label htmlFor="fieldOptions">Options (comma separated)</Label>
                <Input 
                  id="fieldOptions" 
                  value={options} 
                  onChange={(e) => setOptions(e.target.value)} 
                  placeholder="Option 1, Option 2, Option 3" 
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Minimal Settings icon replacement to avoid too many imports
function Settings({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
