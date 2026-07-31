'use client';

import { useState, useTransition, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, Bot, Loader2, FileCheck, Save, X, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { extractMenuFromImage } from "@/ai/flows/extract-menu-from-image";
import { supabase } from '@/lib/supabase';
import { useUser } from "@/hooks/useUser";
import { Link } from "wouter";
import { useLanguage } from "@/components/shared/LanguageContext";

interface ImportMenuDialogProps {
  children: React.ReactNode;
  restaurantId?: string | null;
  onSave: () => void;
}

type Stage = "upload" | "analyzing" | "confirm" | "saving";

export function ImportMenuDialog({ children, restaurantId, onSave }: ImportMenuDialogProps) {
  const { user } = useUser();
  const { t, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [usageStats, setUsageStats] = useState({ count: 0, limit: 3 });
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  const isPaid = user?.entitlements?.planId && user.entitlements.planId !== 'free';
  const monthlyLimit = isPaid ? 20 : 3;

  const iconMargin = isRTL ? 'ml-2' : 'mr-2';

  useEffect(() => {
    if (open && restaurantId) {
        fetchUsageStats();
    }
  }, [open, restaurantId, isPaid]);

  const fetchUsageStats = async () => {
    if (!restaurantId) return;
    setIsCheckingUsage(true);
    try {
        const { data } = await supabase
            .from('restaurants')
            .select('menu_import_monthly_count, menu_import_last_reset')
            .eq('id', restaurantId)
            .single();

        if (data) {
            let count = data.menu_import_monthly_count || 0;
            const lastReset = data.menu_import_last_reset ? new Date(data.menu_import_last_reset) : null;
            const now = new Date();
            const shouldReset = !lastReset || (now.getTime() - lastReset.getTime() > 30 * 24 * 60 * 60 * 1000);

            if (shouldReset) {
                await supabase.from('restaurants').update({
                    menu_import_monthly_count: 0,
                    menu_import_last_reset: now.toISOString(),
                }).eq('id', restaurantId);
                count = 0;
            }

            setUsageStats({ count, limit: monthlyLimit });
        }
    } catch (error) {
        console.error("Error fetching usage stats:", error);
    } finally {
        setIsCheckingUsage(false);
    }
  };

  const resetState = () => {
    setStage("upload");
    setImageFile(null);
    setImagePreview(null);
    setExtractedData([]);
    setExistingNames(new Set());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 20 * 1024 * 1024) {
            toast({
              title: isRTL ? "حجم الملف كبير" : "File too large",
              description: isRTL ? "الرجاء اختيار ملف بحجم أقل من 20 ميجابايت." : "Please choose a file smaller than 20MB.",
              variant: "destructive"
            });
            return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile || !restaurantId) return;

    if (usageStats.count >= usageStats.limit) {
        toast({
            title: isRTL ? "عذراً، انتهت محاولاتك" : "Sorry, you've run out of attempts",
            description: isPaid
                ? (isRTL ? "لقد استنفدت 20 محاولة لهذا الشهر." : "You've used all 20 attempts for this month.")
                : (isRTL ? "لقد استنفدت 3 محاولات مجانية لهذا الشهر. قم بالترقية للحصول على محاولات أكثر." : "You've used all 3 free attempts this month. Upgrade for more."),
            variant: "destructive"
        });
        return;
    }

    setStage("analyzing");

    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    reader.onload = async () => {
        try {
            const result = await extractMenuFromImage({
                imageDataUri: reader.result as string,
            });

            const extractedItems = result.items || [];

            if (extractedItems.length > 0) {
                const { data: current } = await supabase
                    .from('restaurants')
                    .select('menu_import_monthly_count')
                    .eq('id', restaurantId)
                    .single();

                await supabase.from('restaurants').update({
                    menu_import_monthly_count: (current?.menu_import_monthly_count || 0) + 1,
                }).eq('id', restaurantId);

                const { data: existing } = await supabase
                    .from('menu_items')
                    .select('name')
                    .eq('restaurant_id', restaurantId);

                const nameSet = new Set<string>((existing ?? []).map((i: any) => i.name.toLowerCase().trim()));
                setExistingNames(nameSet);
                setExtractedData(extractedItems);
                setStage("confirm");
                fetchUsageStats();
                toast({
                  title: isRTL ? "تم تحليل الملف!" : "File analyzed!",
                  description: isRTL ? `تم العثور على ${extractedItems.length} صنف.` : `Found ${extractedItems.length} items.`
                });
            } else {
                toast({
                  title: isRTL ? "لم يتم العثور على أصناف" : "No items found",
                  description: isRTL ? "حاول استخدام صورة أوضح أو ملف PDF بجودة أعلى." : "Try using a clearer image or higher quality PDF.",
                  variant: "destructive"
                });
                setStage("upload");
            }
        } catch (error: any) {
            console.error("Analysis Error:", error);
            toast({ title: isRTL ? "فشل التحليل" : "Analysis failed", description: error.message, variant: "destructive" });
            setStage("upload");
        }
    };
  };

  const handleSaveToMenu = async () => {
    if (!restaurantId || extractedData.length === 0) return;
    setStage("saving");

    try {
        const { data: existingItems, error: fetchError } = await supabase
            .from('menu_items')
            .select('id, name, sizes, calories, allergens')
            .eq('restaurant_id', restaurantId);

        if (fetchError) throw fetchError;

        const existingMap = new Map<string, typeof existingItems[number]>();
        for (const item of existingItems ?? []) {
            existingMap.set(item.name.toLowerCase().trim(), item);
        }

        const toInsert: any[] = [];
        const toUpdate: { id: string; data: any }[] = [];

        for (const item of extractedData) {
            const normalizedName = item.name.toLowerCase().trim();
            const existing = existingMap.get(normalizedName);

            const newSizes = item.sizes.map((s: any) => ({
                id: `size-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                name: s.name,
                price: s.price,
                cost: 0
            }));

            if (existing) {
                const existingPrices = JSON.stringify(existing.sizes?.map((s: any) => ({ name: s.name, price: s.price })) ?? []);
                const newPrices = JSON.stringify(item.sizes.map((s: any) => ({ name: s.name, price: s.price })));
                const pricesChanged = existingPrices !== newPrices;
                const caloriesChanged = (existing.calories ?? null) !== (item.calories ?? null);
                const allergensChanged = JSON.stringify(existing.allergens ?? []) !== JSON.stringify(item.allergens ?? []);

                if (pricesChanged || caloriesChanged || allergensChanged) {
                    const updateData: any = {};
                    if (pricesChanged) updateData.sizes = newSizes;
                    if (caloriesChanged) updateData.calories = item.calories || null;
                    if (allergensChanged) updateData.allergens = item.allergens || [];
                    toUpdate.push({ id: existing.id, data: updateData });
                }
            } else {
                toInsert.push({
                    name: item.name,
                    description: item.description || "",
                    category: item.category || 'main',
                    sizes: newSizes,
                    calories: item.calories || null,
                    allergens: item.allergens || [],
                    image_url: "",
                    status: 'available',
                    display_tags: 'none',
                    restaurant_id: restaurantId,
                    createdAt: new Date().toISOString(),
                });
            }
        }

        if (toInsert.length > 0) {
            const { error } = await supabase.from('menu_items').insert(toInsert);
            if (error) throw error;
        }

        for (const update of toUpdate) {
            const { error } = await supabase.from('menu_items').update(update.data).eq('id', update.id);
            if (error) throw error;
        }

        const skippedCount = extractedData.length - toInsert.length - toUpdate.length;

        const messages: string[] = [];
        if (toInsert.length > 0) messages.push(isRTL ? `${toInsert.length} جديد` : `${toInsert.length} new`);
        if (toUpdate.length > 0) messages.push(isRTL ? `${toUpdate.length} محدّث` : `${toUpdate.length} updated`);
        if (skippedCount > 0) messages.push(isRTL ? `${skippedCount} موجود` : `${skippedCount} unchanged`);

        toast({
          title: isRTL ? "تم الحفظ!" : "Saved!",
          description: messages.length > 0
            ? (isRTL ? `إضافة: ${messages.join(' | ')}` : `Added: ${messages.join(' | ')}`)
            : (isRTL ? `تم حفظ ${extractedData.length} صنف.` : `Saved ${extractedData.length} items.`)
        });
        onSave();
        setOpen(false);
    } catch (error: any) {
        console.error("Save error:", error);
        toast({ title: isRTL ? "فشل الحفظ" : "Save failed", description: error.message, variant: "destructive" });
        setStage("confirm");
    }
  };

  const isLimitReached = usageStats.count >= usageStats.limit;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetState(); setOpen(isOpen); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Bot className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{'استيراد المنيو بالذكاء الاصطناعي'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{'ارفع صورة أو PDF من قائمة طعامك ودع الذكاء الاصطناعي يستخرج الأصناف والأسعار.'}</p>
              </div>
            </div>
            <div className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 shrink-0">
                {isCheckingUsage ? <Loader2 className="h-3 w-3 animate-spin"/> : (
                    <>{'المحاولات:'} {usageStats.count}/{usageStats.limit}</>
                )}
            </div>
          </div>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            <motion.div key={stage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {stage === "upload" && (
                    <div className="space-y-4">
                        <div
                            className="relative w-full aspect-[4/3] border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-6 cursor-pointer hover:bg-gray-50 transition-all"
                            onClick={() => !isLimitReached && fileInputRef.current?.click()}
                        >
                              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.heic,.heif,.tiff,.tif,.bmp,.svg,.webp,.avif,.pdf" className="hidden" />
                            {imagePreview ? (
                                <img src={imagePreview} alt="Menu Preview" className="object-contain h-full w-full rounded-lg" />
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-gray-100 p-4 rounded-xl w-fit mx-auto">
                                        <UploadCloud className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <div>
                                        <p className={`font-bold text-sm text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'اضغط لرفع صورة أو ملف PDF' : 'Click to upload image or PDF'}</p>
                                        <p className={`text-[11px] text-gray-400 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'يدعم جميع صيغ الصور + PDF — حتى 20 ميجابايت' : 'Supports all image formats + PDF — up to 20MB'}</p>
                                    </div>
                                </div>
                            )}
                            {isLimitReached && <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 gap-2 rounded-xl">
                                <Lock className="h-8 w-8 text-gray-300" />
                                <p className="font-bold text-sm text-gray-900 text-center">{isRTL ? 'وصلت للحد الأقصى' : 'Monthly limit reached'}</p>
                                {!isPaid && <Button asChild size="sm" variant="outline" className="rounded-xl mt-1 h-8 text-xs"><Link href="/pricing">{isRTL ? 'اشترك للمزيد' : 'Subscribe for more'}</Link></Button>}
                            </div>}
                        </div>
                        <Button onClick={handleAnalyze} disabled={!imageFile || isLimitReached} className="w-full h-11 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-bold text-sm">
                            <Bot className={`${iconMargin} h-4 w-4`} />
                            {isRTL ? 'ابدأ قراءة الأصناف' : 'Start Reading Items'}
                        </Button>
                    </div>
                )}

                {stage === "analyzing" && (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
                        <div className="relative">
                            <Loader2 className="h-16 w-16 text-gray-200 animate-spin" />
                            <Bot className="h-7 w-7 text-gray-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-black text-gray-900">{isRTL ? 'جاري تحليل الملف...' : 'Analyzing file...'}</h3>
                            <p className="text-xs text-gray-400 max-w-xs">{isRTL ? 'يقوم الذكاء الاصطناعي بقراءة النصوص واستخراج الأصناف والأسعار.' : 'AI is reading the text and extracting items with prices.'}</p>
                        </div>
                    </div>
                )}

                 {stage === "confirm" && (
                    <div className="space-y-4">
                        {(() => {
                            const newCount = extractedData.filter(i => !existingNames.has(i.name.toLowerCase().trim())).length;
                            const existCount = extractedData.length - newCount;
                            return (
                                <div className="flex items-center justify-between bg-gray-50 border border-gray-100 p-3 rounded-xl">
                                   <div className="flex items-center gap-3">
                                       <div className="bg-gray-900 p-2 rounded-lg text-white"><FileCheck className="h-4 w-4" /></div>
                                       <div className={isRTL ? 'text-right' : 'text-left'}>
                                           <h3 className="font-bold text-sm text-gray-900">{isRTL ? 'اكتمل الاستخراج' : 'Extraction completed'}</h3>
                                           <div className="flex gap-2 mt-1">
                                               {newCount > 0 && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">{isRTL ? `${newCount} جديد` : `${newCount} new`}</span>}
                                               {existCount > 0 && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">{isRTL ? `${existCount} موجود مسبقاً` : `${existCount} exist`}</span>}
                                           </div>
                                       </div>
                                   </div>
                                   <Button variant="ghost" size="sm" onClick={resetState} className="text-gray-400 hover:text-gray-900 h-8 text-xs">
                                     <X className={`${iconMargin} h-3 w-3`}/> {isRTL ? 'إلغاء' : 'Cancel'}
                                   </Button>
                                </div>
                            );
                        })()}
                        <div className="max-h-[40vh] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                            {extractedData.map((item, index) => {
                                const isNew = !existingNames.has(item.name.toLowerCase().trim());
                                return (
                                <div key={index} className={`p-3 hover:bg-gray-50 transition-colors ${isRTL ? 'text-right' : 'text-left'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-sm text-gray-900">{item.name}</h4>
                                            {isNew
                                                ? <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{isRTL ? 'جديد' : 'NEW'}</span>
                                                : <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{isRTL ? 'موجود' : 'EXISTS'}</span>
                                            }
                                        </div>
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{item.category}</span>
                                    </div>
                                    {item.description && <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{item.description}</p>}
                                    <div className={`flex gap-1.5 flex-wrap ${isRTL ? 'justify-end' : 'justify-start'}`}>
                                        {item.sizes.map((size: any, sIndex: number) => (
                                            <span key={sIndex} className="text-[11px] font-mono font-bold text-gray-900 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">
                                                {size.name}: {size.price} {isRTL ? 'ر.س' : 'SAR'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                 {stage === "saving" && (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                        <Loader2 className="h-12 w-12 text-gray-200 animate-spin" />
                        <p className="text-sm font-bold text-gray-900">{isRTL ? 'جاري الحفظ...' : 'Saving...'}</p>
                    </div>
                )}
            </motion.div>
          </AnimatePresence>
        </div>

        {stage === 'confirm' && (
          <div className="p-5 pt-0 flex flex-wrap gap-2">
            <Button onClick={handleSaveToMenu} className="flex-1 h-11 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-bold text-sm">
                <Save className={`${iconMargin} h-4 w-4`} />
                {isRTL ? 'حفظ التغييرات' : 'Save changes'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
