'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Coins, Plus, Trash2, Save, Loader2, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { syncPublicPage } from '@/lib/public-pages';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/lib/types';

interface Ingredient {
  id: string;
  name: string;
  packagePrice: number; // سعر شراء العبوة كاملة
  packageQty: number;   // كمية العبوة (بوحدة العبوة)
  packageUnit: string;
  usedQty: number;      // الكمية المستخدمة فعلياً بهذه الوصفة
  usedUnit: string;
}

// كل وحدة تنتمي لمجموعة قابلة للتحويل داخل نفسها فقط (وزن مع وزن، حجم مع حجم).
// "حبة"/"علبة"/"كوب" وحدات عدّية ما تتحول بين بعضها لأنها مو مقاييس فيزيائية ثابتة.
const UNIT_INFO: Record<string, { group: string; toBase: number }> = {
  'جرام': { group: 'weight', toBase: 1 },
  'كجم': { group: 'weight', toBase: 1000 },
  'مل': { group: 'volume', toBase: 1 },
  'لتر': { group: 'volume', toBase: 1000 },
  'حبة': { group: 'حبة', toBase: 1 },
  'علبة': { group: 'علبة', toBase: 1 },
  'كوب': { group: 'كوب', toBase: 1 },
};
const UNITS = Object.keys(UNIT_INFO);

function convertQty(qty: number, fromUnit: string, toUnit: string): number | null {
  const from = UNIT_INFO[fromUnit];
  const to = UNIT_INFO[toUnit];
  if (!from || !to || from.group !== to.group) return null;
  return (qty * from.toBase) / to.toBase;
}

const newIngredient = (): Ingredient => ({
  id: crypto.randomUUID(),
  name: '',
  packagePrice: 0,
  packageQty: 0,
  packageUnit: 'جرام',
  usedQty: 0,
  usedUnit: 'جرام',
});

function ingredientCost(ing: Ingredient): { cost: number; compatible: boolean } {
  const costPerPackageUnit = ing.packageQty > 0 ? ing.packagePrice / ing.packageQty : 0;
  const converted = convertQty(ing.usedQty || 0, ing.usedUnit, ing.packageUnit);
  if (converted === null) return { cost: 0, compatible: false };
  return { cost: converted * costPerPackageUnit, compatible: true };
}

