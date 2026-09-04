'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Link as LinkIcon, X } from 'lucide-react';
import { TimePicker } from '@/components/ui/time-picker';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { extractFromGoogleMapsUrl } from '@/lib/geocoding';
import saGeodata from '@/data/sa-geodata.json';
import type { Branch } from '@/lib/types';
import { useUser } from '@/hooks/useUser';
import { useLanguage } from '@/components/shared/LanguageContext';

const schema = z.object({
  name: z.string().min(2, 'اسم الفرع مطلوب'),
  city: z.string().min(2, 'اختر المدينة'),
  district: z.string().min(2, 'اختر الحي'),
  phone: z.string().optional(),
  opening_hours: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive']),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

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
  const { dir } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [mapsUrl, setMapsUrl] = useState('');
  const [parsingMaps, setParsingMaps] = useState(false);
  const [showFriday, setShowFriday] = useState(false);
  const isEdit = Boolean(branch?.id);
  const [allDaysOpen, setAllDaysOpen] = useState('');
  const [allDaysClose, setAllDaysClose] = useState('');
  const [fridayOpen, setFridayOpen] = useState('');
  const [fridayClose, setFridayClose] = useState('');
  const [branchApps, setBranchApps] = useState<any[]>([]);
  const [globalApps, setGlobalApps] = useState<any[]>([]);
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
      setMapsUrl('');
    } else {
      form.reset({ name: '', city: '', district: '', phone: '', opening_hours: '', status: 'active', latitude: null, longitude: null });
      setCitySearch('');
      setDistrictSearch('');
      setBranchApps([]);
      setMapsUrl('');
    }
    setAllDaysOpen(''); setAllDaysClose(''); setFridayOpen(''); setFridayClose(''); setShowFriday(false);
  }, [open, branch, form]);

  useEffect(() => {
    if (open) {
      supabase.from('applications').select('*').then(({ data }) => setGlobalApps(data || []));
    }
  }, [open]);

  useEffect(() => { if (!city) form.setValue('district', ''); }, [city, form]);

  async function handleParseMapsUrl() {
    if (!mapsUrl.trim()) { toast({ variant: 'destructive', title: 'الصق رابط أولاً' }); return; }
    setParsingMaps(true);
    try {
      const r = await extractFromGoogleMapsUrl(mapsUrl.trim());
      if (r) {
        form.setValue('latitude', r.latitude, { shouldDirty: true });
        form.setValue('longitude', r.longitude, { shouldDirty: true });
        toast({ title: 'تم استخراج الموقع' });
        setMapsUrl('');
      } else {
        toast({ variant: 'destructive', title: 'لم يتم العثور على إحداثيات' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'فشل قراءة الرابط' });
    } finally {
      setParsingMaps(false);
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
        toast({ title: 'تم التحديث' });
      } else {
        const maxBranches = user?.entitlements?.maxBranches ?? 1;
        const { count } = await supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId);
        if ((count ?? 0) >= maxBranches) {
          toast({
            variant: 'destructive',
            title: 'وصلت للحد الأقصى من الفروع',
            description: `باقتك الحالية (${user?.entitlements?.planName || ''}) تسمح بحد أقصى ${maxBranches} فرع. رقّي باقتك لإضافة المزيد.`,
          });
          setSaving(false);
          return;
        }

        const { error } = await supabase.from('branches').insert({ id: crypto.randomUUID(), ...data });
        if (error) throw error;
        toast({ title: 'تمت الإضافة' });
      }

      syncPublicPage(restaurantId).catch(() => {});
      onSaved?.();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'خطأ', description: e instanceof Error ? e.message : String(e) });
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
              <h2 className="text-base font-bold text-gray-900">{isEdit ? 'تعديل الفرع' : 'إضافة فرع جديد'}</h2>
              <p className="text-xs text-gray-600 mt-0.5">{isEdit ? 'عدّل البيانات ثم احفظ' : 'أدخل بيانات الفرع'}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">اسم الفرع</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: فرع العليا" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={saving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* City & District */}
            <div className="grid grid-cols-2 gap-3">
              {/* City Searchable */}
              <div className="space-y-1.5">
                <FormLabel className="text-xs text-gray-600">المدينة</FormLabel>
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
                    placeholder="ابحث عن مدينة..."
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
                          className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* District Searchable */}
              <div className="space-y-1.5">
                <FormLabel className="text-xs text-gray-600">الحي</FormLabel>
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
                    placeholder={city ? "ابحث عن حي..." : "اختر المدينة أولاً"}
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
                          className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
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
                <FormLabel className="text-xs text-gray-600">رقم الجوال <span className="text-gray-600">(اختياري)</span></FormLabel>
                <FormControl>
                  <Input placeholder="05XXXXXXXX" {...field} className="h-10 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={saving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Opening Hours */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">أوقات العمل</FormLabel>
              <div className="flex items-end gap-2">
                <TimePicker value={allDaysOpen} onChange={(v) => { setAllDaysOpen(v); form.setValue('opening_hours', generateHoursText(v, allDaysClose, fridayOpen, fridayClose), { shouldDirty: true }); }} label="الفتح" className="flex-1" />
                <span className="text-xs text-gray-600 mb-3">—</span>
                <TimePicker value={allDaysClose} onChange={(v) => { setAllDaysClose(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, v, fridayOpen, fridayClose), { shouldDirty: true }); }} label="الإغلاق" className="flex-1" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showFriday} onChange={(e) => { setShowFriday(e.target.checked); if (!e.target.checked) { setFridayOpen(''); setFridayClose(''); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, '', ''), { shouldDirty: true }); } }} className="w-3.5 h-3.5 rounded border-gray-300" />
                <span className="text-[11px] text-gray-600">الجمعة مختلفة</span>
              </label>

              {showFriday && (
                <div className="flex items-end gap-2">
                  <TimePicker value={fridayOpen} onChange={(v) => { setFridayOpen(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, v, fridayClose), { shouldDirty: true }); }} label="فتح" className="flex-1" />
                  <span className="text-xs text-gray-600 mb-3">—</span>
                  <TimePicker value={fridayClose} onChange={(v) => { setFridayClose(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, fridayOpen, v), { shouldDirty: true }); }} label="إغلاق" className="flex-1" />
                </div>
              )}

              {allDaysOpen && allDaysClose && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-600">{generateHoursText(allDaysOpen, allDaysClose, fridayOpen, fridayClose)}</p>
                </div>
              )}
            </div>

            {/* Location - URL only */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">موقع الفرع</FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="الصق رابط جوجل مابز..."
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className="h-10 text-xs rounded-xl border-gray-200 flex-1"
                  dir="ltr"
                />
                <button type="button" onClick={handleParseMapsUrl} disabled={parsingMaps || !mapsUrl.trim()}
                  className="h-10 px-3 rounded-xl border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                  {parsingMaps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5 text-blue-500" />}
                  استخراج
                </button>
              </div>
              {form.watch('latitude') && form.watch('longitude') && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${form.watch('latitude')},${form.watch('longitude')}`} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> تم تحديد الموقع ✓
                </a>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">الحالة</FormLabel>
              <div className="flex gap-2">
                <button type="button" onClick={() => form.setValue('status', 'active')}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium transition-all border ${form.watch('status') === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  نشط
                </button>
                <button type="button" onClick={() => form.setValue('status', 'inactive')}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium transition-all border ${form.watch('status') === 'inactive' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  غير نشط
                </button>
              </div>
            </div>

            {/* Branch Delivery Apps */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">تطبيقات التوصيل</FormLabel>
              <p className="text-[10px] text-gray-600">أضف روابط التطبيقات الخاصة بهذا الفرع</p>
              
              {globalApps.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {globalApps.map(app => {
                    const isAdded = branchApps.some((a: any) => a.platformId === app.id);
                    return (
                      <button key={app.id} type="button"
                        onClick={() => {
                          if (isAdded) {
                            setBranchApps(branchApps.filter((a: any) => a.platformId !== app.id));
                          } else {
                            setBranchApps([...branchApps, {
                              id: `branch-app-${app.id}`,
                              type: 'global',
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
                    <Input dir="ltr" value={app.value} placeholder="https://..."
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
                إلغاء
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة الفرع'}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
