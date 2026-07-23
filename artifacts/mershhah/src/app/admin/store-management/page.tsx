'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { EditToolDialog } from "@/components/admin/store/EditToolDialog";
import { ToolsTable } from "@/components/admin/store/ToolsTable";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";

export default function StoreManagementPage() {
    const [tools, setTools] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchTools = async () => {
        const { data, error } = await supabase.from('tools').select('*');
        if (error) {
            toast({ title: "فشل تحميل الأدوات", variant: "destructive", description: error.message });
        } else {
            setTools(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        setIsLoading(true);
        fetchTools();

        const channel = supabase.channel('admin_tools')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tools' }, fetchTools)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    if (isLoading) {
        return (
            <div className="p-4 lg:p-6 space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-gray-900">متجر الأدوات</h1>
                    <p className="text-xs text-gray-400 mt-0.5">{tools.length} أداة متاحة</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/admin/store/developers">
                        <button className="h-10 px-4 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <ExternalLink className="h-3.5 w-3.5" />
                            دليل المطورين
                        </button>
                    </Link>
                    <EditToolDialog onSave={fetchTools} allTools={tools}>
                        <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            أداة جديدة
                        </button>
                    </EditToolDialog>
                </div>
            </div>
            <ToolsTable tools={tools} onActionComplete={fetchTools} />
        </div>
    );
}
