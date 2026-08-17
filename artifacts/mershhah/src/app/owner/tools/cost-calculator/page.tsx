'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Coins, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

const UNITS = ['كجم', 'جرام', 'لتر', 'مل', 'حبة', 'علبة', 'كوب'];

const newIngredient = (): Ingredient => ({
  id: crypto.randomUUID(),
  name: '',
  quantity: 0,
  unit: 'كجم',
  unitCost: 0,
});

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

  const ingredientsCost = ingredients.reduce((sum, i) => sum + (i.quantity || 0) * (i.unitCost || 0), 0);
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
        product_name: productName.trim(),
        servings: safeServings,
        ingredients: ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, unit_cost: i.unitCost })),
        packaging_cost: packagingCost || 0,
        overhead_percent: overheadPercent || 0,
        target_margin_percent: targetMarginPercent || 0,
        selling_price: hasSellingPrice ? Number(sellingPrice) : null,
        total_cost: totalCost,
        cost_per_serving: costPerServing,
      });
      if (error) throw error;
      toast({ title: 'تم الحفظ', description: 'تم حفظ حساب التكلفة' });
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
            <input
              type="text"
              placeholder="مثال: برجر لحم كلاسيك"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
            />
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
          <p className="text-xs font-bold text-gray-900">المكونات</p>
          <div className="space-y-2">
            {ingredients.map((ing) => (
              <div key={ing.id} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="اسم المكوّن"
                  value={ing.name}
                  onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                  className="col-span-4 h-9 px-3 rounded-lg border border-gray-200 text-xs"
                />
                <input
                  type="number"
                  placeholder="الكمية"
                  value={ing.quantity || ''}
                  onChange={(e) => updateIngredient(ing.id, 'quantity', Number(e.target.value))}
                  className="col-span-2 h-9 px-3 rounded-lg border border-gray-200 text-xs"
                  dir="ltr"
                />
                <select
                  value={ing.unit}
                  onChange={(e) => updateIngredient(ing.id, 'unit', e.target.value)}
                  className="col-span-2 h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="سعر الوحدة"
                  value={ing.unitCost || ''}
                  onChange={(e) => updateIngredient(ing.id, 'unitCost', Number(e.target.value))}
                  className="col-span-2 h-9 px-3 rounded-lg border border-gray-200 text-xs"
                  dir="ltr"
                />
                <div className="col-span-1 text-[11px] font-bold text-gray-600 text-center truncate">
                  {formatCurrency((ing.quantity || 0) * (ing.unitCost || 0))}
                </div>
                <button
                  onClick={() => removeIngredient(ing.id)}
                  disabled={ingredients.length === 1}
                  className="col-span-1 w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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
