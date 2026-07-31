'use client';

import { useState, useTransition, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "../ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ImageIcon, UploadCloud, X, Calendar, ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { syncPublicPage } from '@/lib/public-pages';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { MenuItem } from "@/lib/types";
import { Badge } from "../ui/badge";
import { Dialog as GalleryDialog, DialogContent as GalleryDialogContent } from "@/components/ui/dialog";
import { StorageImage } from "../shared/StorageImage";
import { ImageGallery } from "../studio/ImageGallery";

const formSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().min(10, "الوصف يجب أن يكون 10 أحرف على الأقل"),
  image_url: z.string().optional().or(z.literal("")),
  external_link: z.string().url({ message: "أدخل رابطاً صحيحاً" }).optional().or(z.literal('')),
  valid_until: z.date({ required_error: "تاريخ الانتهاء مطلوب" }),
  status: z.enum(['active', 'expired']).default('active'),
  items: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditOfferDialogProps {
  children: React.ReactNode;
  offer?: any;
  onSave?: () => void;
  restaurantId?: string;
  userId?: string;
}

export function EditOfferDialog({ children, offer, onSave, restaurantId, userId }: EditOfferDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const { toast } = useToast();
  const isEditing = !!offer;
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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
        valid_until: offer.valid_until ? new Date(offer.valid_until) : new Date(),
        items: offer.items || [],
        image_url: offer.image_url || "",
        external_link: offer.external_link || "",
      } : {
        title: "",
        description: "",
        image_url: "",
        external_link: "",
        valid_until: undefined,
        status: 'active',
        items: [],
      });
      setImageFile(null);
      setImagePreview(offer?.image_url || null);
    }
  }, [open, offer, isEditing, form, restaurantId]);

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
        toast({ title: "الصورة كبيرة جداً", description: "اختر صورة أقل من 4 ميجابايت", variant: "destructive" });
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
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `restaurants/${restaurantId}/offers/offer-${Date.now()}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('restaurant-assets')
            .upload(fileName, imageFile, { upsert: true });
          if (uploadError) throw uploadError;
          finalImageUrl = uploadData.path;
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

        toast({ title: `تم ${isEditing ? 'تعديل' : 'إضافة'} العرض` });
        syncPublicPage(restaurantId).catch(() => {});
        onSave?.();
        setOpen(false);
      } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ", description: error.message });
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
          {/* Hero Image */}
          <div className="relative w-full aspect-[16/9] bg-gray-100 overflow-hidden">
            {imagePreview ? (
              <>
                <StorageImage imagePath={imagePreview} alt="صورة العرض" fill className="object-cover" sizes="600px" />
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
                  <ImageIcon className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-400">أضف صورة للعرض</p>
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
                من ملفاتي
              </button>
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
                من المعرض
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
                    <FormLabel className="text-xs text-gray-500">عنوان العرض</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثال: خصم 30% على الوجبات"
                        {...field}
                        className="h-11 rounded-xl border-gray-200 text-sm"
                        disabled={isSaving}
                      />
                    </FormControl>
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
                    <FormLabel className="text-xs text-gray-500">وصف العرض</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="صف العرض باختصار..."
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

              {/* Link */}
              <FormField
                control={form.control}
                name="external_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500">رابط خارجي <span className="text-gray-300">(اختياري)</span></FormLabel>
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
                    <FormLabel className="text-xs text-gray-500">المنتجات <span className="text-gray-300">(اختياري)</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <button
                            type="button"
                            className={cn(
                              "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-right flex items-center justify-between text-sm transition-colors hover:border-gray-300",
                              !field.value?.length && "text-gray-400"
                            )}
                          >
                            <div className="flex flex-wrap gap-1 overflow-hidden">
                              {field.value?.length ? (
                                field.value.slice(0, 2).map(itemId => (
                                  <Badge key={itemId} variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {menuItems.find(item => item.id === itemId)?.name}
                                  </Badge>
                                ))
                              ) : (
                                <span>اختر المنتجات...</span>
                              )}
                              {(field.value?.length ?? 0) > 2 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{(field.value?.length ?? 0) - 2}</Badge>
                              )}
                            </div>
                            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" dir="rtl">
                        <Command>
                          <CommandInput placeholder="ابحث..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>لا يوجد منتجات</CommandEmpty>
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
                                  <span className="mr-2">{item.name}</span>
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

              {/* Date */}
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500">صالح حتى</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined;
                          field.onChange(date);
                        }}
                        className="h-10 rounded-xl border-gray-200 text-sm"
                        disabled={isSaving}
                        dir="ltr"
                      />
                    </FormControl>
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
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSaving ? "جاري الحفظ..." : isEditing ? "حفظ التعديلات" : "إضافة العرض"}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Gallery Dialog */}
      <GalleryDialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <GalleryDialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-2xl" dir="rtl">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-bold">اختر صورة من المعرض</h2>
            <p className="text-sm text-gray-400 mt-1">اضغط على الصورة لاختيارها</p>
          </div>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-6">
            <ImageGallery onImageSelect={handleImageSelect} />
          </div>
        </GalleryDialogContent>
      </GalleryDialog>
    </>
  );
}
