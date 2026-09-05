'use client';

import { AdminTopNav } from "@/components/shared/AdminTopNav";
import React, { useEffect, useRef } from "react";
import { AdminAccountStatusChecker } from "@/components/auth/AdminAccountStatusChecker";
import { OtpGate } from "@/components/auth/OtpGate";
import { useUser } from "@/hooks/useUser";
import { useRouter } from '@/lib/navigation';
import { FullScreenLoader } from "@/components/shared/FullScreenLoader";

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
    return <FullScreenLoader />;
  }

  if (!user) return null;

  return (
    <OtpGate>
      <div dir="rtl">
        <AdminTopNav />
        <main className="p-4 sm:p-6">
          <AdminAccountStatusChecker>
            {children}
          </AdminAccountStatusChecker>
        </main>
      </div>
    </OtpGate>
  );
}
