'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Package, Users, BarChart3, ExternalLink, Plus } from "lucide-react";
import { EditToolDialog } from "@/components/admin/store/EditToolDialog";

export default function AdminStorePage() {
  const [tools, setTools] = useState<any[]>([]);
  const [activations, setActivations] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [toolsRes, activationsRes] = await Promise.all([
        supabase.from('tools').select('*'),
        supabase.from('activated_tools').select('id', { count: 'exact', head: true }),
      ]);
      setTools(toolsRes.data || []);
      setActivations(activationsRes.count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('admin_store_overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tools' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-5">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">متجر الأدوات</h1>
          <p className="text-xs text-gray-600 mt-0.5">نظرة عامة على أدوات المنصة</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/store/developers">
            <button className="h-10 px-4 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              دليل المطورين
            </button>
          </Link>
          <Link href="/admin/store-management">
            <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
              <Plus className="h-4 w-4" />
              إدارة المتجر
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الأدوات', value: tools.length, icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'التفعيلات', value: activations, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'أدوات مجانية', value: tools.filter(t => t.type !== 'paid').length, icon: BarChart3, color: 'text-cyan-500', bg: 'bg-cyan-50' },
          { label: 'أدوات مدفوعة', value: tools.filter(t => t.type === 'paid').length, icon: BarChart3, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-gray-600">{stat.label}</p>
                <p className="text-lg font-black text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tools.map(tool => (
          <div key={tool.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${tool.bg_color || 'bg-gray-50'} ${tool.color || 'text-gray-600'} flex items-center justify-center`}>
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate">{tool.title}</h3>
                <p className="text-[10px] text-gray-600 font-mono">{tool.id}</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-600 line-clamp-2 mb-3">{tool.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">{tool.price_label}</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{tool.category}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
