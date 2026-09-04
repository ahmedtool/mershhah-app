'use client';

import { useRef, useState } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { UploadCloud, FileSpreadsheet, RotateCw, Receipt, Calendar, ListOrdered, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseDeliveryReport, type ParsedDeliveryReport } from '@/lib/delivery-report-reader';

export default function HungerStationReportsReaderPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [report, setReport] = useState<ParsedDeliveryReport | null>(null);

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseDeliveryReport(file);
      if (parsed.rowCount === 0) {
        toast({ variant: 'destructive', title: 'ما قدرنا نقرأ صفوف من الملف', description: 'تأكد إن الملف تصدير حقيقي من هنقرستيشن' });
        setReport(null);
      } else {
        setReport(parsed);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'تعذّرت قراءة الملف', description: error.message });
      setReport(null);
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
    setReport(null);
    setFileName(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="قارئ تقارير هنقرستيشن"
        description="ارفع ملف التقرير اللي تصدّره من لوحة تحكم هنقرستيشن للتجار، ونطلع لك ملخص واضح بالأرقام."
      />

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />

      {!report && (
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
              <UploadCloud className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-700">ارفع ملف تقرير هنقرستيشن</p>
              <p className="text-xs text-gray-600 mt-1">Excel (.xlsx) أو CSV</p>
            </>
          )}
        </div>
      )}

      {report && (
        <div className="space-y-5">
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="text-xs font-bold text-gray-700 truncate">{fileName}</span>
            </div>
            <button onClick={reset} className="h-8 px-3 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 shrink-0">
              <RotateCw className="h-3.5 w-3.5" /> ملف جديد
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <ListOrdered className="h-4 w-4 text-gray-600 mb-2" />
              <p className="text-lg font-black text-gray-900">{report.rowCount}</p>
              <p className="text-[11px] text-gray-600">عدد الصفوف</p>
            </div>
            {report.totalAmount !== null && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <Receipt className="h-4 w-4 text-orange-400 mb-2" />
                <p className="text-lg font-black text-gray-900">{report.totalAmount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}</p>
                <p className="text-[11px] text-gray-600">إجمالي "{report.amountColumn}"</p>
              </div>
            )}
            {report.dateRange && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <Calendar className="h-4 w-4 text-gray-600 mb-2" />
                <p className="text-xs font-black text-gray-900">{report.dateRange.from} → {report.dateRange.to}</p>
                <p className="text-[11px] text-gray-600">الفترة</p>
              </div>
            )}
          </div>

          {report.topItems.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-900">الأكثر تكراراً في "{report.itemColumn}"</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {report.topItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <span className="font-medium text-gray-700 truncate">{item.name}</span>
                    <span className="text-gray-600 shrink-0 mr-3">{item.count} مرة{item.total > 0 ? ` · ${item.total.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}` : ''}</span>
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
                    {report.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-right font-bold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      {report.headers.map((h) => (
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
  );
}
