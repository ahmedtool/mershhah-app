'use client';

import { useRef, useState } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { UploadCloud, FileSpreadsheet, RotateCw, Receipt, Calendar, ListOrdered, Loader2, TrendingDown, AlertTriangle, Lightbulb, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseDeliveryReport, type ParsedDeliveryReport } from '@/lib/delivery-report-reader';
import { parseKeetaOrderLog, generateKeetaInsights, type KeetaOrderLogSummary } from '@/lib/keeta-order-log-parser';
import { cn } from '@/lib/utils';

const sar = (n: number) => `${n.toLocaleString('ar-SA', { maximumFractionDigits: 0 })} ر.س`;

const VERDICT_STYLE = {
  good: { label: 'جيد', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  review: { label: 'يحتاج مراجعة', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  costly: { label: 'مكلف', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
} as const;

function WaterfallRow({ label, value, isFinal }: { label: string; value: number; isFinal?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-2.5", !isFinal && "border-b border-gray-50")}>
      <span className={cn("text-xs", isFinal ? "font-bold text-gray-900" : "text-gray-500")}>{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", isFinal ? "text-emerald-600 text-sm" : "text-red-500")}>
        {isFinal ? sar(value) : `- ${sar(value)}`}
      </span>
    </div>
  );
}

export default function KeetaReportsReaderPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [orderLog, setOrderLog] = useState<KeetaOrderLogSummary | null>(null);
  const [genericReport, setGenericReport] = useState<ParsedDeliveryReport | null>(null);
  const [showRawTable, setShowRawTable] = useState(false);

  const hasReport = !!orderLog || !!genericReport;

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    try {
      const keetaSummary = await parseKeetaOrderLog(file);
      if (keetaSummary) {
        setOrderLog(keetaSummary);
        setGenericReport(null);
        return;
      }

      const generic = await parseDeliveryReport(file);
      if (generic.rowCount === 0) {
        toast({ variant: 'destructive', title: 'ما قدرنا نقرأ صفوف من الملف', description: 'تأكد إن الملف تصدير حقيقي من كيتا' });
      } else {
        setGenericReport(generic);
        setOrderLog(null);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'تعذّرت قراءة الملف', description: error.message });
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleFile(file);
  };

  const reset = () => {
    setOrderLog(null);
    setGenericReport(null);
    setFileName(null);
    setShowRawTable(false);
  };

  const insights = orderLog ? generateKeetaInsights(orderLog) : null;
  const verdict = orderLog ? VERDICT_STYLE[orderLog.verdict] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="قارئ تقارير كيتا"
        description="ارفع تقرير سجل الطلبات اللي تصدّره من لوحة تحكم كيتا للتجار، ونطلع لك القصة: وش صار بفلوسك ووش تسوي حياله."
      />

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />

      {!hasReport && (
        <div
          onClick={() => !isParsing && fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-gray-50 transition-colors"
        >
          {isParsing ? (
            <>
              <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-700">جاري قراءة {fileName}...</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-700">ارفع ملف تقرير سجل الطلبات من كيتا</p>
              <p className="text-xs text-gray-400 mt-1">Excel (.xlsx) أو CSV</p>
            </>
          )}
        </div>
      )}

      {hasReport && (
        <div className="space-y-5">
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-bold text-gray-700 truncate">{fileName}</span>
            </div>
            <button onClick={reset} className="h-8 px-3 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50 flex items-center gap-1.5 shrink-0">
              <RotateCw className="h-3.5 w-3.5" /> ملف جديد
            </button>
          </div>

          {orderLog && insights && verdict && (
            <>
              {/* Headline */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">ملخص الفلوس</h3>
                  <span className={cn("flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full", verdict.bg, verdict.text)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", verdict.dot)} />
                    {verdict.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-lg font-black text-gray-900">{sar(orderLog.totalOriginalPrice)}</p>
                    <p className="text-[10px] text-gray-400">إجمالي المبيعات</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-emerald-600">{sar(orderLog.totalProfit)}</p>
                    <p className="text-[10px] text-gray-400">وصلك فعلياً</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-red-500">{sar(orderLog.gap)}</p>
                    <p className="text-[10px] text-gray-400">الفرق</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
                  كل 100 ريال مبيعات عن طريق كيتا، يبقى لك تقريباً <span className="font-bold text-gray-900">{orderLog.netPer100} ريال</span> قبل تكلفة الأكل والتشغيل. ({orderLog.orderCount} طلب{orderLog.dateRange ? ` · ${orderLog.dateRange.from} → ${orderLog.dateRange.to}` : ''})
                </p>
              </div>

              {/* Waterfall */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900">وين راحت فلوسي؟</h3>
                </div>
                <div className="mt-3">
                  <WaterfallRow label="مبيعاتك" value={orderLog.totalOriginalPrice} isFinal />
                  <WaterfallRow label="عمولة كيتا" value={orderLog.totalCommission} />
                  {orderLog.totalMerchantPromo > 0 && <WaterfallRow label="خصومات تحملتها" value={orderLog.totalMerchantPromo} />}
                  {orderLog.totalPaymentFee > 0 && <WaterfallRow label="رسوم الدفع الإلكتروني" value={orderLog.totalPaymentFee} />}
                  {orderLog.totalMinOrderDiff > 0 && <WaterfallRow label="فارق الحد الأدنى للطلب" value={orderLog.totalMinOrderDiff} />}
                  {orderLog.otherGap > 1 && <WaterfallRow label="رسوم/تعديلات أخرى" value={orderLog.otherGap} />}
                  <div className="pt-2.5">
                    <WaterfallRow label="الصافي المحول لك" value={orderLog.totalProfit} isFinal />
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {insights.alerts.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-gray-900">تنبيهات</h3>
                  </div>
                  <ul className="space-y-2">
                    {insights.alerts.map((a, i) => (
                      <li key={i} className="text-[11px] text-gray-700 leading-relaxed flex gap-2">
                        <span className="text-amber-500 shrink-0">•</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              <div className="bg-gray-900 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">وش أسوي الحين؟</h3>
                </div>
                <ol className="space-y-2.5">
                  {insights.recommendations.map((r, i) => (
                    <li key={i} className="text-[11px] text-gray-300 leading-relaxed flex gap-2.5">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-white/10 text-white text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Raw table toggle */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <button onClick={() => setShowRawTable((v) => !v)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-gray-900">
                  تفاصيل كل طلب ({orderLog.orderCount})
                  <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", showRawTable && "rotate-180")} />
                </button>
                {showRawTable && (
                  <div className="overflow-x-auto max-h-[480px] overflow-y-auto border-t border-gray-50">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-right font-bold text-gray-500 whitespace-nowrap">الوقت</th>
                          <th className="px-3 py-2 text-right font-bold text-gray-500 whitespace-nowrap">الأصناف</th>
                          <th className="px-3 py-2 text-right font-bold text-gray-500 whitespace-nowrap">السعر الأصلي</th>
                          <th className="px-3 py-2 text-right font-bold text-gray-500 whitespace-nowrap">الأرباح</th>
                          <th className="px-3 py-2 text-right font-bold text-gray-500 whitespace-nowrap">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {orderLog.orders.map((o) => (
                          <tr key={o.orderId} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{o.orderTime}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate" title={o.items.join('، ')}>{o.items.join('، ')}</td>
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{sar(o.originalPrice)}</td>
                            <td className="px-3 py-2 text-emerald-600 font-bold whitespace-nowrap">{sar(o.profit)}</td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{o.isRefunded ? 'استرداد' : o.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {genericReport && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <ListOrdered className="h-4 w-4 text-gray-300 mb-2" />
                  <p className="text-lg font-black text-gray-900">{genericReport.rowCount}</p>
                  <p className="text-[11px] text-gray-400">عدد الصفوف</p>
                </div>
                {genericReport.totalAmount !== null && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <Receipt className="h-4 w-4 text-emerald-400 mb-2" />
                    <p className="text-lg font-black text-gray-900">{genericReport.totalAmount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}</p>
                    <p className="text-[11px] text-gray-400">إجمالي "{genericReport.amountColumn}"</p>
                  </div>
                )}
                {genericReport.dateRange && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <Calendar className="h-4 w-4 text-gray-300 mb-2" />
                    <p className="text-xs font-black text-gray-900">{genericReport.dateRange.from} → {genericReport.dateRange.to}</p>
                    <p className="text-[11px] text-gray-400">الفترة</p>
                  </div>
                )}
              </div>

              {genericReport.topItems.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">الأكثر تكراراً في "{genericReport.itemColumn}"</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {genericReport.topItems.map((item) => (
                      <div key={item.name} className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <span className="font-medium text-gray-700 truncate">{item.name}</span>
                        <span className="text-gray-400 shrink-0 mr-3">{item.count} مرة{item.total > 0 ? ` · ${item.total.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50">
                  <h3 className="text-sm font-bold text-gray-900">بيانات الملف الكاملة</h3>
                </div>
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        {genericReport.headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-right font-bold text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {genericReport.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          {genericReport.headers.map((h) => (
                            <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap">{String(row[h] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
