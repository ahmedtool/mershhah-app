'use client';
import { MessageSquare } from 'lucide-react';

export default function AdminSupportPage() {
  return (
    <div className="h-full flex items-center justify-center text-center p-4">
      <div>
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 mx-auto">
          <MessageSquare className="h-7 w-7 text-gray-300" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">اختر محادثة</h3>
        <p className="text-[11px] text-gray-400 max-w-[200px]">
          اختر محادثة من القائمة أو اضغط + لبدء محادثة جديدة
        </p>
      </div>
    </div>
  );
}
