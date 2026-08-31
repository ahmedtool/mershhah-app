'use client';

import { OwnerTopNav } from "@/components/shared/OwnerTopNav";
import React, { useEffect, useRef, memo } from "react";
import { AccountStatusChecker } from "@/components/auth/AccountStatusChecker";
import { OtpGate } from "@/components/auth/OtpGate";
import { useUser } from "@/hooks/useUser";
import { useRouter } from '@/lib/navigation';
import { Loader2 } from "lucide-react";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { AccessRequestBanner } from "@/components/dashboard/AccessRequestBanner";
import { useLanguage } from "@/components/shared/LanguageContext";

function OwnerLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const { dir } = useLanguage();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (!isLoading && !user && !didRedirect.current) {
      didRedirect.current = true;
      router.push('/login');
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin h-6 w-6 text-gray-900" />
          <span className="text-xs font-bold text-gray-400">مرشح</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <OtpGate>
      <div dir={dir} className="min-h-screen bg-gray-50/50">
        <OwnerTopNav />
        <main className="p-4 sm:p-6">
          <AccessRequestBanner />
          <AnnouncementBanner />
          <AccountStatusChecker>
            {children}
          </AccountStatusChecker>
        </main>
      </div>
    </OtpGate>
  );
}

export default memo(function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OwnerLayoutContent>{children}</OwnerLayoutContent>;
});
