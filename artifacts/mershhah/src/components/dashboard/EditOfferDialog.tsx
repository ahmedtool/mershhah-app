'use client';

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "../ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ImageIcon, UploadCloud, X, CalendarIcon, ChevronDown, Check, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { uploadToImageKit } from "@/lib/imagekit";
import { syncPublicPage } from '@/lib/public-pages';
import { translateText } from '@/lib/translate-text';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { MenuItem, Branch } from "@/lib/types";
import { Badge } from "../ui/badge";
import { Dialog as GalleryDialog, DialogContent as GalleryDialogContent } from "@/components/ui/dialog";
import { StorageImage } from "../shared/StorageImage";
import { ImageGallery } from "../studio/ImageGallery";
import { useLanguage } from "@/components/shared/LanguageContext";

function buildOfferSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(2, t('offers.titleRequired')),
    title_en: z.string().optional(),
    description: z.string().min(10, t('offers.descriptionMinLength')),
    description_en: z.string().optional(),
    image_url: z.string().optional().or(z.literal("")),
    external_link: z.string().url({ message: t('offers.enterValidLink') }).optional().or(z.literal('')),
    valid_until: z.date({ required_error: t('offers.expiryDateRequired') }),
    status: z.enum(['active', 'expired']).default('active'),
    items: z.array(z.string()).optional(),
    branch_id: z.string().nullable().optional(),
    show_text_to_visitors: z.boolean().default(true),
  });
}

type FormValues = z.infer<ReturnType<typeof buildOfferSchema>>;

interface EditOfferDialogProps {
  children: React.ReactNode;
  offer?: any;
  // Pre-fills a brand-new offer (e.g. from the marketing calendar's "إنشاء
  // عرض" button) without switching the dialog into edit mode - only `offer`
  // does that, since onSubmit uses `!!offer` to decide insert vs update.
  initialValues?: { title?: string; description?: string };
  defaultOpen?: boolean;
  onSave?: () => void;
  restaurantId?: string;
  userId?: string;
  branches?: Branch[];
}

