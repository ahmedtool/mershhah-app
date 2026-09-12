'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, X } from 'lucide-react';
import { TimePicker } from '@/components/ui/time-picker';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { createPlacesSessionToken, autocompletePlaces, getPlaceDetails, type PlaceSuggestion, type DayHours } from '@/lib/geocoding';
import { parseOpeningHoursText } from '@/lib/branch-hours';
import saGeodata from '@/data/sa-geodata.json';
import type { Branch } from '@/lib/types';
import { useUser } from '@/hooks/useUser';
import { useLanguage } from '@/components/shared/LanguageContext';

function buildSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t('branches.branchNameRequired')),
    city: z.string().min(2, t('branches.selectCityError')),
    district: z.string().min(2, t('branches.selectDistrictError')),
    phone: z.string().optional(),
    opening_hours: z.string().max(200).optional(),
    status: z.enum(['active', 'inactive']),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

function generateHoursText(open: string, close: string, friOpen: string, friClose: string): string {
  if (!open || !close) return '';
  const to12 = (t: string) => {
    const [h, m] = t.split(':');
    const hour24 = parseInt(h);
    const period = hour24 >= 12 ? 'م' : 'ص';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}:${m} ${period}`;
  };
  let text = `يوميًا ${to12(open)} - ${to12(close)}`;
  if (friOpen && friClose) {
    text += ` (الجمعة ${to12(friOpen)} - ${to12(friClose)})`;
  }
  return text;
}

// Google returns one open/close pair per day of week (0=Sunday..6=Saturday).
// The branch form only models "same hours every day, optionally different
// on Friday" - so the most common pair across the week becomes "all days",
// and Friday (index 5) becomes the override only if it actually differs.
function deriveHoursFromWeekly(weekly: (DayHours | null)[]): { allOpen: string; allClose: string; friOpen: string; friClose: string; showFriday: boolean } | null {
  const counts = new Map<string, number>();
  for (const day of weekly) {
    if (!day) continue;
    const key = `${day.open}|${day.close}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let modeKey = '';
  let modeCount = -1;
  counts.forEach((count, key) => { if (count > modeCount) { modeCount = count; modeKey = key; } });
  const [allOpen, allClose] = modeKey.split('|');
  const friday = weekly[5];
  const fridayDiffers = Boolean(friday && (friday.open !== allOpen || friday.close !== allClose));
  return {
    allOpen, allClose,
    friOpen: fridayDiffers && friday ? friday.open : '',
    friClose: fridayDiffers && friday ? friday.close : '',
    showFriday: fridayDiffers,
  };
}

const cities = Object.keys(saGeodata) as string[];

interface EditBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
  restaurantId: string;
  onSaved?: () => void;
  children?: React.ReactNode;
}

