'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Sparkles, Upload, Loader2, Check, Images, Save, RotateCcw, Lock, AlertTriangle,
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { syncPublicPage } from '@/lib/public-pages';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { ImageGallery } from '@/components/studio/ImageGallery';
import type { MenuItem } from '@/lib/types';

const BUCKET = 'restaurant-assets';
// Tested live: the "realworld-x4" model took 89s just to initialize plus
// 40s+ more for a single small image - the "lightweight-x2" variant is
// meaningfully faster in every stage (measured ~111s end-to-end total) while
// still being real AI super-resolution, not just a filter.
const AI_MODEL_ID = 'Xenova/swin2SR-lightweight-x2-64';
const AI_INPUT_MAX_DIMENSION = 700; // model upscales ~2x, so a larger input still lands around ~1400px output

function loadImageElement(imgSrc: string, isCrossOrigin: boolean): Promise<HTMLImageElement> {
  const img = document.createElement('img');
  if (isCrossOrigin) img.crossOrigin = 'anonymous';
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذّر تحميل الصورة'));
    img.src = imgSrc;
  });
}

// Shrink the source image down before feeding it to the AI model, since the
// model upscales ~4x on its own — feeding it a full-size photo would produce
// an unnecessarily huge, slow result.
async function shrinkForAI(imgSrc: string, isCrossOrigin: boolean): Promise<string> {
  const img = await loadImageElement(imgSrc, isCrossOrigin);
  const scale = Math.min(1, AI_INPUT_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذّر إنشاء لوحة الرسم');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

function rawImageToBlob(rawImage: any): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = rawImage.width;
  canvas.height = rawImage.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذّر إنشاء لوحة الرسم');
  const channels: number = rawImage.channels || Math.round(rawImage.data.length / (rawImage.width * rawImage.height));
  const rgba = new Uint8ClampedArray(rawImage.width * rawImage.height * 4);
  for (let i = 0, j = 0; i < rawImage.data.length; i += channels, j += 4) {
    rgba[j] = rawImage.data[i];
    rgba[j + 1] = channels >= 2 ? rawImage.data[i + 1] : rawImage.data[i];
    rgba[j + 2] = channels >= 3 ? rawImage.data[i + 2] : rawImage.data[i];
    rgba[j + 3] = channels >= 4 ? rawImage.data[i + 3] : 255;
  }
  ctx.putImageData(new ImageData(rgba, rawImage.width, rawImage.height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('فشل تحويل الصورة'))), 'image/webp', 0.92);
  });
}

let upscalerPromise: Promise<any> | null = null;

async function getUpscaler(onProgress?: (status: string) => void) {
  if (!upscalerPromise) {
    upscalerPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Run the WASM inference on a Web Worker instead of the main thread,
      // so the page stays responsive (and Firefox/Chrome don't flag it as
      // an unresponsive script) while the model is actually computing.
      try {
        (env as any).backends.onnx.wasm.proxy = true;
      } catch {
        // Older/newer library versions may expose this differently - safe to skip.
      }
      return pipeline('image-to-image', AI_MODEL_ID, {
        progress_callback: (p: any) => {
          if (onProgress && p?.status) onProgress(p.status);
        },
      } as any);
    })().catch((err) => {
      upscalerPromise = null; // allow retrying on the next attempt instead of caching a failure forever
      throw err;
    });
  }
  return upscalerPromise;
}

