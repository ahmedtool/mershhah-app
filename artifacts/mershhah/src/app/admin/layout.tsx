'use client';

import { AdminTopNav } from "@/components/shared/AdminTopNav";
import { AdminSidebar } from "@/components/shared/AdminSidebar";
import React, { useEffect } from "react";
import { AdminAccountStatusChecker } from "@/components/auth/AdminAccountStatusChecker";
import { useUser } from "@/hooks/useUser";
import { useRouter } from '@/lib/navigation';
import { Loader2 } from "lucide-react";
import { SessionTimeout } from "@/components/shared/SessionTimeout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useUser();
  const router = useRouter();

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
    <div className="flex min-h-screen" dir="rtl">
      <SessionTimeout />
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopNav />
        <main className="p-4 sm:p-6 flex-1">
          <AdminAccountStatusChecker>
            {children}
          </AdminAccountStatusChecker>
        </main>
      </div>
    </div>
  );
}
