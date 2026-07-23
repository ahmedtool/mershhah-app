'use client';

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { AdminUsersTable } from "@/components/admin/team/AdminUsersTable";
import { AddAdminDialog } from "@/components/admin/team/AddAdminDialog";
import { Plus } from "lucide-react";

export default function TeamManagementPage() {
    const [admins, setAdmins] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchAdmins = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin');
        if (error) {
            toast({ variant: "destructive", title: "خطأ في جلب المسؤولين", description: error.message });
        } else {
            setAdmins((data || []) as Profile[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        setIsLoading(true);
        fetchAdmins();

        const channel = supabase.channel('admin_profiles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchAdmins)
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
                    <h1 className="text-lg font-bold text-gray-900">الفريق</h1>
                    <p className="text-xs text-gray-400 mt-0.5">{admins.length} مسؤول</p>
                </div>
                <AddAdminDialog onAdminAdded={fetchAdmins}>
                    <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        مسؤول جديد
                    </button>
                </AddAdminDialog>
            </div>
            <AdminUsersTable admins={admins} onActionComplete={fetchAdmins} />
        </div>
    );
}
