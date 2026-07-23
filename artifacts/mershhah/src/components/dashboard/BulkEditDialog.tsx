'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, Phone, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { syncPublicPage } from '@/lib/public-pages';
import { TimePicker } from '@/components/ui/time-picker';
import type { Branch } from '@/lib/types';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  restaurantId: string;
  onSaved?: () => void;
}

function generateHoursText(open: string, close: string, friOpen: string, friClose: string): string {
  if (!open || !close) return '';
  const to12 = (t: string) => {
    const [h, m] = t.split(':');
    const hour24 = parseInt(h);
    const period = hour24 >= 12 ? 'م' : 'ص';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}:${m} ${period}`;
  };
  let text = `يوميًا ${to12(open)} - ${to12(close)}`;
  if (friOpen && friClose) {
    text += ` (الجمعة ${to12(friOpen)} - ${to12(friClose)})`;
  }
  return text;
}

export function BulkEditDialog({ open, onOpenChange, branches, restaurantId, onSaved }: BulkEditDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [showFriday, setShowFriday] = useState(false);
  const [fridayOpen, setFridayOpen] = useState('');
  const [fridayClose, setFridayClose] = useState('');

  const [applyPhone, setApplyPhone] = useState(true);
  const [applyHours, setApplyHours] = useState(true);

  useEffect(() => {
    if (!open) return;
    const first = branches[0];
    if (first) {
      setPhone(first.phone || '');
      setShowFriday(false);
      setFridayOpen('');
      setFridayClose('');
    }
  }, [open, branches]);

  const hoursText = generateHoursText(openTime, closeTime, fridayOpen, fridayClose);

  async function handleSave() {
    if (!restaurantId || branches.length === 0) return;
    setSaving(true);

    try {
      const updates: Record<string, unknown> = {};

      if (applyPhone && phone.trim()) {
        updates.phone = phone.trim();
      }

      if (applyHours && openTime && closeTime) {
        updates.opening_hours = hoursText;
      }

      if (Object.keys(updates).length === 0) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'اختر على الأقل خياراً واحداً' });
        setSaving(false);
        return;
      }

      const ids = branches.map((b) => b.id);
      const { error } = await supabase
        .from('branches')
        .update(updates)
        .in('id', ids)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      toast({
        title: `تم تحديث ${branches.length} فرع`,
        description: applyPhone && applyHours ? 'تم تحديث رقم الهاتف وأوقات العمل' :
                     applyPhone ? 'تم تحديث رقم الهاتف' : 'تم تحديث أوقات العمل',
      });

      syncPublicPage(restaurantId).catch(() => {});
      onSaved?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: 'destructive', title: 'خطأ', description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل جميع الفروع ({branches.length})</DialogTitle>
          <DialogDescription>
            عدّل البيانات المشتركة بين جميع الفروع دفعة واحدة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Phone */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyPhone}
                onChange={(e) => setApplyPhone(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-medium">رقم الهاتف</span>
            </label>
            {applyPhone && (
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                className="h-9 text-sm"
                dir="ltr"
              />
            )}
          </div>

          <div className="h-px bg-gray-100" />

          {/* Opening Hours */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyHours}
                onChange={(e) => setApplyHours(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-medium">أوقات العمل</span>
            </label>

            {applyHours && (
              <>
                <div className="flex items-end gap-2">
                  <TimePicker
                    value={openTime}
                    onChange={setOpenTime}
                    label="الفتح"
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground mb-3">—</span>
                  <TimePicker
                    value={closeTime}
                    onChange={setCloseTime}
                    label="الإغلاق"
                    className="flex-1"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFriday}
                    onChange={(e) => {
                      setShowFriday(e.target.checked);
                      if (!e.target.checked) {
                        setFridayOpen('');
                        setFridayClose('');
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-300"
                  />
                  <span className="text-xs text-muted-foreground">الجمعة مختلفة</span>
                </label>

                {showFriday && (
                  <div className="flex items-end gap-2">
                    <TimePicker
                      value={fridayOpen}
                      onChange={setFridayOpen}
                      label="فتح الجمعة"
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground mb-3">—</span>
                    <TimePicker
                      value={fridayClose}
                      onChange={setFridayClose}
                      label="إغلاق الجمعة"
                      className="flex-1"
                    />
                  </div>
                )}

                {openTime && closeTime && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-600">{hoursText}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Summary */}
          <div className="bg-blue-50 rounded-lg px-3 py-2.5 space-y-1">
            <p className="text-xs font-medium text-blue-800">سيتم التحديث في:</p>
            <div className="flex flex-wrap gap-1">
              {branches.map((b) => (
                <span key={b.id} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (!applyPhone && !applyHours)}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {saving ? 'جاري الحفظ...' : `تحديث ${branches.length} فرع`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
