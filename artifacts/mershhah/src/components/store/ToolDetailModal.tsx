'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Check, Lock, Loader2, Tag, UserRound, XCircle } from 'lucide-react';
import { Link } from 'wouter';
import { StorageImage } from '@/components/shared/StorageImage';
import { toolGradient } from '@/lib/tool-gradient';
import { cn } from '@/lib/utils';

export function ToolDetailModal({
  tool,
  open,
  onOpenChange,
  installing,
  hasPaidPlan,
  onActivate,
  onDeactivate,
  categoryLabel,
}: {
  tool: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installing: string | null;
  hasPaidPlan: boolean;
  onActivate: (tool: any) => void;
  onDeactivate: (tool: any) => Promise<void>;
  categoryLabel: string;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  if (!tool) return null;
  const Icon = tool.icon;
  const isBusy = installing === tool.id;
  const gallery: string[] = Array.isArray(tool.screenshots) ? tool.screenshots.filter(Boolean) : [];
  const isLocked = tool.type === 'paid' && (tool.billing_type || 'plan') === 'plan' && !hasPaidPlan && !tool.installed;

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      await onDeactivate(tool);
      setConfirmingCancel(false);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-[28px]" dir="rtl">
          <DialogTitle className="sr-only">{tool.title}</DialogTitle>
          <DialogDescription className="sr-only">{tool.description}</DialogDescription>

          {/* Hero media */}
          {gallery.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar p-3 pb-0">
              {gallery.map((path, i) => (
                <div key={i} className="snap-start shrink-0 w-[85%] first:mr-0 rounded-2xl overflow-hidden bg-gray-50 aspect-[4/3]">
                  <StorageImage imagePath={path} alt={`${tool.title} ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : tool.image_path ? (
            <div className="p-3 pb-0">
              <div className="rounded-2xl overflow-hidden bg-gray-50 aspect-[16/9]">
                <StorageImage imagePath={tool.image_path} alt={tool.title} className="w-full h-full object-cover" />
              </div>
            </div>
          ) : (
            <div className="p-3 pb-0">
              <div
                className="rounded-2xl aspect-[16/9] flex items-center justify-center relative overflow-hidden"
                style={{ background: toolGradient(tool) }}
              >
                <Icon className="absolute -left-8 -bottom-8 h-40 w-40 text-white/10" strokeWidth={1.5} />
                <Icon className="h-14 w-14 text-white relative z-10" strokeWidth={2} />
              </div>
            </div>
          )}

          <div className="p-5">
            {/* Title row */}
            <div className="flex items-start gap-3.5 mb-4">
              {tool.image_path ? (
                <div className="w-14 h-14 rounded-[18px] shrink-0 overflow-hidden shadow-sm bg-gray-50">
                  <StorageImage imagePath={tool.image_path} alt={tool.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={cn("w-14 h-14 rounded-[18px] shrink-0 flex items-center justify-center shadow-sm", tool.bg_color)}>
                  <Icon className={cn("h-7 w-7", tool.color)} strokeWidth={2} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black text-gray-900">{tool.title}</h2>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-gray-600">
                    <Tag className="h-3 w-3" /> {categoryLabel}
                  </span>
                  {tool.developer_name && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-gray-600">
                      <UserRound className="h-3 w-3" /> {tool.developer_name}
                    </span>
                  )}
                  {tool.version && <span className="text-[10.5px] text-gray-600">v{tool.version}</span>}
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line">{tool.description}</p>

            {/* Price */}
            <div className="mt-4 bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-600">السعر</p>
                <p className="text-sm font-black text-gray-900 mt-0.5">{tool.price_label}</p>
              </div>
              {tool.installed && tool.expires_at && (
                <div className="text-left">
                  <p className="text-[10px] text-gray-600">صالحة حتى</p>
                  <p className="text-[11px] font-bold text-gray-700 mt-0.5">
                    {new Date(tool.expires_at).toLocaleDateString('ar-SA')}
                  </p>
                </div>
              )}
            </div>

            {/* Action */}
            <div className="mt-5">
              {tool.installed ? (
                <div className="space-y-2">
                  <div className="h-11 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" /> الأداة مُفعّلة
                  </div>
                  <button
                    onClick={() => setConfirmingCancel(true)}
                    className="w-full h-11 rounded-xl border border-red-100 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-4 w-4" /> إلغاء التفعيل
                  </button>
                </div>
              ) : isLocked ? (
                <Link
                  href="/owner/billing"
                  className="w-full h-12 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="h-4 w-4" /> رقّي باقتك لتفعيل هذي الأداة
                </Link>
              ) : (
                <button
                  onClick={() => onActivate(tool)}
                  disabled={!!installing}
                  className="w-full h-12 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isBusy
                    ? (tool.type === 'paid' && tool.billing_type === 'addon' ? 'جاري تحويلك للدفع...' : 'جاري التفعيل...')
                    : (tool.type === 'paid' && tool.billing_type === 'addon' ? `اشترك الآن — ${tool.price_label}` : 'تفعيل الأداة')}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingCancel} onOpenChange={(o) => !isCancelling && setConfirmingCancel(o)}>
        <AlertDialogContent className="sm:max-w-md p-0 gap-0" dir="rtl">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <AlertDialogTitle className="text-base font-bold text-gray-900">إلغاء تفعيل "{tool.title}"؟</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 mt-0.5">
              راح تفقد الوصول لها فوراً. تقدر تفعّلها مرة ثانية بأي وقت.
            </AlertDialogDescription>
          </div>
          <div className="flex gap-2 px-5 pb-5 pt-3">
            <AlertDialogCancel disabled={isCancelling} className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">
              تراجع
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmCancel(); }}
              disabled={isCancelling}
              className="flex-1 h-10 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {isCancelling ? 'جاري الإلغاء...' : 'نعم، إلغاء التفعيل'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
