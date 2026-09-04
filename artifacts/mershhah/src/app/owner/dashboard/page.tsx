'use client';

import Analytics from "@/components/dashboard/Analytics";
import PageHeader from "@/components/dashboard/PageHeader";
import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/shared/LanguageContext";

export default function OwnerDashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleRefresh = () => {
    startTransition(() => {
      setRefreshKey(prev => prev + 1);
      toast({ title: t('dashboard.refreshingData') });
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')}>
        <button onClick={handleRefresh} disabled={isPending}
          className="h-9 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          {t('menu.refresh')}
        </button>
      </PageHeader>
      <Analytics key={refreshKey} />
    </div>
  );
}
