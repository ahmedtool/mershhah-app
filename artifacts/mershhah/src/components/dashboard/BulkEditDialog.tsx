'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import type { Branch } from '@/lib/types';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  restaurantId: string;
  onSaved?: () => void;
}

export function BulkEditDialog({ open, onOpenChange, branches, restaurantId, onSaved }: BulkEditDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'active' | 'inactive' | null>(null);
  const [openingHours, setOpeningHours] = useState('');
  const [applyStatus, setApplyStatus] = useState(false);
  const [applyHours, setApplyHours] = useState(false);

  const handleSave = async () => {
    if (!restaurantId || branches.length === 0) return;
    if (!applyStatus && !applyHours) {
      toast({ title: 'اختر değişiklik أولاً', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (applyStatus && status) updates.status = status;
      if (applyHours && openingHours.trim()) updates.opening_hours = openingHours.trim();

      const { error } = await supabase
        .from('branches')
        .update(updates)
        .eq('restaurant_id', restaurantId)
        .in('id', branches.map(b => b.id));

      if (error) throw error;

      syncPublicPage(restaurantId).catch(() => {});
      toast({ title: `تم تحديث ${branches.length} فرع` });
      onSaved?.();
      resetState();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'خطأ', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setStatus(null);
    setOpeningHours('');
    setApplyStatus(false);
    setApplyHours(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0" dir="rtl">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">تعديل جماعي</h2>
              <p className="text-xs text-gray-400 mt-0.5">{branches.length} فروع محددة</p>
            </div>
            <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Status */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={applyStatus} onChange={(e) => setApplyStatus(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300" />
              <span className="text-sm font-medium text-gray-700">تغيير الحالة</span>
            </label>
            {applyStatus && (
              <div className="flex gap-2 mr-6">
                <button onClick={() => setStatus('active')}
                  className={`flex-1 h-10 rounded-xl text-xs font-medium transition-all border ${
                    status === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-400'
                  }`}>
                  نشط
                </button>
                <button onClick={() => setStatus('inactive')}
                  className={`flex-1 h-10 rounded-xl text-xs font-medium transition-all border ${
                    status === 'inactive' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-400'
                  }`}>
                  غير نشط
                </button>
              </div>
            )}
          </div>

          {/* Opening Hours */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={applyHours} onChange={(e) => setApplyHours(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300" />
              <span className="text-sm font-medium text-gray-700">تغيير أوقات العمل</span>
            </label>
            {applyHours && (
              <div className="mr-6">
                <Input
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  placeholder="يوميًا 9 ص - 11 م"
                  className="h-10 rounded-xl border-gray-200 text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={() => onOpenChange(false)}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving || (!applyStatus && !applyHours)}
            className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'جاري الحفظ...' : 'تطبيق على الكل'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
