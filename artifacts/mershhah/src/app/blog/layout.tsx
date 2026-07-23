'use client';

import { useState, useEffect } from 'react';
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "@/components/shared/PublicFooter";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <div className="bg-white text-foreground min-h-screen overflow-x-hidden" dir="rtl">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <header className="py-6 flex justify-between items-center border-b gap-4" dir="rtl">
          <Logo />
          <Button asChild variant="outline" className="gap-2">
            <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden />
                العودة للرئيسية
            </Link>
          </Button>
        </header>
        <main className="py-8 md:py-12">
            {children}
        </main>
      </div>
      <PublicFooter />
    </div>
  );
}
