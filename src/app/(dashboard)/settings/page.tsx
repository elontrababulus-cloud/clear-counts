'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Settings, Upload, Loader2, Building2, ShieldAlert } from 'lucide-react';
import { subscribeToDoc, update } from '@/lib/firestore/helpers';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { CompanySettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'ZWG', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD'] as const;

const SELECT_CLS = cn(
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-sm outline-none transition-colors',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
);

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name:               z.string().min(1, 'Company name is required'),
  email:              z.string().email('Invalid email'),
  phone:              z.string(),
  address:            z.string(),
  defaultCurrency:    z.string().min(1),
  defaultTaxPercent:  z.string(),
  invoicePrefix:      z.string().min(1, 'Invoice prefix is required'),
  quotePrefix:        z.string().min(1, 'Quote prefix is required'),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { role } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Admin-only guard
  useEffect(() => {
    if (role && role !== 'admin') {
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
        ...(logoUrl ? { logoUrl } : {}),
      };
      // settings/company is a singleton — use setDoc via update (creates if missing via helpers)
      await update<CompanySettings>('settings', 'company', payload);
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

  if (role && role !== 'admin') {
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
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
          <Settings className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Company Settings</h2>
          <p className="text-xs text-gray-500">Configure your business profile and preferences</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Company profile card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Company Profile</h3>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="h-14 w-14 rounded-xl object-cover border border-gray-200"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-gray-300" />
                </div>
              )}
              <div>
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
                >
                  {uploading ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Uploading…</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5 mr-1" />Upload Logo</>
                  )}
                </Button>
                <p className="text-[10px] text-gray-400 mt-1">PNG, JPG up to 5 MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Company Name *</Label>
              <Input id="name" {...register('name')} placeholder="Acme Corp" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Business Email *</Label>
              <Input id="email" type="email" {...register('email')} placeholder="info@company.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} placeholder="+1 555 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register('address')} placeholder="123 Main St, City" />
            </div>
          </div>
        </div>

        {/* Finance preferences card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-900">Finance Preferences</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
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
                min="0"
                max="100"
                {...register('defaultTaxPercent')}
                placeholder="15"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
              <Input id="invoicePrefix" {...register('invoicePrefix')} placeholder="INV" />
              {errors.invoicePrefix && (
                <p className="text-xs text-destructive">{errors.invoicePrefix.message}</p>
              )}
              <p className="text-[10px] text-gray-400">e.g. "INV" → INV-0001</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quotePrefix">Quote Prefix</Label>
              <Input id="quotePrefix" {...register('quotePrefix')} placeholder="QT" />
              {errors.quotePrefix && (
                <p className="text-xs text-destructive">{errors.quotePrefix.message}</p>
              )}
              <p className="text-[10px] text-gray-400">e.g. "QT" → QT-0001</p>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="min-w-28">
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
