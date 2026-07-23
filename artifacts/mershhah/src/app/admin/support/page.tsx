
'use client';
import { MessageSquare } from 'lucide-react';
import { ChatList } from '@/components/admin/support/ChatList';

export default function AdminSupportPage() {
  return (
    <>
      {/* Mobile */}
      <div className="md:hidden h-full">
        <ChatList />
      </div>

      {/* Desktop */}
      <div className="hidden md:flex h-full flex-col items-center justify-center bg-gray-50/50 text-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <MessageSquare className="h-7 w-7 text-gray-300" />
        </div>
        <h3 className="text-sm font-bold text-gray-400">اختر محادثة من القائمة</h3>
        <p className="text-[11px] text-gray-300 mt-1 max-w-[200px]">
          محادثات الدعم مع أصحاب المطاعم تظهر هنا
        </p>
      </div>
    </>
  );
}