export function EditBranchDialog({
  open, onOpenChange, branch, restaurantId, onSaved, children,
}: EditBranchDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { t, dir } = useLanguage();
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';
  const schema = useMemo(() => buildSchema(t), [t]);
  const [saving, setSaving] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFriday, setShowFriday] = useState(false);
  const isEdit = Boolean(branch?.id);
  const [allDaysOpen, setAllDaysOpen] = useState('');
  const [allDaysClose, setAllDaysClose] = useState('');
  const [fridayOpen, setFridayOpen] = useState('');
  const [fridayClose, setFridayClose] = useState('');
  const [branchApps, setBranchApps] = useState<any[]>([]);
  const [globalApps, setGlobalApps] = useState<any[]>([]);
  const [customAppDefs, setCustomAppDefs] = useState<any[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');
  const [districtOpen, setDistrictOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', city: '', district: '', phone: '', opening_hours: '',
      status: 'active', latitude: null, longitude: null,
    },
  });

  const city = form.watch('city');
  const districts = (saGeodata as Record<string, string[]>)[city] ?? [];

  const filteredCities = citySearch
    ? cities.filter(c => c.includes(citySearch))
    : cities;

  const filteredDistricts = districtSearch
    ? districts.filter(d => d.includes(districtSearch))
    : districts;

  useEffect(() => {
    if (!open) return;
    if (branch) {
      form.reset({
        name: branch.name, city: branch.city, district: branch.district,
        phone: branch.phone ?? '', opening_hours: branch.opening_hours ?? '',
        status: branch.status ?? 'active', latitude: branch.latitude ?? null, longitude: branch.longitude ?? null,
      });
      setCitySearch(branch.city || '');
      setDistrictSearch(branch.district || '');
      setBranchApps(Array.isArray(branch.applications) ? branch.applications : []);
      setLocationSuggestions([]);
      const parsedHours = parseOpeningHoursText(branch.opening_hours);
      setAllDaysOpen(parsedHours?.allOpen ?? '');
      setAllDaysClose(parsedHours?.allClose ?? '');
      setFridayOpen(parsedHours?.friOpen ?? '');
      setFridayClose(parsedHours?.friClose ?? '');
      setShowFriday(parsedHours?.showFriday ?? false);
    } else {
      form.reset({ name: '', city: '', district: '', phone: '', opening_hours: '', status: 'active', latitude: null, longitude: null });
      setCitySearch('');
      setDistrictSearch('');
      setBranchApps([]);
      setLocationSuggestions([]);
      setAllDaysOpen(''); setAllDaysClose(''); setFridayOpen(''); setFridayClose(''); setShowFriday(false);
    }
    sessionTokenRef.current = createPlacesSessionToken();
  }, [open, branch, form]);

  // Both the admin-managed global catalog (jahez/hungerstation) and this
  // restaurant's own custom apps (defined in Customize > Apps) need to be
  // toggleable here - a custom app's link is per-branch just like a global
  // one, so this dialog has to know about both to be the single place that
  // manages a branch's delivery-app links.
  useEffect(() => {
    if (!open) return;
    supabase.from('applications').select('*').then(({ data }: { data: any[] | null }) => setGlobalApps(data || []));
    if (restaurantId) {
      supabase.from('restaurants').select('applications').eq('id', restaurantId).single().then(({ data }: { data: any }) => {
        const apps = Array.isArray(data?.applications) ? data.applications : [];
        setCustomAppDefs(apps.filter((a: any) => a.type === 'custom'));
      });
    }
  }, [open, restaurantId]);

  const availableApps = [
    ...globalApps.map((a: any) => ({ id: a.id, name: a.name, logo_url: a.logo_url, type: 'global' as const })),
    ...customAppDefs.map((a: any) => ({ id: a.id, name: a.name, logo_url: a.logo, type: 'custom' as const })),
  ];

  useEffect(() => { if (!city) form.setValue('district', ''); }, [city, form]);

  function handleNameSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setLocationSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const suggestions = await autocompletePlaces(value, sessionTokenRef.current);
        setLocationSuggestions(suggestions);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 300);
  }

  async function handleSelectBranchSuggestion(suggestion: PlaceSuggestion) {
    setLocationOpen(false);
    setLocationSuggestions([]);
    const result = await getPlaceDetails(suggestion.placeId, sessionTokenRef.current);
    sessionTokenRef.current = createPlacesSessionToken();
    if (result) {
      const resolvedName = result.name || suggestion.description.split(/[،,]/)[0].trim();
      form.setValue('name', resolvedName, { shouldDirty: true });
      if (result.city) {
        form.setValue('city', result.city, { shouldDirty: true });
        setCitySearch(result.city);
      }
      if (result.district) {
        form.setValue('district', result.district, { shouldDirty: true });
        setDistrictSearch(result.district);
      }
      if (result.phone) {
        form.setValue('phone', result.phone, { shouldDirty: true });
      }
      if (result.weeklyHours) {
        const derived = deriveHoursFromWeekly(result.weeklyHours);
        if (derived) {
          setAllDaysOpen(derived.allOpen);
          setAllDaysClose(derived.allClose);
          setFridayOpen(derived.friOpen);
          setFridayClose(derived.friClose);
          setShowFriday(derived.showFriday);
          form.setValue('opening_hours', generateHoursText(derived.allOpen, derived.allClose, derived.friOpen, derived.friClose), { shouldDirty: true });
        }
      }
      form.setValue('latitude', result.latitude, { shouldDirty: true });
      form.setValue('longitude', result.longitude, { shouldDirty: true });
      toast({ title: t('branches.locationExtracted') });
    } else {
      toast({ variant: 'destructive', title: t('branches.coordinatesNotFound') });
    }
  }

  async function onSubmit(values: FormValues) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        name: values.name,
        city: values.city,
        district: values.district,
        status: values.status,
        restaurant_id: restaurantId,
        applications: branchApps,
      };
      if (values.phone?.trim()) data.phone = values.phone.trim();
      if (values.opening_hours?.trim()) data.opening_hours = values.opening_hours.trim();
      if (values.latitude != null) data.latitude = values.latitude;
      if (values.longitude != null) data.longitude = values.longitude;

      if (isEdit && branch?.id) {
        const { error } = await supabase.from('branches').update(data).eq('id', branch.id);
        if (error) throw error;
        toast({ title: t('branches.updated') });
      } else {
        const maxBranches = user?.entitlements?.maxBranches ?? 1;
        const { count } = await supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId);
        if ((count ?? 0) >= maxBranches) {
          toast({
            variant: 'destructive',
            title: t('branches.maxBranchesReached'),
            description: `${t('branches.currentPlanPrefix')} (${user?.entitlements?.planName || ''}) ${t('branches.allowsMax')} ${maxBranches} ${t('branches.branchWord')}. ${t('branches.upgradeForMore')}`,
          });
          setSaving(false);
          return;
        }

        const { error } = await supabase.from('branches').insert({ id: crypto.randomUUID(), ...data });
        if (error) throw error;
        toast({ title: t('branches.added') });
      }

      syncPublicPage(restaurantId).catch(() => {});
      onSaved?.();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: t('common.errorTitle'), description: e instanceof Error ? e.message : String(e) });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir={dir}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEdit ? t('branches.editBranch') : t('branches.addNewBranch')}</h2>
              <p className="text-xs text-gray-600 mt-0.5">{isEdit ? t('branches.editBranchDesc') : t('branches.addBranchDesc')}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Name - search by branch name/location, or type manually */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">{t('branches.branchName')}</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      placeholder={t('branches.branchNamePlaceholder')}
                      value={field.value}
                      onChange={(e) => { field.onChange(e); handleNameSearchChange(e.target.value); }}
                      onBlur={() => { field.onBlur(); setTimeout(() => setLocationOpen(false), 200); }}
                      onFocus={() => setLocationOpen(true)}
                      className="h-11 rounded-xl border-gray-200 text-sm"
                      disabled={saving}
                    />
                  </FormControl>
                  {isSearchingLocation && (
                    <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                  {locationOpen && locationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                      {locationSuggestions.map((s) => (
                        <button key={s.placeId} type="button"
                          onClick={() => handleSelectBranchSuggestion(s)}
                          className={`w-full ${alignStart} px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors`}>
                          {s.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <FormMessage className="text-[10px]" />
                {form.watch('latitude') && form.watch('longitude') && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${form.watch('latitude')},${form.watch('longitude')}`} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {t('branches.locationSet')} ✓
                  </a>
                )}
              </FormItem>
            )} />

            {/* City & District */}
            <div className="grid grid-cols-2 gap-3">
              {/* City Searchable */}
              <div className="space-y-1.5">
                <FormLabel className="text-xs text-gray-600">{t('branches.city')}</FormLabel>
                <div className="relative">
                  <Input
                    value={citySearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCitySearch(val);
                      form.setValue('city', val, { shouldDirty: true });
                      form.setValue('district', '', { shouldDirty: true });
                    }}
                    onFocus={() => setCityOpen(true)}
                    onBlur={() => setTimeout(() => setCityOpen(false), 200)}
                    placeholder={t('branches.searchCityPlaceholder')}
                    className="h-10 rounded-xl border-gray-200 text-sm"
                    disabled={saving}
                  />
                  {cityOpen && filteredCities.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                      {filteredCities.map(c => (
                        <button key={c} type="button"
                          onClick={() => {
                            form.setValue('city', c, { shouldDirty: true });
                            form.setValue('district', '', { shouldDirty: true });
                            setCitySearch(c);
                            setCityOpen(false);
                          }}
                          className={`w-full ${alignStart} px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* District Searchable */}
              <div className="space-y-1.5">
                <FormLabel className="text-xs text-gray-600">{t('branches.district')}</FormLabel>
                <div className="relative">
                  <Input
                    value={districtSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDistrictSearch(val);
                      form.setValue('district', val, { shouldDirty: true });
                    }}
                    onFocus={() => setDistrictOpen(true)}
                    onBlur={() => setTimeout(() => setDistrictOpen(false), 200)}
                    placeholder={city ? t('branches.searchDistrictPlaceholder') : t('branches.selectCityFirst')}
                    className="h-10 rounded-xl border-gray-200 text-sm"
                    disabled={saving || !city}
                  />
                  {districtOpen && filteredDistricts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                      {filteredDistricts.map(d => (
                        <button key={d} type="button"
                          onClick={() => {
                            form.setValue('district', d, { shouldDirty: true });
                            setDistrictSearch(d);
                            setDistrictOpen(false);
                          }}
                          className={`w-full ${alignStart} px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Phone */}
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">{t('branches.mobileNumber')} <span className="text-gray-600">({t('common.optional')})</span></FormLabel>
                <FormControl>
                  <Input placeholder="05XXXXXXXX" {...field} className="h-10 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={saving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Opening Hours */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">{t('branches.openingHours')}</FormLabel>
              <div className="flex items-end gap-2">
                <TimePicker value={allDaysOpen} onChange={(v) => { setAllDaysOpen(v); form.setValue('opening_hours', generateHoursText(v, allDaysClose, fridayOpen, fridayClose), { shouldDirty: true }); }} label={t('branches.openLabel')} className="flex-1" />
                <span className="text-xs text-gray-600 mb-3">—</span>
                <TimePicker value={allDaysClose} onChange={(v) => { setAllDaysClose(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, v, fridayOpen, fridayClose), { shouldDirty: true }); }} label={t('branches.closeLabel')} className="flex-1" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showFriday} onChange={(e) => { setShowFriday(e.target.checked); if (!e.target.checked) { setFridayOpen(''); setFridayClose(''); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, '', ''), { shouldDirty: true }); } }} className="w-3.5 h-3.5 rounded border-gray-300" />
                <span className="text-[11px] text-gray-600">{t('branches.fridayDifferent')}</span>
              </label>

              {showFriday && (
                <div className="flex items-end gap-2">
                  <TimePicker value={fridayOpen} onChange={(v) => { setFridayOpen(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, v, fridayClose), { shouldDirty: true }); }} label={t('branches.fridayOpenLabel')} className="flex-1" />
                  <span className="text-xs text-gray-600 mb-3">—</span>
                  <TimePicker value={fridayClose} onChange={(v) => { setFridayClose(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, fridayOpen, v), { shouldDirty: true }); }} label={t('branches.fridayCloseLabel')} className="flex-1" />
                </div>
              )}

              {allDaysOpen && allDaysClose && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-600">{generateHoursText(allDaysOpen, allDaysClose, fridayOpen, fridayClose)}</p>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">{t('common.status')}</FormLabel>
              <div className="flex gap-2">
                <button type="button" onClick={() => form.setValue('status', 'active')}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium transition-all border ${form.watch('status') === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {t('common.active')}
                </button>
                <button type="button" onClick={() => form.setValue('status', 'inactive')}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium transition-all border ${form.watch('status') === 'inactive' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {t('common.inactive')}
                </button>
              </div>
            </div>

            {/* Branch Delivery Apps */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">{t('settings.deliveryApps')}</FormLabel>
              <p className="text-[10px] text-gray-600">{t('branches.addBranchAppLinks')}</p>
              
              {availableApps.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {availableApps.map(app => {
                    const isAdded = branchApps.some((a: any) => a.platformId === app.id);
                    return (
                      <button key={app.id} type="button"
                        onClick={() => {
                          if (isAdded) {
                            setBranchApps(branchApps.filter((a: any) => a.platformId !== app.id));
                          } else {
                            setBranchApps([...branchApps, {
                              id: `branch-app-${app.id}`,
                              type: app.type,
                              platformId: app.id,
                              name: app.name,
                              logo: app.logo_url,
                              value: ''
                            }]);
                          }
                        }}
                        className={`h-8 gap-1.5 text-[10px] font-bold rounded-lg px-3 flex items-center border transition-colors ${
                          isAdded ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}>
                        {app.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {branchApps.map((app: any) => (
                <div key={app.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <div className="p-1.5 bg-white rounded-lg border border-gray-100 shrink-0">
                    <span className="text-[10px] font-bold text-gray-600">{app.name?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-gray-700">{app.name}</p>
                    <Input dir="ltr" value={app.value} placeholder={t('customize.linkPlaceholder')}
                      onChange={(e) => {
                        setBranchApps(branchApps.map((a: any) => a.id === app.id ? { ...a, value: e.target.value } : a));
                      }}
                      className="h-7 text-[10px] rounded-lg border-gray-200 mt-1" />
                  </div>
                  <button type="button" onClick={() => setBranchApps(branchApps.filter((a: any) => a.id !== app.id))}
                    className="text-gray-600 hover:text-red-500 transition-colors p-1">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => onOpenChange(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? t('common.saving') : isEdit ? t('common.saveChanges') : t('branches.addBranchSubmit')}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