export function EditOfferDialog({ children, offer, initialValues, defaultOpen, onSave, restaurantId, userId, branches = [] }: EditOfferDialogProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [isSaving, startSaving] = useTransition();
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const isEditing = !!offer;
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isTranslatingTitle, setIsTranslatingTitle] = useState(false);
  const [isTranslatingDescription, setIsTranslatingDescription] = useState(false);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const offerSchema = useMemo(() => buildOfferSchema(t), [t]);

  const cities = useMemo(
    () => [...new Set(branches.map((b) => b.city).filter(Boolean))] as string[],
    [branches],
  );
  const cityLabelOf = (city: string) => {
    const withEn = branches.find((b) => b.city === city && b.city_en);
    return (dir === 'ltr' && withEn?.city_en) || city;
  };
  const visibleBranches = cityFilter ? branches.filter((b) => b.city === cityFilter) : branches;

  async function handleTranslateTitle() {
    const title = form.getValues('title');
    if (!title.trim()) return;
    setIsTranslatingTitle(true);
    try {
      const title_en = await translateText(title);
      form.setValue('title_en', title_en, { shouldValidate: true });
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('menuItem.translationFailed'), description: error.message });
    } finally {
      setIsTranslatingTitle(false);
    }
  }

  async function handleTranslateDescription() {
    const description = form.getValues('description');
    if (!description.trim()) return;
    setIsTranslatingDescription(true);
    try {
      const description_en = await translateText(description);
      form.setValue('description_en', description_en, { shouldValidate: true });
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('menuItem.translationFailed'), description: error.message });
    } finally {
      setIsTranslatingDescription(false);
    }
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(offerSchema),
  });

  useEffect(() => {
    const fetchMenuItems = async () => {
      if (restaurantId) {
        const { data } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', restaurantId);
        setMenuItems((data || []) as MenuItem[]);
      }
    };

    if (open) {
      fetchMenuItems();
      form.reset(isEditing ? {
        ...offer,
        title_en: offer.title_en || "",
        description_en: offer.description_en || "",
        valid_until: offer.valid_until ? new Date(offer.valid_until) : new Date(),
        items: offer.items || [],
        image_url: offer.image_url || "",
        external_link: offer.external_link || "",
        branch_id: offer.branch_id ?? null,
        show_text_to_visitors: offer.show_text_to_visitors !== false,
      } : {
        title: initialValues?.title || "",
        title_en: "",
        description: initialValues?.description || "",
        description_en: "",
        image_url: "",
        external_link: "",
        valid_until: undefined,
        status: 'active',
        items: [],
        branch_id: null,
        show_text_to_visitors: true,
      });
      setImageFile(null);
      setImagePreview(offer?.image_url || null);
    }
    // Deliberately re-initializes the form only when the dialog opens (or
    // the restaurant/edit-vs-create mode changes), not on every `offer`
    // reference change - the parent list refetches on ANY realtime change to
    // the "offers" table (e.g. a visitor's view incrementing views_count on
    // a DIFFERENT field), which produces a new `offer` object for the same
    // row. Resetting on that would silently discard whatever the owner is
    // still typing/picking in this dialog before they hit save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing, form, restaurantId]);

  const handleImageSelect = (imagePath: string) => {
    form.setValue('image_url', imagePath, { shouldValidate: true });
    setImagePreview(imagePath);
    setImageFile(null);
    setGalleryOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast({ title: t('offers.imageTooLarge'), description: t('offers.chooseSmallerImage'), variant: "destructive" });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      form.setValue('image_url', '', { shouldValidate: false });
    }
  };

  async function onSubmit(values: FormValues) {
    if (!restaurantId) return;

    startSaving(async () => {
      try {
        let finalImageUrl = values.image_url;

        if (imageFile) {
          finalImageUrl = await uploadToImageKit(imageFile, `restaurants/${restaurantId}/offers`);
        }

        const offerData: any = {
          ...values,
          valid_until: values.valid_until.toISOString(),
          image_url: finalImageUrl,
          restaurant_id: restaurantId,
        };

        if (!isEditing) {
          offerData.views_count = 0;
          offerData.clicks_count = 0;
          offerData.link_clicks_count = 0;
        }

        if (isEditing) {
          const { error } = await supabase.from('offers').update(offerData).eq('id', offer.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('offers').insert(offerData);
          if (error) throw error;
        }

        toast({ title: isEditing ? t('offers.offerUpdatedToast') : t('offers.offerAddedToast') });
        syncPublicPage(restaurantId).catch(() => {});
        onSave?.();
        setOpen(false);
      } catch (error: any) {
        toast({ variant: "destructive", title: t('common.errorTitle'), description: error.message });
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir={dir}>
          {/* Hero Image — aspect-[16/8] matches the public hub page's offer
              banner exactly, so what the owner crops/previews here is
              pixel-for-pixel what customers see, not a different frame. */}
          <div className="relative w-full aspect-[16/8] bg-gray-100 overflow-hidden">
            {imagePreview ? (
              <>
                <StorageImage imagePath={imagePreview} alt={t('offers.offerImageAlt')} fill className="object-cover" sizes="600px" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null); form.setValue('image_url', ''); }}
                  className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-200 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-600">{t('offers.addOfferImage')}</p>
                <p className="text-[11px] text-gray-500">{t('offers.recommendedImageSize')}</p>
              </div>
            )}
          </div>

          {/* Image Actions */}
          {!imagePreview && (
            <div className="flex gap-2 px-5 pt-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <UploadCloud className="h-4 w-4" />
                {t('offers.fromMyFiles')}
              </button>
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
                {t('offers.fromGallery')}
              </button>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">{t('offers.offerTitle')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('offers.offerTitlePlaceholder')}
                        {...field}
                        className="h-11 rounded-xl border-gray-200 text-sm"
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title_en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">{t('offers.offerTitle')} <span className="text-gray-600">({t('menuItem.english')})</span></FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input dir="ltr" placeholder="e.g. 20% off this weekend" {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                      </FormControl>
                      <button type="button" onClick={handleTranslateTitle} disabled={isSaving || isTranslatingTitle}
                        className="h-11 w-11 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-50"
                        title={t('menuItem.translateAuto')}>
                        {isTranslatingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      </button>
                    </div>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">{t('offers.offerDescriptionLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('offers.offerDescriptionPlaceholder')}
                        {...field}
                        rows={3}
                        className="rounded-xl border-gray-200 text-sm resize-none min-h-[80px]"
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description_en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">{t('offers.offerDescriptionLabel')} <span className="text-gray-600">({t('menuItem.english')})</span></FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Textarea dir="ltr" placeholder="Describe the offer in English" {...field} rows={3} className="rounded-xl border-gray-200 text-sm resize-none min-h-[80px]" disabled={isSaving} />
                      </FormControl>
                      <button type="button" onClick={handleTranslateDescription} disabled={isSaving || isTranslatingDescription}
                        className="h-11 w-11 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-50 self-start"
                        title={t('menuItem.translateAuto')}>
                        {isTranslatingDescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      </button>
                    </div>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              {/* Visitor text visibility */}
              <FormField
                control={form.control}
                name="show_text_to_visitors"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                      <div>
                        <p className="text-xs font-bold text-gray-900">{t('offers.showTextToVisitors')}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{t('offers.showTextToVisitorsHint')}</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSaving} />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {/* Link */}
              <FormField
                control={form.control}
                name="external_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">{t('offers.externalLink')} <span className="text-gray-600">({t('common.optional')})</span></FormLabel>
                    <FormControl>
                      <Input
                        dir="ltr"
                        placeholder="https://..."
                        {...field}
                        className="h-10 rounded-xl border-gray-200 text-sm"
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              {/* Products */}
              <FormField
                control={form.control}
                name="items"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">{t('offers.products')} <span className="text-gray-600">({t('common.optional')})</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <button
                            type="button"
                            className={cn(
                              "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 flex items-center justify-between text-sm transition-colors hover:border-gray-300",
                              dir === 'rtl' ? 'text-right' : 'text-left',
                              !field.value?.length && "text-gray-600"
                            )}
                          >
                            <div className="flex flex-wrap gap-1 overflow-hidden">
                              {field.value?.length ? (
                                field.value.slice(0, 2).map(itemId => (
                                  <Badge key={itemId} variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {(() => {
                                      const item = menuItems.find(i => i.id === itemId);
                                      return (dir === 'ltr' && item?.name_en) || item?.name;
                                    })()}
                                  </Badge>
                                ))
                              ) : (
                                <span>{t('offers.chooseProductsPlaceholder')}</span>
                              )}
                              {(field.value?.length ?? 0) > 2 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{(field.value?.length ?? 0) - 2}</Badge>
                              )}
                            </div>
                            <ChevronDown className="h-4 w-4 text-gray-600 shrink-0" />
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" dir={dir}>
                        <Command>
                          <CommandInput placeholder={t('offers.searchPlaceholder')} className="h-9" />
                          <CommandList>
                            <CommandEmpty>{t('offers.noProducts')}</CommandEmpty>
                            <CommandGroup>
                              {menuItems.map((item) => (
                                <CommandItem
                                  value={item.name}
                                  key={item.id}
                                  onSelect={() => {
                                    const current = field.value || [];
                                    const next = current.includes(item.id)
                                      ? current.filter(id => id !== item.id)
                                      : [...current, item.id];
                                    field.onChange(next);
                                  }}
                                >
                                  <Check className={cn("h-4 w-4 shrink-0", field.value?.includes(item.id) ? "opacity-100" : "opacity-0")} />
                                  <span className="ms-2">{(dir === 'ltr' && item.name_en) || item.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              {/* Branch targeting */}
              {branches.length > 0 && (
                <FormField
                  control={form.control}
                  name="branch_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-600">{t('offers.showsIn')} <span className="text-gray-600">({t('common.optional')})</span></FormLabel>
                      {cities.length > 1 && (
                        <Select value={cityFilter ?? '__all__'} onValueChange={(v) => setCityFilter(v === '__all__' ? null : v)}>
                          <SelectTrigger className="h-9 rounded-xl border-gray-200 text-xs mb-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">{t('offers.allCitiesOption')}</SelectItem>
                            {cities.map((city) => (
                              <SelectItem key={city} value={city}>{cityLabelOf(city)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => field.onChange(null)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors",
                            !field.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          {t('offers.allBranchesOption')}
                        </button>
                        {visibleBranches.map((branch) => (
                          <button
                            key={branch.id}
                            type="button"
                            onClick={() => field.onChange(branch.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors",
                              field.value === branch.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            {(dir === 'ltr' && branch.name_en) || branch.name}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-600">{t('offers.branchTargetingNote')}</p>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              )}

              {/* Date */}
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">{t('offers.validUntilLabel')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <button
                            type="button"
                            disabled={isSaving}
                            className={cn(
                              "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 flex items-center gap-2 text-sm transition-colors hover:border-gray-300 disabled:opacity-50",
                              dir === 'rtl' ? 'text-right' : 'text-left',
                              !field.value && "text-gray-600"
                            )}
                          >
                            <CalendarIcon className="h-4 w-4 text-gray-600 shrink-0" />
                            {field.value ? format(new Date(field.value), "d MMMM yyyy", { locale: dir === 'ltr' ? enUS : arLocale }) : t('offers.pickExpiryDate')}
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={{ before: new Date() }}
                          locale={dir === 'ltr' ? enUS : arLocale}
                          dir={dir}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

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
                  disabled={isSaving}
                  className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSaving ? t('common.saving') : isEditing ? t('common.saveChanges') : t('offers.addOfferSubmit')}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Gallery Dialog */}
      <GalleryDialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <GalleryDialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-2xl" dir={dir}>
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-bold">{t('offers.chooseImageFromGalleryTitle')}</h2>
            <p className="text-sm text-gray-600 mt-1">{t('offers.clickImageToSelect')}</p>
          </div>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-6">
            <ImageGallery onImageSelect={handleImageSelect} />
          </div>
        </GalleryDialogContent>
      </GalleryDialog>
    </>
  );
}