async function enhanceImageWithAI(imgSrc: string, isCrossOrigin: boolean, onProgress?: (status: string) => void): Promise<Blob> {
  const { RawImage } = await import('@huggingface/transformers');
  const upscaler = await getUpscaler(onProgress);
  const shrunkDataUrl = await shrinkForAI(imgSrc, isCrossOrigin);
  const inputImage = await RawImage.fromURL(shrunkDataUrl);
  onProgress?.('processing');
  const output = await upscaler(inputImage);
  const result = Array.isArray(output) ? output[0] : output;
  return rawImageToBlob(result);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('انتهت مهلة تحميل نموذج الذكاء الاصطناعي')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function enhanceImage(
  imgSrc: string,
  isCrossOrigin: boolean,
  onProgress?: (status: string) => void
): Promise<Blob> {
  // Measured live: model init alone can take ~45s and inference another
  // ~65s on a plain CPU (no GPU acceleration) - give real headroom over that
  // for slower devices before giving up.
  return withTimeout(enhanceImageWithAI(imgSrc, isCrossOrigin, onProgress), 240000);
}

type UsageState = { allowed: boolean; remaining: number };

export default function ImageEnhancerPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const restaurantId = user?.restaurantId;
  const isPaidPlan = !!user?.entitlements?.planId && user.entitlements.planId !== 'free' && user.entitlements.planId !== 'none';

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [productName, setProductName] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [usage, setUsage] = useState<UsageState | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalIsRemote, setOriginalIsRemote] = useState(false);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMenuItems = async () => {
    if (!restaurantId) return;
    const { data } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name');
    setMenuItems((data || []) as MenuItem[]);
  };

  const fetchUsage = async () => {
    if (!restaurantId) return;
    setIsLoadingUsage(true);
    const { data } = await supabase.rpc('check_image_enhance_usage', { p_restaurant_id: restaurantId, p_consume: false });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setUsage({ allowed: row.allowed, remaining: row.remaining });
    setIsLoadingUsage(false);
  };

  useEffect(() => {
    fetchMenuItems();
    fetchUsage();
  }, [restaurantId]);

  const resetImages = () => {
    setOriginalUrl(null);
    setOriginalIsRemote(false);
    setEnhancedUrl(null);
    setEnhancedBlob(null);
  };

  const selectProduct = (item: MenuItem) => {
    setSelectedItem(item);
    setProductName(item.name);
    setShowSuggestions(false);
    resetImages();
  };

  const filteredMenuItems = productName.trim()
    ? menuItems.filter((i) => i.name.includes(productName.trim()))
    : menuItems;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'الصورة كبيرة جداً', description: 'اختر صورة أقل من 8 ميجابايت' });
      return;
    }
    resetImages();
    setOriginalUrl(URL.createObjectURL(file));
    setOriginalIsRemote(false);
  };

  const handleGallerySelect = (storagePath: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    resetImages();
    setOriginalUrl(data.publicUrl);
    setOriginalIsRemote(true);
    setGalleryOpen(false);
  };

  const handleEnhance = async () => {
    if (!originalUrl || !restaurantId) return;

    // Consume the quota right before running the AI model, since that's the
    // expensive step - not at save time, which would let someone re-run the
    // model for free as long as they never clicked "save".
    const { data: usageData, error: usageError } = await supabase.rpc('check_image_enhance_usage', {
      p_restaurant_id: restaurantId, p_consume: true,
    });
    if (usageError) {
      toast({ variant: 'destructive', title: 'خطأ', description: usageError.message });
      return;
    }
    const row = Array.isArray(usageData) ? usageData[0] : usageData;
    if (!row?.allowed) {
      setUsage({ allowed: false, remaining: 0 });
      toast({
        variant: 'destructive',
        title: isPaidPlan ? 'انتهى رصيدك' : 'الأداة للمشتركين فقط',
        description: isPaidPlan
          ? 'اشترِ رصيد إضافي عشان تكمل التحسين'
          : 'رقّي باقتك لتفعيل تحسين الصور بالذكاء الاصطناعي',
      });
      return;
    }
    setUsage({ allowed: row.allowed, remaining: row.remaining });

    setIsProcessing(true);
    setProcessingStatus('جاري تجهيز نموذج الذكاء الاصطناعي... (أول مرة قد تأخذ دقيقة أو أكثر)');
    try {
      const blob = await enhanceImage(originalUrl, originalIsRemote, (status) => {
        if (status === 'processing') setProcessingStatus('جاري التحسين بالذكاء الاصطناعي... (قد يستغرق حتى 3 دقائق، لا تغلق الصفحة)');
      });
      setEnhancedBlob(blob);
      setEnhancedUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'فشل التحسين بالذكاء الاصطناعي',
        description: e.message || 'حاول مرة ثانية، أو تأكد من اتصال الإنترنت',
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleSave = async () => {
    if (!restaurantId || !selectedItem || !enhancedBlob) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'اختر منتج وحسّن صورته أولاً' });
      return;
    }
    setIsSaving(true);
    try {
      const path = `restaurants/${restaurantId}/menu_items/${selectedItem.id}-enhanced-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, enhancedBlob);
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.from('menu_items').update({ image_url: path }).eq('id', selectedItem.id);
      if (updateError) throw updateError;

      syncPublicPage(restaurantId).catch(() => {});
      toast({ title: 'تم الحفظ', description: `تم تحديث صورة "${selectedItem.name}"` });
      resetImages();
      fetchMenuItems();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const quotaExceeded = !!usage && !usage.allowed;

  return (
    <div className="space-y-6 p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">تحسين جودة صور المنتجات</h1>
          <p className="text-xs text-gray-400">ارفع صورة أو اختر من صور منيوك، وحسّن وضوحها بضغطة زر</p>
        </div>
      </div>

      {/* Usage banner */}
      {!isPaidPlan ? (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <p className="text-[11px] text-red-600">أداة تحسين الصور بالذكاء الاصطناعي متاحة للمشتركين فقط</p>
          </div>
          <Link href="/pricing" className="h-8 px-3 rounded-lg bg-gray-900 text-white text-[11px] font-bold flex items-center">
            ترقية الباقة
          </Link>
        </div>
      ) : isLoadingUsage ? (
        <div className="h-10 rounded-xl bg-gray-50 animate-pulse" />
      ) : quotaExceeded ? (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <p className="text-[11px] text-red-600">انتهى رصيدك من التحسينات</p>
          </div>
          <span className="text-[11px] text-gray-400">قريباً: شحن رصيد إضافي</span>
        </div>
      ) : (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-2.5">
          <p className="text-[11px] text-violet-700">
            رصيدك المتبقي: <span className="font-bold">{usage?.remaining ?? 15}</span> من 199 (15 تُضاف مجاناً كل شهر)
          </p>
        </div>
      )}

      {/* Product picker */}
      <Card className="border-gray-100">
        <CardContent className="p-5">
          <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">اختر المنتج</label>
          <div className="relative">
            <input
              type="text"
              placeholder="اختر من المنيو أو اكتب اسم المنتج..."
              value={productName}
              onChange={(e) => {
                const v = e.target.value;
                setProductName(v);
                if (selectedItem && v !== selectedItem.name) setSelectedItem(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
            />
            {showSuggestions && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto" dir="rtl">
                {filteredMenuItems.length > 0 ? (
                  filteredMenuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectProduct(item); }}
                      className="w-full text-right px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Check className={cn('h-3.5 w-3.5 shrink-0', selectedItem?.id === item.id ? 'opacity-100 text-emerald-600' : 'opacity-0')} />
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-[11px] text-gray-400 text-center">ما فيه صنف مطابق</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image source */}
      <Card className="border-gray-100">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              رفع صورة جديدة
            </button>
            <button
              onClick={() => setGalleryOpen(true)}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Images className="h-3.5 w-3.5" />
              اختيار من صور المنيو
            </button>
          </div>

          {originalUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400 mb-1.5">قبل</p>
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                  <img src={originalUrl} alt="قبل" className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 mb-1.5">بعد</p>
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-2 px-3 text-center">
                      <Loader2 className="h-6 w-6 text-gray-300 animate-spin" />
                      <p className="text-[10px] text-gray-400">{processingStatus}</p>
                    </div>
                  ) : enhancedUrl ? (
                    <img src={enhancedUrl} alt="بعد" className="w-full h-full object-cover" />
                  ) : (
                    <p className="text-[11px] text-gray-300">اضغط "تحسين الصورة"</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {originalUrl && !isProcessing && (
            <p className="text-[11px] text-gray-400 text-center">
              التحسين يشتغل بالذكاء الاصطناعي داخل متصفحك مباشرة — وقد يأخذ حتى 2-3 دقائق، خصوصاً أول مرة
            </p>
          )}

          {originalUrl && (
            <div className="flex gap-2">
              <button
                onClick={handleEnhance}
                disabled={isProcessing || quotaExceeded || !isPaidPlan}
                className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isProcessing ? 'جاري التحسين...' : 'تحسين الصورة'}
              </button>
              <button
                onClick={resetImages}
                className="h-11 px-4 rounded-xl border border-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                إلغاء
              </button>
            </div>
          )}

          {enhancedBlob && (
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedItem}
              className="w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'جاري الحفظ...' : !selectedItem ? 'اختر منتج أولاً عشان تحفظ' : 'حفظ كصورة المنتج'}
            </button>
          )}

          {!selectedItem && enhancedBlob && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              لازم تختار المنتج فوق عشان تقدر تحفظ الصورة عليه
            </p>
          )}
        </CardContent>
      </Card>

      {/* Gallery picker dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-2xl" dir="rtl">
          <DialogTitle className="sr-only">اختر صورة من صور منيوك</DialogTitle>
          <DialogDescription className="sr-only">اضغط على الصورة لاختيارها كنقطة بداية للتحسين</DialogDescription>
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-bold">اختر صورة من صور منيوك</h2>
            <p className="text-sm text-gray-400 mt-1">اضغط على الصورة لاختيارها كنقطة بداية للتحسين</p>
          </div>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-6">
            <ImageGallery onImageSelect={handleGallerySelect} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