export default function CostCalculatorPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [productName, setProductName] = useState('');
  const [servings, setServings] = useState(1);
  const [ingredients, setIngredients] = useState<Ingredient[]>([newIngredient()]);
  const [packagingCost, setPackagingCost] = useState(0);
  const [overheadPercent, setOverheadPercent] = useState(10);
  const [targetMarginPercent, setTargetMarginPercent] = useState(30);
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  // ربط بمنتج حقيقي من المنيو — عشان نقدر نحفظ التكلفة عليه مباشرة
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');

  useEffect(() => {
    if (!user?.restaurantId) return;
    supabase.from('menu_items').select('*').eq('restaurant_id', user.restaurantId).order('name')
      .then(({ data }: { data: any[] | null }) => setMenuItems((data || []) as MenuItem[]));
  }, [user?.restaurantId]);

  const addIngredient = () => setIngredients([...ingredients, newIngredient()]);
  const removeIngredient = (id: string) => {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter((i) => i.id !== id));
  };
  const updateIngredient = (id: string, field: keyof Ingredient, value: string | number) => {
    setIngredients(ingredients.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const ingredientResults = ingredients.map((i) => ({ ing: i, ...ingredientCost(i) }));
  const ingredientsCost = ingredientResults.reduce((sum, r) => sum + r.cost, 0);
  const hasIncompatibleUnits = ingredientResults.some((r) => !r.compatible && (r.ing.usedQty || 0) > 0);
  const rawCost = ingredientsCost + (packagingCost || 0);
  const overheadAmount = rawCost * ((overheadPercent || 0) / 100);
  const totalCost = rawCost + overheadAmount;
  const safeServings = servings > 0 ? servings : 1;
  const costPerServing = totalCost / safeServings;
  const suggestedPrice =
    targetMarginPercent < 100 ? costPerServing / (1 - targetMarginPercent / 100) : costPerServing;

  const hasSellingPrice = sellingPrice !== '' && Number(sellingPrice) > 0;
  const profitPerServing = hasSellingPrice ? Number(sellingPrice) - costPerServing : 0;
  const profitMarginPercent = hasSellingPrice && Number(sellingPrice) > 0 ? (profitPerServing / Number(sellingPrice)) * 100 : 0;

  const selectProduct = (item: MenuItem) => {
    setSelectedItem(item);
    setProductName(item.name);
    setSelectedSizeId(item.sizes?.[0]?.id || '');
    setProductOpen(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!productName.trim()) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'اكتب اسم المنتج أولاً' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('product_cost_calculations').insert({
        profile_id: user.id,
        menu_item_id: selectedItem?.id || null,
        product_name: productName.trim(),
        servings: safeServings,
        ingredients: ingredients.map((i) => ({
          name: i.name, package_price: i.packagePrice, package_qty: i.packageQty, package_unit: i.packageUnit,
          used_qty: i.usedQty, used_unit: i.usedUnit,
        })),
        packaging_cost: packagingCost || 0,
        overhead_percent: overheadPercent || 0,
        target_margin_percent: targetMarginPercent || 0,
        selling_price: hasSellingPrice ? Number(sellingPrice) : null,
        total_cost: totalCost,
        cost_per_serving: costPerServing,
      });
      if (error) throw error;

      if (selectedItem && selectedSizeId) {
        const newSizes = (selectedItem.sizes || []).map((s) =>
          s.id === selectedSizeId ? { ...s, cost: Number(costPerServing.toFixed(2)) } : s
        );
        const { error: itemError } = await supabase.from('menu_items').update({ sizes: newSizes }).eq('id', selectedItem.id);
        if (itemError) throw itemError;
        if (user.restaurantId) syncPublicPage(user.restaurantId).catch(() => {});
        toast({ title: 'تم الحفظ', description: 'تم حفظ الحساب وتحديث تكلفة المنتج بالمنيو' });
      } else {
        toast({ title: 'تم الحفظ', description: 'تم حفظ حساب التكلفة' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Coins className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">حاسبة تكلفة المنتج</h1>
            <p className="text-xs text-gray-400">احسب تكلفة منتجك واعرف السعر المناسب له</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          حفظ الحساب
        </button>
      </div>

      {/* Product info */}
      <Card className="border-gray-100">
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">اسم المنتج</label>
            <Popover open={productOpen} onOpenChange={(v) => { setProductOpen(v); if (v) setProductSearch(''); }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-right flex items-center justify-between text-sm",
                    !productName && "text-gray-400"
                  )}
                >
                  <span className="truncate">{productName || 'اختر من المنيو أو اكتب اسم منتج جديد...'}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" dir="rtl">
                <Command filter={(v, s) => v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0}>
                  <CommandInput
                    placeholder="ابحث بالمنيو أو اكتب اسم جديد..."
                    className="h-9"
                    value={productSearch}
                    onValueChange={setProductSearch}
                  />
                  <CommandList>
                    {menuItems.length === 0 && <CommandEmpty>ما فيه أصناف بالمنيو — اكتب اسم منتج جديد</CommandEmpty>}
                    <CommandGroup heading="أصناف المنيو">
                      {menuItems.map((item) => (
                        <CommandItem key={item.id} value={item.name} onSelect={() => selectProduct(item)}>
                          <Check className={cn("h-4 w-4 shrink-0", selectedItem?.id === item.id ? "opacity-100" : "opacity-0")} />
                          <span className="mr-2">{item.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {productSearch.trim() && !menuItems.some((i) => i.name.toLowerCase() === productSearch.trim().toLowerCase()) && (
                      <CommandGroup heading="منتج جديد">
                        <CommandItem
                          value={`__custom__${productSearch}`}
                          onSelect={() => {
                            setProductName(productSearch.trim());
                            setSelectedItem(null);
                            setSelectedSizeId('');
                            setProductOpen(false);
                          }}
                        >
                          <Plus className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="mr-2">استخدام "{productSearch.trim()}" كاسم منتج جديد</span>
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedItem && (selectedItem.sizes?.length || 0) > 1 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-gray-400 shrink-0">حفظ التكلفة على حجم:</span>
                <select
                  value={selectedSizeId}
                  onChange={(e) => setSelectedSizeId(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-gray-200 text-[11px] bg-white flex-1"
                >
                  {selectedItem.sizes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedItem && (
              <p className="text-[10px] text-emerald-600 mt-1.5">مربوط بمنتج من المنيو — راح تنحفظ التكلفة عليه مباشرة</p>
            )}
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">عدد الحصص الناتجة</label>
            <input
              type="number"
              min={1}
              value={servings || ''}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card className="border-gray-100">
        <CardContent className="p-5 space-y-3">
          <div>
            <p className="text-xs font-bold text-gray-900">المكونات</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              اكتب سعر العبوة اللي تشتريها وكميتها، وبعدين قد إيش استخدمت منها بهذه الوصفة — والحاسبة تحسب التكلفة النسبية تلقائياً
            </p>
          </div>
          <div className="space-y-3">
            {ingredientResults.map(({ ing, cost, compatible }) => (
              <div key={ing.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="اسم المكوّن (مثال: قشطة)"
                    value={ing.name}
                    onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-xs font-bold"
                  />
                  <button
                    onClick={() => removeIngredient(ing.id)}
                    disabled={ingredients.length === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[9px] text-gray-400 mb-1 block">سعر شراء العبوة</label>
                    <input
                      type="number"
                      value={ing.packagePrice || ''}
                      onChange={(e) => updateIngredient(ing.id, 'packagePrice', Number(e.target.value))}
                      className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 mb-1 block">كمية العبوة</label>
                    <input
                      type="number"
                      value={ing.packageQty || ''}
                      onChange={(e) => updateIngredient(ing.id, 'packageQty', Number(e.target.value))}
                      className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 mb-1 block">وحدة العبوة</label>
                    <select
                      value={ing.packageUnit}
                      onChange={(e) => updateIngredient(ing.id, 'packageUnit', e.target.value)}
                      className="w-full h-9 px-1 rounded-lg border border-gray-200 text-xs bg-white"
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 mb-1 block">المستخدم بالوصفة</label>
                    <input
                      type="number"
                      value={ing.usedQty || ''}
                      onChange={(e) => updateIngredient(ing.id, 'usedQty', Number(e.target.value))}
                      className="w-full h-9 px-2 rounded-lg border border-gray-200 text-xs"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400 mb-1 block">وحدة الاستخدام</label>
                    <select
                      value={ing.usedUnit}
                      onChange={(e) => updateIngredient(ing.id, 'usedUnit', e.target.value)}
                      className="w-full h-9 px-1 rounded-lg border border-gray-200 text-xs bg-white"
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                {!compatible && (ing.usedQty || 0) > 0 ? (
                  <p className="text-[10px] text-red-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    وحدة الاستخدام "{ing.usedUnit}" ما تتحول لوحدة العبوة "{ing.packageUnit}" — اختر وحدتين من نفس النوع (وزن مع وزن، أو حجم مع حجم)
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-500">
                    تكلفة هذا المكوّن بالوصفة: <span className="font-bold text-gray-900">{formatCurrency(cost)} ر.س</span>
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addIngredient}
            className="w-full h-10 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-xs font-bold hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة مكوّن
          </button>
        </CardContent>
      </Card>

      {/* Extra costs + pricing */}
      <Card className="border-gray-100">
        <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">تكلفة التغليف</label>
            <input
              type="number"
              value={packagingCost || ''}
              onChange={(e) => setPackagingCost(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">نسبة هدر/تشغيل %</label>
            <input
              type="number"
              value={overheadPercent || ''}
              onChange={(e) => setOverheadPercent(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">هامش الربح المستهدف %</label>
            <input
              type="number"
              value={targetMarginPercent || ''}
              onChange={(e) => setTargetMarginPercent(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">سعر البيع الحالي (اختياري)</label>
            <input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs w-full"
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-gray-100 bg-gray-50">
        <CardContent className="p-5 space-y-4">
          {hasIncompatibleUnits && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <p className="text-[11px] text-red-600">
                فيه مكوّن أو أكثر بوحدات غير متوافقة — تكلفته ما تُحسب بالإجمالي لين تصلحها
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-[10px] text-gray-400">تكلفة المكونات</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(ingredientsCost)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">هدر/تشغيل + تغليف</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(overheadAmount + (packagingCost || 0))}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">التكلفة الإجمالية</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(totalCost)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">تكلفة الحصة الواحدة</p>
              <p className="text-lg font-black text-amber-600">{formatCurrency(costPerServing)} ر.س</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] text-gray-400">السعر المقترح (هامش {targetMarginPercent || 0}%)</p>
              <p className="text-lg font-black text-emerald-600">{formatCurrency(suggestedPrice)} ر.س</p>
            </div>
            {hasSellingPrice && (
              <>
                <div>
                  <p className="text-[10px] text-gray-400">الربح عند سعرك الحالي</p>
                  <p className={`text-lg font-black ${profitPerServing >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(profitPerServing)} ر.س
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">هامش الربح الفعلي</p>
                  <p className={`text-lg font-black ${profitMarginPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {profitMarginPercent.toFixed(1)}%
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
