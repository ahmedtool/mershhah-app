'use client';

import { useState, useTransition, useEffect } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { OfferCard } from "@/components/dashboard/OfferCard";
import { PlusCircle, AlertTriangle } from "lucide-react";
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditOfferDialog } from '@/components/dashboard/EditOfferDialog';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

export default function OffersPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [offerToDelete, setOfferToDelete] = useState<any | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const { toast } = useToast();

  const [offers, setOffers] = useState<any[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(true);

  const fetchOffers = async (restId: string) => {
    const { data, error } = await supabase.from('offers').select('*').eq('restaurant_id', restId);
    if (!error) setOffers(data || []);
  };

  useEffect(() => {
    if (!isUserLoading && user?.restaurantId) {
      const restId = user.restaurantId;
      setRestaurantId(restId);
      setIsFetchingData(true);
      fetchOffers(restId).finally(() => setIsFetchingData(false));

      const channel = supabase
        .channel(`offers-${restId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `restaurant_id=eq.${restId}` }, () => fetchOffers(restId))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else if (!isUserLoading) {
      setIsFetchingData(false);
      return;
    }
    return;
  }, [isUserLoading, user]);

  const loadingData = isFetchingData || isUserLoading;

  const handleDelete = () => {
    if (!offerToDelete || !restaurantId) return;
    startDelete(async () => {
      const { error } = await supabase.from('offers').delete().eq('id', offerToDelete.id);
      if (error) {
        toast({ variant: "destructive", title: "خطأ في الحذف", description: error.message });
      } else {
        toast({ title: "تم حذف العرض بنجاح" });
        fetchOffers(restaurantId);
      }
      setOfferToDelete(null);
    });
  };

  return (
    <>
      <div className="space-y-5">
        <PageHeader title="إدارة العروض" description="سوّ عروض ترويجية عشان تجذب زباين أكثر.">
          <EditOfferDialog restaurantId={restaurantId!} userId={user?.uid} onSave={() => restaurantId && fetchOffers(restaurantId)}>
            <button disabled={loadingData || !restaurantId}
              className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
              <PlusCircle className="h-3.5 w-3.5" />
              عرض جديد
            </button>
          </EditOfferDialog>
        </PageHeader>

        {loadingData && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}

        {!loadingData && offers.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-5 w-5 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-900 mb-1">لا توجد عروض</p>
            <p className="text-[11px] text-gray-400">أضف عروض جديدة لتظهر هنا</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {!loadingData && restaurantId && offers.map(offer => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onDelete={() => setOfferToDelete(offer)}
              restaurantId={restaurantId}
              onActionCompletion={() => fetchOffers(restaurantId)}
            />
          ))}
        </div>
      </div>

      <AlertDialog open={!!offerToDelete} onOpenChange={(open) => !open && setOfferToDelete(null)}>
        <AlertDialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0" dir="rtl">
          <div className="px-5 pt-5 pb-3">
            <AlertDialogTitle className="text-base font-black text-gray-900">حذف العرض</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-400 mt-0.5">
              سيتم حذف "{offerToDelete?.title}" نهائياً
            </AlertDialogDescription>
          </div>
          <div className="flex flex-wrap gap-2 px-5 pb-5 pt-2">
            <AlertDialogCancel disabled={isDeleting} className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}
              className="flex-1 h-10 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">
              {isDeleting ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
