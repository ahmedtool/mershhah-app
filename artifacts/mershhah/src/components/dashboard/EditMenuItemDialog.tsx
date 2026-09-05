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
import { translateMenuItem } from '@/ai/flows/translate-menu-item';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import type { MenuItem, MenuCategory } from '@/lib/types';
import { syncPublicPage } from '@/lib/public-pages';
import { COMMON_CATEGORY_SUGGESTIONS } from '@/lib/category-suggestions';
import { useUser } from '@/hooks/useUser';
import { useLanguage } from '@/components/shared/LanguageContext';

const BUCKET = 'restaurant-assets';

const ALLERGEN_META = [
  { id: 'nuts', labelKey: 'menuItem.allergenNuts', icon: '🥜' },
  { id: 'milk', labelKey: 'menuItem.allergenMilk', icon: '🥛' },
  { id: 'eggs', labelKey: 'menuItem.allergenEggs', icon: '🥚' },
  { id: 'wheat', labelKey: 'menuItem.allergenWheat', icon: '🌾' },
  { id: 'fish', labelKey: 'menuItem.allergenFish', icon: '🐟' },
  { id: 'shellfish', labelKey: 'menuItem.allergenShellfish', icon: '🦐' },
  { id: 'soy', labelKey: 'menuItem.allergenSoy', icon: '🫘' },
  { id: 'sesame', labelKey: 'menuItem.allergenSesame', icon: '⚪' },
  { id: 'gluten', labelKey: 'menuItem.allergenGluten', icon: '🍞' },
];

function buildMenuItemSchema(t: (key: string) => string) {
  const sizeSchema = z.object({
    id: z.string(),
    name: z.string().min(1, t('menuItem.nameRequired')),
    price: z.coerce.number().min(0, t('menuItem.sizePriceRequired')),
    cost: z.coerce.number().min(0, t('menuItem.sizeCostRequired')),
    calories: z.coerce.number().optional(),
  });

  return z.object({
    name: z.string().min(2, t('menuItem.nameRequired')),
    name_en: z.string().optional().or(z.literal('')),
    description: z.string().optional().or(z.literal('')),
    description_en: z.string().optional().or(z.literal('')),
    image_url: z.string().optional().or(z.literal('')),
    category: z.string().min(2, t('menuItem.categoryRequired')),
    category_id: z.string().nullable().optional(),
    sizes: z.array(sizeSchema).min(1, t('menuItem.atLeastOneSize')),
    status: z.enum(['available', 'unavailable']).default('available'),
    calories: z.coerce.number().min(0).optional().or(z.literal(0)),
    allergens: z.array(z.string()).default([]),
  });
}

