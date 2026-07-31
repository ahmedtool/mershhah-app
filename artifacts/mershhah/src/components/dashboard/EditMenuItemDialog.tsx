'use client';

import React, { useState, useTransition, useRef, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '../ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Sparkles, Check, ChevronDown, UploadCloud, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StorageImage } from '@/components/shared/StorageImage';
import { generateMenuDescriptions } from '@/ai/flows/generate-menu-descriptions';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/lib/types';
import { syncPublicPage } from '@/lib/public-pages';

const BUCKET = 'restaurant-assets';

const sizeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'الاسم مطلوب'),
  price: z.coerce.number().min(0, 'السعر مطلوب'),
  cost: z.coerce.number().min(0, 'التكلفة مطلوبة'),
  calories: z.coerce.number().optional(),
});

const COMMON_ALLERGENS = [
  { id: 'nuts', label: 'مكسرات', icon: '🥜' },
  { id: 'milk', label: 'حليب', icon: '🥛' },
  { id: 'eggs', label: 'بيض', icon: '🥚' },
  { id: 'wheat', label: 'قمح', icon: '🌾' },
  { id: 'fish', label: 'سمك', icon: '🐟' },
  { id: 'shellfish', label: 'محار', icon: '🦐' },
  { id: 'soy', label: 'فول الصويا', icon: '🫘' },
  { id: 'sesame', label: 'سمسم', icon: '⚪' },
  { id: 'gluten', label: 'غلوتين', icon: '🍞' },
];

const formSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  description: z.string().optional().or(z.literal('')),
  image_url: z.string().optional().or(z.literal('')),
  category: z.string().min(2, 'التصنيف مطلوب'),
  sizes: z.array(sizeSchema).min(1, 'أضف حجماً واحداً على الأقل'),
  status: z.enum(['available', 'unavailable']).default('available'),
  calories: z.coerce.number().min(0).optional().or(z.literal(0)),
  allergens: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof formSchema>;

interface EditMenuItemDialogProps {
  children: React.ReactNode;
  menuItem?: any;
  menuItems?: MenuItem[];
  onSave?: () => void;
  restaurantId?: string | null;
  userId?: string | null;
  itemCount?: number;
}

const isToday = (d?: Date) => {
  if (!d) return false;
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
};

