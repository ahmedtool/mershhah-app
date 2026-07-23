'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/dashboard/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { EditBranchDialog } from '@/components/dashboard/EditBranchDialog';
import { BranchesList } from '@/components/dashboard/BranchesList';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import type { Branch } from '@/lib/types';

export default function BranchesPage() {
  const { user, isLoading: userLoading } = useUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const restaurantId = user?.restaurantId ?? '';

  const fetchBranches = async () => {
    if (!restaurantId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('branches').select('*').eq('restaurant_id', restaurantId);
    setBranches((data || []) as Branch[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    fetchBranches();
    const channel = supabase
      .channel(`branches-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches', filter: `restaurant_id=eq.${restaurantId}` }, fetchBranches)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  if (userLoading) {
    return (
      <div className="space-y-5" dir="rtl">
        <Skeleton className="h-10 w-48 rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader title="إدارة الفروع" description="أضف وعُدّل فروع مطعمك من قائمة واحدة.">
        {restaurantId && (
          <button type="button" onClick={() => setAddOpen(true)}
            className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            إضافة فرع
          </button>
        )}
      </PageHeader>

      {loading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (
        <BranchesList branches={branches} restaurantId={restaurantId} onChanged={fetchBranches} />
      )}

      {restaurantId && (
        <EditBranchDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          restaurantId={restaurantId}
          onSaved={() => { setAddOpen(false); fetchBranches(); }}
        />
      )}
    </div>
  );
}
