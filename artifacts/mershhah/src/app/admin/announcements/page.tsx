'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Announcement } from '@/lib/types';
import { AnnouncementsTable } from '@/components/admin/announcements/AnnouncementsTable';
import { EditAnnouncementDialog } from '@/components/admin/announcements/EditAnnouncementDialog';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      setAnnouncements((data || []) as Announcement[]);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ في جلب الإعلانات', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();

    const channel = supabase
      .channel('announcements-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        fetchAnnouncements();
      })
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
          <h1 className="text-lg font-bold text-gray-900">الإعلانات</h1>
          <p className="text-xs text-gray-400 mt-0.5">{announcements.length} إعلان</p>
        </div>
        <EditAnnouncementDialog onSave={fetchAnnouncements}>
          <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" />
            إعلان جديد
          </button>
        </EditAnnouncementDialog>
      </div>
      <AnnouncementsTable announcements={announcements} onActionComplete={fetchAnnouncements} />
    </div>
  );
}
