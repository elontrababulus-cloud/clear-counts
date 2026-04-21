'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Settings as SettingsIcon, 
  Upload, 
  Loader2, 
  Building2, 
  ShieldAlert, 
  DollarSign, 
  Tags, 
  Key,
  Database
} from 'lucide-react';
import { subscribeToDoc, update, upsert } from '@/lib/firestore/helpers';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { CompanySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CustomFieldsTab } from '@/components/settings/CustomFieldsTab';

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'ZWG', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD'] as const;

const SELECT_CLS = cn(
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
);

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  // Company
  name:               z.string().min(1, 'Company name is required'),
  email:              z.string().email('Invalid email'),
  phone:              z.string(),
  address:            z.string(),
  // Finance
  defaultCurrency:    z.string().min(1),
  defaultTaxPercent:  z.string(),
  invoicePrefix:      z.string().min(1, 'Invoice prefix is required'),
  quotePrefix:        z.string().min(1, 'Quote prefix is required'),
  numberPadding:      z.string(),
  thousandSeparator:  z.string().max(1),
  decimalSeparator:   z.string().max(1),
  decimalPlaces:      z.string(),
  // Permissions
  staffCanSeeAllClients: z.boolean(),
  staffCanSeeAllLeads:   z.boolean(),
  staffCanSeeAllInvoices: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const TABS = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'fields', label: 'Custom Fields', icon: Database },
  { id: 'permissions', label: 'Permissions', icon: Key },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'company';

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Admin-only guard
  useEffect(() => {
    if (role && !['admin'].includes(role)) {
      toast.error('Only administrators can access settings');
      router.replace('/dashboard');
    }
  }, [role, router]);

  // Load settings
  useEffect(() => {
    const unsub = subscribeToDoc<CompanySettings & { id: string }>(
      'settings',
      'company',
      (data) => {
        if (data) {
          setSettings(data);
          setLogoUrl(data.logoUrl ?? null);
        }
        setLoadingSettings(false);
      },
    );
    return unsub;
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      defaultCurrency: 'USD',
      defaultTaxPercent: '0',
      invoicePrefix: 'INV',
      quotePrefix: 'QT',
      numberPadding: '4',
      thousandSeparator: ',',
      decimalSeparator: '.',
      decimalPlaces: '2',
      staffCanSeeAllClients: true,
      staffCanSeeAllLeads: true,
      staffCanSeeAllInvoices: true,
    },
  });

  // Populate form when settings load
  useEffect(() => {
    if (!settings) return;
    reset({
      name:              settings.name ?? '',
      email:             settings.email ?? '',
      phone:             settings.phone ?? '',
      address:           settings.address ?? '',
      defaultCurrency:   settings.defaultCurrency ?? 'USD',
      defaultTaxPercent: String(settings.defaultTaxPercent ?? 0),
      invoicePrefix:     settings.invoicePrefix ?? 'INV',
      quotePrefix:       settings.quotePrefix ?? 'QT',
      numberPadding:     String(settings.numberPadding ?? 4),
      thousandSeparator: settings.thousandSeparator ?? ',',
      decimalSeparator:  settings.decimalSeparator ?? '.',
      decimalPlaces:     String(settings.decimalPlaces ?? 2),
      staffCanSeeAllClients: settings.permissions?.staffCanSeeAllClients ?? true,
      staffCanSeeAllLeads:   settings.permissions?.staffCanSeeAllLeads ?? true,
      staffCanSeeAllInvoices: settings.permissions?.staffCanSeeAllInvoices ?? true,
    });
  }, [settings, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload: Partial<CompanySettings> = {
        name:              values.name,
        email:             values.email,
        phone:             values.phone,
        address:           values.address,
        defaultCurrency:   values.defaultCurrency,
        defaultTaxPercent: parseFloat(values.defaultTaxPercent) || 0,
        invoicePrefix:     values.invoicePrefix,
        quotePrefix:       values.quotePrefix,
        numberPadding:     parseInt(values.numberPadding) || 4,
        thousandSeparator: values.thousandSeparator,
        decimalSeparator:  values.decimalSeparator,
        decimalPlaces:     parseInt(values.decimalPlaces) || 2,
        permissions: {
          staffCanSeeAllClients: values.staffCanSeeAllClients,
          staffCanSeeAllLeads:   values.staffCanSeeAllLeads,
          staffCanSeeAllInvoices: values.staffCanSeeAllInvoices,
        },
        ...(logoUrl ? { logoUrl } : {}),
      };
      await upsert<CompanySettings>('settings', 'company', payload);
      toast.success('Settings saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    try {
      const fileRef_ = storageRef(storage, `settings/logo.${file.name.split('.').pop()}`);
      await uploadBytes(fileRef_, file);
      const url = await getDownloadURL(fileRef_);
      setLogoUrl(url);
      toast.success('Logo uploaded');
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const setTab = (id: string) => {
    router.push(`/settings?tab=${id}`);
  };

  if (role && !['admin'].includes(role)) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <ShieldAlert className="h-7 w-7 text-red-500" />
        </div>
        <p className="text-sm font-medium text-gray-700">Access restricted</p>
        <p className="text-xs text-gray-400">Only administrators can view settings.</p>
      </div>
    );
  }

  if (loadingSettings) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Setup & Configuration</h2>
          <p className="text-xs text-gray-500">Configure your business rules, entities, and permissions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id 
                ? "bg-white text-blue-700 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
            )}
          >
            <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-blue-600" : "text-gray-400")} />
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {activeTab === 'company' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                <Building2 className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Business Profile</h3>
              </div>

              {/* Logo */}
              <div className="space-y-3">
                <Label className="text-gray-600">Company Logo</Label>
                <div className="flex items-center gap-5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Company logo"
                      className="h-16 w-16 rounded-xl object-cover border border-gray-200 shadow-sm"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-gray-50 border border-gray-200 border-dashed flex items-center justify-center">
                      <Building2 className="h-7 w-7 text-gray-200" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="h-8"
                    >
                      {uploading ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Uploading…</>
                      ) : (
                        <><Upload className="h-3.5 w-3.5 mr-2" />Change Logo</>
                      )}
                    </Button>
                    <p className="text-[10px] text-gray-400">PNG or JPG. High resolution recommended.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Company Legal Name *</Label>
                  <Input id="name" {...register('name')} placeholder="Acme Corp" />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Public Contact Email *</Label>
                  <Input id="email" type="email" {...register('email')} placeholder="info@company.com" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" {...register('phone')} placeholder="+1 555 000 0000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Registered Address</Label>
                  <Input id="address" {...register('address')} placeholder="123 Main St, City" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Finance & Formatting</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="defaultCurrency">System Currency</Label>
                  <select id="defaultCurrency" {...register('defaultCurrency')} className={SELECT_CLS}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="defaultTaxPercent">Default Tax %</Label>
                  <Input
                    id="defaultTaxPercent"
                    type="number"
                    step="0.01"
                    {...register('defaultTaxPercent')}
                  />
                </div>

                <div className="space-y-1.5 border-t border-gray-50 pt-4 col-span-full" />

                <div className="space-y-1.5">
                  <Label htmlFor="invoicePrefix">Invoice Code Prefix</Label>
                  <Input id="invoicePrefix" {...register('invoicePrefix')} />
                  <p className="text-[10px] text-gray-400">e.g. "INV" → INV-0001</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quotePrefix">Quote Code Prefix</Label>
                  <Input id="quotePrefix" {...register('quotePrefix')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="numberPadding">Number Padding (Zeros)</Label>
                  <Input id="numberPadding" type="number" {...register('numberPadding')} />
                  <p className="text-[10px] text-gray-400">e.g. 4 → 0001, 2 → 01</p>
                </div>

                <div className="space-y-1.5 border-t border-gray-50 pt-4 col-span-full" />

                <div className="space-y-1.5">
                  <Label htmlFor="thousandSeparator">Thousands Separator</Label>
                  <select id="thousandSeparator" {...register('thousandSeparator')} className={SELECT_CLS}>
                    <option value=",">Comma (,)</option>
                    <option value=".">Dot (.)</option>
                    <option value=" ">Space ( )</option>
                    <option value="">None</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="decimalSeparator">Decimal Separator</Label>
                  <select id="decimalSeparator" {...register('decimalSeparator')} className={SELECT_CLS}>
                    <option value=".">Dot (.)</option>
                    <option value=",">Comma (,)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="decimalPlaces">Decimal Places</Label>
                  <Input id="decimalPlaces" type="number" {...register('decimalPlaces')} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fields' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <CustomFieldsTab />
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                <Key className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Security & Visibility</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-900">Staff Visibility: Clients</p>
                    <p className="text-[10px] text-gray-500">If disabled, staff can only see clients they created.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    {...register('staffCanSeeAllClients')} 
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 transition-all cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-900">Staff Visibility: Leads</p>
                    <p className="text-[10px] text-gray-500">Global lead visibility for all staff members.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    {...register('staffCanSeeAllLeads')} 
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 transition-all cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-900">Staff Visibility: Finance</p>
                    <p className="text-[10px] text-gray-500">Let staff see all invoices and payments.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    {...register('staffCanSeeAllInvoices')} 
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save button only for forms */}
        {activeTab !== 'fields' && (
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="min-w-32 shadow-md bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying…</>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
