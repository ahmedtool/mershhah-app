'use client';

import { OwnerTopNav } from "@/components/shared/OwnerTopNav";
import React, { useEffect, memo } from "react";
import { AccountStatusChecker } from "@/components/auth/AccountStatusChecker";
import { useUser } from "@/hooks/useUser";
import { useRouter } from '@/lib/navigation';
import { Loader2 } from "lucide-react";
import { DashboardAssistant } from "@/components/dashboard/DashboardAssistant";
import { SessionTimeout } from "@/components/shared/SessionTimeout";
import { useLanguage } from "@/components/shared/LanguageContext";

function OwnerLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const { dir } = useLanguage();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-gray-300" />
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen bg-gray-50/50">
      <SessionTimeout />
      <OwnerTopNav />
      <main className="p-4 sm:p-6">
        <AccountStatusChecker>
          {children}
        </AccountStatusChecker>
      </main>
      <DashboardAssistant />
    </div>
  );
}

export default memo(function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OwnerLayoutContent>{children}</OwnerLayoutContent>;
});
