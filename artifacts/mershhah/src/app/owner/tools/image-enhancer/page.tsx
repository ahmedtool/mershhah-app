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

function loadImageElement(imgSrc: string, isCrossOrigin: boolean): Promise<HTMLImageElement> {
  const img = document.createElement('img');
  if (isCrossOrigin) img.crossOrigin = 'anonymous';
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذّر تحميل الصورة'));
    img.src = imgSrc;
  });
}

const AI_INPUT_MAX_DIMENSION = 1200;

// Downscale before upload (keeps the request small/fast) and strip the
// data-URL prefix, since the edge function expects raw base64.
async function imageSrcToBase64(imgSrc: string, isCrossOrigin: boolean): Promise<{ base64: string; width: number; height: number }> {
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
  const dataUrl = canvas.toDataURL('image/png');
  return { base64: dataUrl.split(',')[1], width, height };
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

type EnhanceResult = { blob: Blob; remaining: number };

async function enhanceImageWithGemini(
  imgSrc: string,
  isCrossOrigin: boolean,
  productName: string,
  accessToken: string
): Promise<EnhanceResult> {
  const { base64: imageBase64 } = await imageSrcToBase64(imgSrc, isCrossOrigin);
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enhance-product-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ image_base64: imageBase64, product_name: productName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل التحسين بالذكاء الاصطناعي');
  return { blob: base64ToBlob(data.image_base64, 'image/png'), remaining: data.remaining };
}

type UsageState = { allowed: boolean; remaining: number };
type CreditPack = { id: string; name: string; credits: number; price: number };

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
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);

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

  const fetchPacks = async () => {
    const { data } = await supabase.from('image_credit_packs').select('*').eq('is_active', true).order('position');
    setPacks((data || []) as CreditPack[]);
  };

  useEffect(() => {
    fetchMenuItems();
    fetchUsage();
    fetchPacks();
  }, [restaurantId]);

  // Land back here after a real StreamPay credit-pack purchase (success or failure).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('credit_purchase');
    if (!result) return;
    if (result === 'success') {
      toast({ title: 'تم الشحن بنجاح', description: 'راح يظهر الرصيد خلال لحظات' });
      fetchUsage();
    } else if (result === 'failed') {
      toast({ variant: 'destructive', title: 'فشل الدفع', description: 'لم تكتمل عملية الدفع. حاول مرة أخرى.' });
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleBuyPack = async (packId: string) => {
    setBuyingPackId(packId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/streampay-credits-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ pack_id: packId }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ variant: 'destructive', title: 'تعذّر بدء الدفع', description: data.error || 'فشل إنشاء رابط الدفع' });
        setBuyingPackId(null);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
      setBuyingPackId(null);
    }
  };

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

    // Quick, read-only pre-check so we can fail fast with a friendly message
    // instead of making a real (paid) FLUX request when we already know the
    // balance is empty. The actual check-and-consume happens server-side
    // inside enhance-product-image, right before it calls FLUX - that's the
    // authoritative gate, this is just UX.
    if (usage && !usage.allowed) {
      toast({
        variant: 'destructive',
        title: isPaidPlan ? 'انتهى رصيدك' : 'الأداة للمشتركين فقط',
        description: isPaidPlan
          ? 'اشترِ رصيد إضافي عشان تكمل التحسين'
          : 'رقّي باقتك لتفعيل تحسين الصور بالذكاء الاصطناعي',
      });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    setIsProcessing(true);
    setProcessingStatus('جاري إرسال الصورة للذكاء الاصطناعي...');
    try {
      const { blob, remaining } = await enhanceImageWithGemini(
        originalUrl,
        originalIsRemote,
        selectedItem?.name || productName,
        session.access_token
      );
      setEnhancedBlob(blob);
      setEnhancedUrl(URL.createObjectURL(blob));
      if (typeof remaining === 'number') setUsage({ allowed: remaining > 0, remaining });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'فشل التحسين بالذكاء الاصطناعي',
        description: e.message || 'حاول مرة ثانية، أو تأكد من اتصال الإنترنت',
      });
      fetchUsage(); // in case the failure was "no credit" - resync the real balance
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
        <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <p className="text-[11px] text-red-600">انتهى رصيدك من التحسينات — اشترِ رصيد إضافي بالأسفل عشان تكمل</p>
        </div>
      ) : (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-3.5 py-2.5">
          <p className="text-[11px] text-violet-700">
            رصيدك المتبقي: <span className="font-bold">{usage?.remaining ?? 5}</span> من 199 (5 تُضاف مجاناً كل شهر)
          </p>
        </div>
      )}

      {/* Buy credits */}
      {isPaidPlan && packs.length > 0 && (
        <Card className="border-gray-100">
          <CardContent className="p-5 space-y-3">
            <div>
              <p className="text-xs font-bold text-gray-900">اشترِ رصيد إضافي</p>
              <p className="text-[10px] text-gray-400 mt-0.5">الرصيد يترحّل — ما ينتهي بنهاية الشهر (حد أقصى 199 صورة بالمجموع)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {packs.map((pack) => (
                <div key={pack.id} className="border border-gray-100 rounded-xl p-3.5 text-center space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">{pack.name}</p>
                  <p className="text-lg font-black text-gray-900">{pack.credits} صورة</p>
                  <p className="text-sm font-bold text-violet-600">{pack.price} ر.س</p>
                  <button
                    onClick={() => handleBuyPack(pack.id)}
                    disabled={buyingPackId === pack.id}
                    className="w-full h-9 rounded-lg bg-gray-900 text-white text-[11px] font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {buyingPackId === pack.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {buyingPackId === pack.id ? 'جاري التحويل...' : 'شراء'}
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
              التحسين يستخدم صورة صنفك الفعلية ويحوّل خلفيتها لبيضاء نظيفة — يأخذ عادةً أقل من دقيقة
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
