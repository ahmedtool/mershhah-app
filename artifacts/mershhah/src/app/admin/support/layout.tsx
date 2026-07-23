'use client';
import { ChatList } from '@/components/admin/support/ChatList';
import { Card } from '@/components/ui/card';

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Card className="h-[calc(100vh-8.5rem)] md:grid md:grid-cols-3 xl:grid-cols-4 overflow-hidden" dir="rtl">
      <div className="hidden md:block border-s">
        <ChatList />
      </div>
      <div className="md:col-span-2 xl:col-span-3 h-full">
        {children}
      </div>
    </Card>
  );
}
