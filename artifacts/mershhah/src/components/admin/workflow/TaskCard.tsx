'use client';

import { Badge } from '@/components/ui/badge';
import { Flag, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import type { Task } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface TaskCardProps {
  task: Task;
  onTaskUpdate: () => void;
}

const priorityConfig = {
  high: { label: 'عالية', dot: 'bg-red-400' },
  medium: { label: 'متوسطة', dot: 'bg-amber-400' },
  low: { label: 'منخفضة', dot: 'bg-blue-400' },
} as const;

const statusConfig = {
  todo: { label: 'جديد' },
  'in-progress': { label: 'قيد التنفيذ' },
  review: { label: 'للمراجعة' },
  done: { label: 'تم' },
};

const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : 'A';

export function TaskCard({ task, onTaskUpdate }: TaskCardProps) {
  const { toast } = useToast();
  const { label, dot } = priorityConfig[task.priority];

  const handleStatusChange = async (newStatus: Task['status']) => {
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
      if (error) throw error;
      toast({ title: 'تم تحديث الحالة' });
      onTaskUpdate();
    } catch (error: any) {
      toast({ title: 'خطأ', description: 'لم نتمكن من تحديث المهمة', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 hover:shadow-sm transition-shadow group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-[10px] text-gray-400">{label}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all">
              <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">تغيير الحالة</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={task.status} onValueChange={(val) => handleStatusChange(val as Task['status'])}>
                    {Object.entries(statusConfig).map(([key, value]) => (
                      <DropdownMenuRadioItem key={key} value={key} className="text-xs">{value.label}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs"><Pencil className="h-3.5 w-3.5 ml-2" /> تعديل</DropdownMenuItem>
            <DropdownMenuItem disabled className="text-xs text-red-600"><Trash2 className="h-3.5 w-3.5 ml-2" /> حذف</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-xs font-bold text-gray-800 mb-1">{task.title}</p>
      {task.description && <p className="text-[11px] text-gray-400 line-clamp-2">{task.description}</p>}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
          <span className="text-[9px] font-bold text-gray-500">{getInitials(task.assigneeName)}</span>
        </div>
        <span className="text-[10px] text-gray-300">
          {task.createdAt ? new Date(task.createdAt).toLocaleDateString('ar-SA') : ''}
        </span>
      </div>
    </div>
  );
}
