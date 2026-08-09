'use client';

import { AdminTopNav } from "@/components/shared/AdminTopNav";
import { AdminSidebar } from "@/components/shared/AdminSidebar";
import React, { useEffect, useRef } from "react";
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
    <div dir="rtl">
      <SessionTimeout />
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <AdminTopNav />
          <main className="p-4 sm:p-6 flex-1">
            <AdminAccountStatusChecker>
              {children}
            </AdminAccountStatusChecker>
          </main>
        </div>
      </div>
    </div>
  );
}