export function EditMenuItemDialog({
  children, menuItem, menuItems, onSave, restaurantId, userId, itemCount = 0,
}: EditMenuItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isGeneratingDesc, startGeneratingDesc] = useTransition();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [descGenerated, setDescGenerated] = useState(false);
  const { toast } = useToast();
  const isEditing = !!menuItem;

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const uniqueCategories = useMemo(() => {
    if (!menuItems) return [];
    return [...new Set(menuItems.map(i => i.category).filter(Boolean))];
  }, [menuItems]);

  useEffect(() => {
    if (open) {
      const defaultSizes = [{ id: `s-${Date.now()}`, name: 'عادي', price: 0, cost: 0, calories: 0 }];
      const sizes = menuItem?.sizes?.length
        ? menuItem.sizes.map((s: any) => ({ ...s, id: s.id || `s-${Math.random()}`, cost: s.cost || 0 }))
        : defaultSizes;

      form.reset(isEditing ? {
        name: menuItem.name, description: menuItem.description || '',
        category: menuItem.category || '', image_url: menuItem.image_url || '',
        sizes, status: menuItem.status || 'available',
        calories: menuItem.calories || 0,
        allergens: menuItem.allergens || [],
      } : {
        name: '', description: '', category: '', image_url: '', sizes: defaultSizes, status: 'available',
        calories: 0, allergens: [],
      });
      setImageFile(null);
      setImagePreview(menuItem?.image_url || null);
      setDescGenerated(false);
    }
  }, [open, menuItem, isEditing, form]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'sizes' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast({ title: 'الصورة كبيرة جداً', description: 'اختر صورة أقل من 4 ميجابايت', variant: 'destructive' });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleGenerateDesc = async () => {
    const name = form.getValues('name');
    if (!name) { toast({ title: 'أدخل اسم الطبق أولاً', variant: 'destructive' }); return; }

    if (isEditing && menuItem?.id) {
      const { data } = await supabase.from('menu_items').select('description_last_generated_at').eq('id', menuItem.id).single();
      if (data?.description_last_generated_at && isToday(new Date(data.description_last_generated_at))) {
        toast({ title: 'وصلت للحد اليومي', description: 'وصف واحد فقط كل يوم', variant: 'destructive' });
        return;
      }
    }

    startGeneratingDesc(async () => {
      try {
        const result = await generateMenuDescriptions({ items: [{ name, category: form.getValues('category') }] });
        form.setValue('description', result.items?.[0]?.description ?? '', { shouldValidate: true });
        setDescGenerated(true);
        toast({ title: 'تم إنشاء الوصف' });
      } catch (e: any) {
        toast({ title: 'فشل', description: e.message, variant: 'destructive' });
      }
    });
  };

  async function onSubmit(values: FormValues) {
    if (!restaurantId || !userId) return;
    startSaving(async () => {
      try {
        let imgUrl = values.image_url;
        if (imageFile) {
          const ext = imageFile.name.split('.').pop();
          const path = `restaurants/${restaurantId}/menu_items/${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from(BUCKET).upload(path, imageFile);
          if (error) throw error;
          imgUrl = path;
        }

        const data: any = { ...values, image_url: imgUrl, restaurant_id: restaurantId };
        if (descGenerated) data.description_last_generated_at = new Date().toISOString();

        if (isEditing) {
          const { error } = await supabase.from('menu_items').update(data).eq('id', menuItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('menu_items').insert({ ...data, id: crypto.randomUUID(), position: itemCount, created_at: new Date().toISOString() });
          if (error) throw error;
        }

        toast({ title: isEditing ? 'تم التعديل' : 'تمت الإضافة' });
        syncPublicPage(restaurantId).catch(() => {});
        onSave?.();
        setOpen(false);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message });
      }
    });
  }

  const pending = isSaving || isGeneratingDesc;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
        {/* Hero Image */}
        <div className="relative w-full aspect-[16/9] bg-gray-100 overflow-hidden">
          {imagePreview ? (
            <>
              <StorageImage imagePath={imagePreview} alt="صورة الطبق" fill className="object-cover" sizes="600px" />
              <button
                type="button"
                onClick={() => { setImagePreview(null); setImageFile(null); }}
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-200/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-14 h-14 rounded-2xl bg-gray-200 flex items-center justify-center">
                <UploadCloud className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400">اضغط لرفع صورة</p>
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">اسم الطبق</FormLabel>
                <FormControl>
                  <Input placeholder="مثال: كباب لحم" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={pending} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs text-gray-500">الوصف</FormLabel>
                  <button
                    type="button"
                    onClick={handleGenerateDesc}
                    disabled={pending}
                    className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    وصف بالذكاء الاصطناعي
                  </button>
                </div>
                <FormControl>
                  <Textarea placeholder="وصف جذاب للطبق..." {...field} rows={2} className="rounded-xl border-gray-200 text-sm resize-none min-h-[72px]" disabled={pending} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Category */}
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">التصنيف</FormLabel>
                <Popover open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <button
                        type="button"
                        className={cn(
                          "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-right flex items-center justify-between text-sm transition-colors hover:border-gray-300",
                          !field.value && "text-gray-400"
                        )}
                      >
                        <span>{field.value || "اختر أو أنشئ تصنيف..."}</span>
                        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      </button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" dir="rtl">
                    <Command filter={(v, s) => v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0}>
                      <CommandInput placeholder="ابحث أو اكتب تصنيف جديد..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>اضغط Enter للإضافة</CommandEmpty>
                        <CommandGroup>
                          {uniqueCategories.map(cat => (
                            <CommandItem value={cat} key={cat} onSelect={() => { form.setValue('category', cat); setCategoriesOpen(false); }}>
                              <Check className={cn("h-4 w-4 shrink-0", cat === field.value ? "opacity-100" : "opacity-0")} />
                              <span className="mr-2">{cat}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Sizes */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-500">الأحجام والأسعار</FormLabel>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <FormField control={form.control} name={`sizes.${idx}.name`} render={({ field }) => (
                      <Input {...field} placeholder="الحجم" className="h-9 text-xs rounded-lg border-gray-200 flex-1" disabled={pending} />
                    )} />
                    <FormField control={form.control} name={`sizes.${idx}.price`} render={({ field }) => (
                      <Input {...field} type="number" placeholder="السعر" className="h-9 text-xs rounded-lg border-gray-200 flex-1" dir="ltr" disabled={pending} />
                    )} />
                    <FormField control={form.control} name={`sizes.${idx}.cost`} render={({ field }) => (
                      <Input {...field} type="number" placeholder="التكلفة" className="h-9 text-xs rounded-lg border-gray-200 flex-1" dir="ltr" disabled={pending} />
                    )} />
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      disabled={fields.length <= 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => append({ id: `s-${Date.now()}`, name: '', price: 0, cost: 0 })}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors mt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة حجم
              </button>
            </div>

            {/* Calories */}
            <FormField control={form.control} name="calories" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-500">السعرات الحرارية <span className="text-gray-300">(اختياري)</span></FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    placeholder="مثال: 350"
                    className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900"
                    dir="ltr"
                    disabled={pending}
                  />
                </FormControl>
                <p className="text-[10px] text-gray-300">سعرات حرارية لكل حجم (اختياري)</p>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Allergens */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-500">المواد الحساسية <span className="text-gray-300">(اختياري)</span></FormLabel>
              <p className="text-[10px] text-gray-300 -mt-1">حدد المواد التي يحتويها هذا الطبق</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGENS.map((allergen) => {
                  const isSelected = form.watch('allergens')?.includes(allergen.id);
                  return (
                    <button
                      key={allergen.id}
                      type="button"
                      onClick={() => {
                        const current = form.getValues('allergens') || [];
                        if (isSelected) {
                          form.setValue('allergens', current.filter((a: string) => a !== allergen.id), { shouldValidate: true });
                        } else {
                          form.setValue('allergens', [...current, allergen.id], { shouldValidate: true });
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-bold transition-all border",
                        isSelected
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                      )}
                      disabled={pending}
                    >
                      <span>{allergen.icon}</span>
                      <span>{allergen.label}</span>
                      {isSelected && <span className="text-red-400">✓</span>}
                    </button>
                  );
                })}
              </div>
              {form.watch('allergens')?.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-red-500">
                  <span>⚠️</span>
                  <span>يحتوي على: {form.watch('allergens').map((a: string) => COMMON_ALLERGENS.find(al => al.id === a)?.label).filter(Boolean).join('، ')}</span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-500">الحالة</FormLabel>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue('status', 'available')}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-xs font-medium transition-all border",
                    form.watch('status') === 'available'
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                  )}
                >
                  متاح
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('status', 'unavailable')}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-xs font-medium transition-all border",
                    form.watch('status') === 'unavailable'
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                  )}
                >
                  غير متاح
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? "جاري الحفظ..." : isEditing ? "حفظ التعديلات" : "إضافة الطبق"}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