type FormValues = z.infer<ReturnType<typeof buildMenuItemSchema>>;

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
  const { t, dir, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isGeneratingDesc, startGeneratingDesc] = useTransition();
  const [isTranslating, startTranslating] = useTransition();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [descGenerated, setDescGenerated] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const isEditing = !!menuItem;
  const menuItemSchema = useMemo(() => buildMenuItemSchema(t), [t]);

  const form = useForm<FormValues>({ resolver: zodResolver(menuItemSchema) });

  useEffect(() => {
    if (open && restaurantId) {
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('position').then(({ data }: { data: any[] | null }) => {
        setCategories((data || []) as MenuCategory[]);
      });
    }
  }, [open, restaurantId]);

  useEffect(() => {
    if (open) {
      const defaultSizes = [{ id: `s-${Date.now()}`, name: 'عادي', price: 0, cost: 0, calories: 0 }];
      const sizes = menuItem?.sizes?.length
        ? menuItem.sizes.map((s: any) => ({ ...s, id: s.id || `s-${Math.random()}`, cost: s.cost || 0 }))
        : defaultSizes;

      form.reset(isEditing ? {
        name: menuItem.name, name_en: menuItem.name_en || '',
        description: menuItem.description || '', description_en: menuItem.description_en || '',
        category: menuItem.category || '', category_id: menuItem.category_id ?? null, image_url: menuItem.image_url || '',
        sizes, status: menuItem.status || 'available',
        calories: menuItem.calories || 0,
        allergens: menuItem.allergens || [],
      } : {
        name: '', name_en: '', description: '', description_en: '', category: '', category_id: null, image_url: '', sizes: defaultSizes, status: 'available',
        calories: 0, allergens: [],
      });
      setImageFile(null);
      setImagePreview(menuItem?.image_url || null);
      setDescGenerated(false);
      setCategorySearch('');
    }
  }, [open, menuItem, isEditing, form]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'sizes' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast({ title: t('offers.imageTooLarge'), description: t('offers.chooseSmallerImage'), variant: 'destructive' });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateCategory = async (name: string) => {
    if (!restaurantId || !name.trim()) return;
    setIsCreatingCategory(true);
    try {
      const { data, error } = await supabase.from('menu_categories').insert({
        restaurant_id: restaurantId,
        name: name.trim(),
        position: categories.length,
      }).select().single();
      if (error) throw error;
      setCategories((prev) => [...prev, data as MenuCategory]);
      form.setValue('category', data.name, { shouldValidate: true });
      form.setValue('category_id', data.id);
      setCategoriesOpen(false);
      setCategorySearch('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: t('common.errorTitle'), description: e.message });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleGenerateDesc = async () => {
    const name = form.getValues('name');
    if (!name) { toast({ title: t('menuItem.enterDishNameFirst'), variant: 'destructive' }); return; }

    if (isEditing && menuItem?.id) {
      const { data } = await supabase.from('menu_items').select('description_last_generated_at').eq('id', menuItem.id).single();
      if (data?.description_last_generated_at && isToday(new Date(data.description_last_generated_at))) {
        toast({ title: t('menuItem.dailyLimitReached'), description: t('menuItem.oneDescriptionPerDay'), variant: 'destructive' });
        return;
      }
    }

    startGeneratingDesc(async () => {
      try {
        const result = await generateMenuDescriptions({ items: [{ name, category: form.getValues('category') }] });
        form.setValue('description', result.items?.[0]?.description ?? '', { shouldValidate: true });
        setDescGenerated(true);
        toast({ title: t('menuItem.descriptionGenerated') });
      } catch (e: any) {
        toast({ title: t('menuItem.generationFailed'), description: e.message, variant: 'destructive' });
      }
    });
  };

  const handleTranslate = () => {
    const name = form.getValues('name');
    if (!name) { toast({ title: t('menuItem.enterDishNameFirst'), variant: 'destructive' }); return; }

    startTranslating(async () => {
      try {
        const result = await translateMenuItem({ name, description: form.getValues('description') });
        form.setValue('name_en', result.name_en ?? '', { shouldValidate: true });
        form.setValue('description_en', result.description_en ?? '', { shouldValidate: true });
        toast({ title: t('menuItem.translated') });
      } catch (e: any) {
        toast({ title: t('menuItem.translationFailed'), description: e.message, variant: 'destructive' });
      }
    });
  };

  async function onSubmit(values: FormValues) {
    if (!restaurantId || !userId) return;

    if (!isEditing) {
      const maxMenuItems = user?.entitlements?.maxMenuItems ?? 30;
      if (itemCount >= maxMenuItems) {
        toast({
          variant: 'destructive',
          title: t('menuItem.maxItemsReached'),
          description: `${t('branches.currentPlanPrefix')} (${user?.entitlements?.planName || ''}) ${t('branches.allowsMax')} ${maxMenuItems} ${t('menuItem.itemWord')}. ${t('branches.upgradeForMore')}`,
        });
        return;
      }
    }

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

        toast({ title: isEditing ? t('menuItem.itemUpdated') : t('menuItem.itemAdded') });
        syncPublicPage(restaurantId).catch(() => {});
        onSave?.();
        setOpen(false);
      } catch (e: any) {
        toast({ variant: 'destructive', title: t('common.errorTitle'), description: e.message });
      }
    });
  }

  const pending = isSaving || isGeneratingDesc || isTranslating;
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir={dir}>
        {/* Hero Image */}
        <div className="relative w-full aspect-[16/9] bg-gray-100 overflow-hidden">
          {imagePreview ? (
            <>
              <StorageImage imagePath={imagePreview} alt={t('menuItem.dishImageAlt')} fill className="object-cover" sizes="600px" />
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
                <UploadCloud className="h-6 w-6 text-gray-600" />
              </div>
              <p className="text-sm text-gray-600">{t('menuItem.clickToUploadImage')}</p>
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
                <FormLabel className="text-xs text-gray-600">{t('menuItem.dishName')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('menuItem.dishNamePlaceholder')} {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={pending} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs text-gray-600">{t('menuItem.description')}</FormLabel>
                  <button
                    type="button"
                    onClick={handleGenerateDesc}
                    disabled={pending}
                    className="flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-700 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    {t('menuItem.generateWithAi')}
                  </button>
                </div>
                <FormControl>
                  <Textarea placeholder={t('menuItem.descriptionPlaceholder')} {...field} rows={2} className="rounded-xl border-gray-200 text-sm resize-none min-h-[72px]" disabled={pending} />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* English version (optional) */}
            <div className="space-y-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
              <div className="flex items-center justify-between">
                <FormLabel className="text-xs text-gray-600">{t('menuItem.englishVersion')}</FormLabel>
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={pending}
                  className="flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-700 transition-colors"
                >
                  {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {t('menuItem.translateAuto')}
                </button>
              </div>
              <FormField control={form.control} name="name_en" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder={t('menuItem.nameEnPlaceholder')} {...field} dir="ltr" className="h-10 rounded-xl border-gray-200 bg-white text-sm" disabled={pending} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="description_en" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea placeholder={t('menuItem.descriptionEnPlaceholder')} {...field} dir="ltr" rows={2} className="rounded-xl border-gray-200 bg-white text-sm resize-none min-h-[64px]" disabled={pending} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>

            {/* Category */}
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">{t('menuItem.category')}</FormLabel>
                <Popover open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <button
                        type="button"
                        className={cn(
                          "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 flex items-center justify-between text-sm transition-colors hover:border-gray-300",
                          alignStart,
                          !field.value && "text-gray-600"
                        )}
                      >
                        <span>{field.value || t('menuItem.chooseOrCreateCategory')}</span>
                        <ChevronDown className="h-4 w-4 text-gray-600 shrink-0" />
                      </button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" dir={dir}>
                    <Command filter={(v, s) => v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0}>
                      <CommandInput placeholder={t('menuItem.searchOrCreateCategory')} className="h-9" value={categorySearch} onValueChange={setCategorySearch} />
                      <CommandList>
                        {categories.length === 0 && !categorySearch && <CommandEmpty>{t('menuItem.noCategoriesYet')}</CommandEmpty>}
                        <CommandGroup>
                          {categories.map(cat => (
                            <CommandItem value={cat.name} key={cat.id} onSelect={() => {
                              form.setValue('category', cat.name, { shouldValidate: true });
                              form.setValue('category_id', cat.id);
                              setCategoriesOpen(false);
                              setCategorySearch('');
                            }}>
                              <Check className={cn("h-4 w-4 shrink-0", cat.id === form.watch('category_id') ? "opacity-100" : "opacity-0")} />
                              <span className="ms-2">{cat.name}</span>
                            </CommandItem>
                          ))}
                          {categorySearch.trim() && !categories.some(c => c.name.toLowerCase() === categorySearch.trim().toLowerCase()) && (
                            <CommandItem value={`__create__${categorySearch}`} onSelect={() => handleCreateCategory(categorySearch)} disabled={isCreatingCategory}>
                              <Plus className="h-4 w-4 shrink-0 text-gray-600" />
                              <span className="ms-2">{t('menuItem.createCategoryPrefix')} "{categorySearch.trim()}"</span>
                            </CommandItem>
                          )}
                        </CommandGroup>
                        {(() => {
                          const existingNames = new Set(categories.map(c => c.name.toLowerCase()));
                          const q = categorySearch.trim().toLowerCase();
                          const suggestions = COMMON_CATEGORY_SUGGESTIONS.filter(name =>
                            !existingNames.has(name.toLowerCase()) && (!q || name.toLowerCase().includes(q))
                          ).slice(0, 6);
                          if (suggestions.length === 0) return null;
                          return (
                            <CommandGroup heading={t('menuItem.popularSuggestions')}>
                              {suggestions.map(name => (
                                <CommandItem key={name} value={`__suggest__${name}`} onSelect={() => handleCreateCategory(name)} disabled={isCreatingCategory}>
                                  <Plus className="h-4 w-4 shrink-0 text-gray-600" />
                                  <span className="ms-2">{name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          );
                        })()}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Sizes */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">{t('menuItem.sizesAndPrices')}</FormLabel>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <FormField control={form.control} name={`sizes.${idx}.name`} render={({ field }) => (
                      <Input {...field} placeholder={t('menuItem.sizePlaceholder')} className="h-9 text-xs rounded-lg border-gray-200 flex-1" disabled={pending} />
                    )} />
                    <FormField control={form.control} name={`sizes.${idx}.price`} render={({ field }) => (
                      <Input {...field} type="number" placeholder={t('menuItem.pricePlaceholder')} className="h-9 text-xs rounded-lg border-gray-200 flex-1" dir="ltr" disabled={pending} />
                    )} />
                    <FormField control={form.control} name={`sizes.${idx}.cost`} render={({ field }) => (
                      <Input {...field} type="number" placeholder={t('menuItem.costPlaceholder')} className="h-9 text-xs rounded-lg border-gray-200 flex-1" dir="ltr" disabled={pending} />
                    )} />
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      disabled={fields.length <= 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => append({ id: `s-${Date.now()}`, name: '', price: 0, cost: 0 })}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-700 transition-colors mt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('menuItem.addSize')}
              </button>
            </div>

            {/* Calories */}
            <FormField control={form.control} name="calories" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-gray-600">{t('menuItem.calories')} <span className="text-gray-600">({t('common.optional')})</span></FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    placeholder={t('menuItem.caloriesPlaceholder')}
                    className="h-11 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-600 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-900"
                    dir="ltr"
                    disabled={pending}
                  />
                </FormControl>
                <p className="text-[10px] text-gray-600">{t('menuItem.caloriesHint')}</p>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            {/* Allergens */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">{t('menuItem.allergensLabel')} <span className="text-gray-600">({t('common.optional')})</span></FormLabel>
              <p className="text-[10px] text-gray-600 -mt-1">{t('menuItem.allergensHint')}</p>
              <div className="flex flex-wrap gap-2">
                {ALLERGEN_META.map((allergen) => {
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
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                      )}
                      disabled={pending}
                    >
                      <span>{allergen.icon}</span>
                      <span>{t(allergen.labelKey)}</span>
                      {isSelected && <span className="text-red-400">✓</span>}
                    </button>
                  );
                })}
              </div>
              {form.watch('allergens')?.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-red-500">
                  <span>⚠️</span>
                  <span>{t('menuItem.containsPrefix')} {form.watch('allergens').map((a: string) => {
                    const meta = ALLERGEN_META.find(al => al.id === a);
                    return meta ? t(meta.labelKey) : null;
                  }).filter(Boolean).join(locale === 'ar' ? '، ' : ', ')}</span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <FormLabel className="text-xs text-gray-600">{t('common.status')}</FormLabel>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue('status', 'available')}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-xs font-medium transition-all border",
                    form.watch('status') === 'available'
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {t('menu.available')}
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('status', 'unavailable')}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-xs font-medium transition-all border",
                    form.watch('status') === 'unavailable'
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {t('menu.unavailable')}
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
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? t('common.saving') : isEditing ? t('common.saveChanges') : t('menuItem.addDishSubmit')}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
