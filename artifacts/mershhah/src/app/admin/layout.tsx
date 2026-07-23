'use client';

import { AdminTopNav } from "@/components/shared/AdminTopNav";
import React, { useEffect } from "react";
import { AdminAccountStatusChecker } from "@/components/auth/AdminAccountStatusChecker";
import { useUser } from "@/hooks/useUser";
import { useRouter } from '@/lib/navigation';
import { Loader2 } from "lucide-react";
import { SessionTimeout } from "@/components/shared/SessionTimeout";
import { useLanguage } from "@/components/shared/LanguageContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  return (
    <div dir={dir}>
      <SessionTimeout />
      <AdminTopNav />
      <main className="p-4 sm:p-6">
        <AdminAccountStatusChecker>
          {children}
        </AdminAccountStatusChecker>
      </main>
    </div>
  );
}
