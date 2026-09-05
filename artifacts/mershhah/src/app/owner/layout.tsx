'use client';

import { OwnerTopNav } from "@/components/shared/OwnerTopNav";
import React, { useEffect, useRef, memo } from "react";
import { AccountStatusChecker } from "@/components/auth/AccountStatusChecker";
import { OtpGate } from "@/components/auth/OtpGate";
import { useUser } from "@/hooks/useUser";
import { useRouter } from '@/lib/navigation';
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { AccessRequestBanner } from "@/components/dashboard/AccessRequestBanner";
import { useLanguage } from "@/components/shared/LanguageContext";
import { FullScreenLoader } from "@/components/shared/FullScreenLoader";

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
    return <FullScreenLoader />;
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
