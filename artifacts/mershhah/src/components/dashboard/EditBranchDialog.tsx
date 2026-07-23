'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Crosshair, Link as LinkIcon } from 'lucide-react';
import { TimePicker } from '@/components/ui/time-picker';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { geocodeAddress, extractFromGoogleMapsUrl } from '@/lib/geocoding';
import saGeodata from '@/data/sa-geodata.json';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Branch } from '@/lib/types';

const schema = z.object({
  name: z.string().min(2, 'اسم الفرع مطلوب'),
  city: z.string().min(2, 'اختر المدينة'),
  district: z.string().min(2, 'اختر الحي'),
  address: z.string().min(5, 'العنوان مطلوب'),
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
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapsUrl, setMapsUrl] = useState('');
  const [parsingMaps, setParsingMaps] = useState(false);
  const [showFriday, setShowFriday] = useState(false);
  const isEdit = Boolean(branch?.id);
  const [allDaysOpen, setAllDaysOpen] = useState('');
  const [allDaysClose, setAllDaysClose] = useState('');
  const [fridayOpen, setFridayOpen] = useState('');
  const [fridayClose, setFridayClose] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', city: '', district: '', address: '', phone: '', opening_hours: '',
      status: 'active', latitude: null, longitude: null,
    },
  });

  const city = form.watch('city');
  const districts = (saGeodata as Record<string, string[]>)[city] ?? [];

  useEffect(() => {
    if (!open) return;
    if (branch) {
      form.reset({
        name: branch.name, city: branch.city, district: branch.district,
        address: branch.address, phone: branch.phone ?? '', opening_hours: branch.opening_hours ?? '',
        status: branch.status ?? 'active', latitude: branch.latitude ?? null, longitude: branch.longitude ?? null,
      });
      setAllDaysOpen(''); setAllDaysClose(''); setFridayOpen(''); setFridayClose(''); setShowFriday(false);
    } else {
      form.reset({ name: '', city: '', district: '', address: '', phone: '', opening_hours: '', status: 'active', latitude: null, longitude: null });
      setAllDaysOpen(''); setAllDaysClose(''); setFridayOpen(''); setFridayClose(''); setShowFriday(false);
    }
  }, [open, branch, form]);

  useEffect(() => { if (!city) form.setValue('district', ''); }, [city, form]);

  async function handleGeocode() {
    const addr = form.getValues('address');
    const full = [addr, form.getValues('district'), city, 'السعودية'].filter(Boolean).join(', ');
    if (full.length < 5) { toast({ variant: 'destructive', title: 'أدخل العنوان أولاً' }); return; }
    setGeocoding(true);
    try {
      const r = await geocodeAddress(full);
      if (r) { form.setValue('latitude', r.latitude, { shouldDirty: true }); form.setValue('longitude', r.longitude, { shouldDirty: true }); toast({ title: 'تم التحويل' }); }
      else toast({ variant: 'destructive', title: 'لم يتم العثور' });
    } catch { toast({ variant: 'destructive', title: 'فشل التحويل' }); } finally { setGeocoding(false); }
  }

  function handleLocateMe() {
    if (!navigator.geolocation) { toast({ variant: 'destructive', title: 'المتصفح لا يدعم تحديد الموقع' }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { form.setValue('latitude', pos.coords.latitude, { shouldDirty: true }); form.setValue('longitude', pos.coords.longitude, { shouldDirty: true }); setLocating(false); toast({ title: 'تم التحديد' }); },
      () => { setLocating(false); toast({ variant: 'destructive', title: 'فشل تحديد الموقع' }); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleParseMapsUrl() {
    if (!mapsUrl.trim()) { toast({ variant: 'destructive', title: 'الصق رابط أولاً' }); return; }
    setParsingMaps(true);
    try {
      const r = await extractFromGoogleMapsUrl(mapsUrl.trim());
      if (r) { form.setValue('latitude', r.latitude, { shouldDirty: true }); form.setValue('longitude', r.longitude, { shouldDirty: true }); toast({ title: 'تم الاستخراج' }); }
      else toast({ variant: 'destructive', title: 'لم يتم العثور' });
    } catch { toast({ variant: 'destructive', title: 'فشل قراءة الرابط' }); } finally { setParsingMaps(false); }
  }

  async function onSubmit(values: FormValues) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      let lat = values.latitude, lng = values.longitude;
      if (lat == null || lng == null) {
        const full = [values.address, values.district, values.city, 'السعودية'].filter(Boolean).join(', ');
        if (full.length > 5) { const geo = await geocodeAddress(full); if (geo) { lat = geo.latitude; lng = geo.longitude; form.setValue('latitude', lat, { shouldDirty: false }); form.setValue('longitude', lng, { shouldDirty: false }); } }
      }

      const data: Record<string, unknown> = { name: values.name, city: values.city, district: values.district, address: values.address, status: values.status, restaurant_id: restaurantId };
      if (values.phone?.trim()) data.phone = values.phone.trim();
      if (values.opening_hours?.trim()) data.opening_hours = values.opening_hours.trim();
      if (lat != null) data.latitude = lat;
      if (lng != null) data.longitude = lng;

      if (isEdit && branch?.id) { const { error } = await supabase.from('branches').update(data).eq('id', branch.id); if (error) throw error; toast({ title: 'تم التحديث' }); }
      else { const { error } = await supabase.from('branches').insert({ id: crypto.randomUUID(), ...data }); if (error) throw error; toast({ title: 'تمت الإضافة' }); }

      syncPublicPage(restaurantId).catch(() => {});
      onSaved?.();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'خطأ', description: e instanceof Error ? e.message : String(e) });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEdit ? 'تعديل الفرع' : 'إضافة فرع جديد'}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{isEdit ? 'عدّل البيانات ثم احفظ' : 'أدخل بيانات الفرع'}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">اسم الفرع</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: فرع العليا" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={saving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* City & District */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">المدينة</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 rounded-xl border-gray-200 text-sm"><SelectValue placeholder="اختر" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="district" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-gray-500">الحي</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!city || districts.length === 0}>
                    <FormControl>
                      <SelectTrigger className="h-10 rounded-xl border-gray-200 text-sm"><SelectValue placeholder="اختر" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>

            {/* Address */}
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">العنوان</FormLabel>
                <FormControl>
                  <Input placeholder="الشارع والحي..." {...field} className="h-10 rounded-xl border-gray-200 text-sm" disabled={saving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Phone */}
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">رقم الجوال <span className="text-gray-300">(اختياري)</span></FormLabel>
                <FormControl>
                  <Input placeholder="05XXXXXXXX" {...field} className="h-10 rounded-xl border-gray-200 text-sm" dir="ltr" disabled={saving} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Opening Hours */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-500">أوقات العمل</FormLabel>
              <div className="flex items-end gap-2">
                <TimePicker value={allDaysOpen} onChange={(v) => { setAllDaysOpen(v); form.setValue('opening_hours', generateHoursText(v, allDaysClose, fridayOpen, fridayClose), { shouldDirty: true }); }} label="الفتح" className="flex-1" />
                <span className="text-xs text-gray-300 mb-3">—</span>
                <TimePicker value={allDaysClose} onChange={(v) => { setAllDaysClose(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, v, fridayOpen, fridayClose), { shouldDirty: true }); }} label="الإغلاق" className="flex-1" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showFriday} onChange={(e) => { setShowFriday(e.target.checked); if (!e.target.checked) { setFridayOpen(''); setFridayClose(''); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, '', ''), { shouldDirty: true }); } }} className="w-3.5 h-3.5 rounded border-gray-300" />
                <span className="text-[11px] text-gray-400">الجمعة مختلفة</span>
              </label>

              {showFriday && (
                <div className="flex items-end gap-2">
                  <TimePicker value={fridayOpen} onChange={(v) => { setFridayOpen(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, v, fridayClose), { shouldDirty: true }); }} label="فتح" className="flex-1" />
                  <span className="text-xs text-gray-300 mb-3">—</span>
                  <TimePicker value={fridayClose} onChange={(v) => { setFridayClose(v); form.setValue('opening_hours', generateHoursText(allDaysOpen, allDaysClose, fridayOpen, v), { shouldDirty: true }); }} label="إغلاق" className="flex-1" />
                </div>
              )}

              {allDaysOpen && allDaysClose && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">{generateHoursText(allDaysOpen, allDaysClose, fridayOpen, fridayClose)}</p>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-500">موقع الفرع</FormLabel>

              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={handleLocateMe} disabled={locating}
                  className="h-10 rounded-xl border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                  {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5 text-emerald-500" />}
                  تحديد موقعي
                </button>
                <button type="button" onClick={handleGeocode} disabled={geocoding}
                  className="h-10 rounded-xl border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                  {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5 text-blue-500" />}
                  من العنوان
                </button>
                <button type="button" onClick={handleParseMapsUrl} disabled={parsingMaps}
                  className="h-10 rounded-xl border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                  {parsingMaps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5 text-purple-500" />}
                  من الرابط
                </button>
              </div>

              <Input placeholder="أو الصق رابط جوجل مابز هنا..." value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} className="h-9 text-xs rounded-xl border-gray-200" dir="ltr" />

              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="latitude" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input type="number" step="any" placeholder="خط العرض" {...field} value={field.value ?? ''} className="h-9 text-xs rounded-xl border-gray-200" dir="ltr" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="longitude" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input type="number" step="any" placeholder="خط الطول" {...field} value={field.value ?? ''} className="h-9 text-xs rounded-xl border-gray-200" dir="ltr" />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              {form.watch('latitude') && form.watch('longitude') && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${form.watch('latitude')},${form.watch('longitude')}`} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> فتح في خرائط جوجل
                </a>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-500">الحالة</FormLabel>
              <div className="flex gap-2">
                <button type="button" onClick={() => form.setValue('status', 'active')}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium transition-all border ${form.watch('status') === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                  نشط
                </button>
                <button type="button" onClick={() => form.setValue('status', 'inactive')}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium transition-all border ${form.watch('status') === 'inactive' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                  غير نشط
                </button>
              </div>
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
