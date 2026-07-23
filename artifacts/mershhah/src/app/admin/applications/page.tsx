'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Application } from "@/lib/types";
import { ApplicationsTable } from "@/components/admin/applications/ApplicationsTable";
import { EditApplicationDialog } from "@/components/admin/applications/EditApplicationDialog";

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchApplications = async () => {
        const { data, error } = await supabase.from('applications').select('*');
        if (error) {
            toast({ variant: "destructive", title: "خطأ في جلب التطبيقات", description: error.message });
        } else {
            setApplications((data || []) as Application[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        setIsLoading(true);
        fetchApplications();

        const channel = supabase.channel('admin_applications')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, fetchApplications)
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
                    <h1 className="text-lg font-bold text-gray-900">التطبيقات</h1>
                    <p className="text-xs text-gray-400 mt-0.5">{applications.length} تطبيق متاح</p>
                </div>
                <EditApplicationDialog onSave={fetchApplications}>
                    <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        تطبيق جديد
                    </button>
                </EditApplicationDialog>
            </div>
            <ApplicationsTable applications={applications} onActionComplete={fetchApplications} />
        </div>
    );
}
