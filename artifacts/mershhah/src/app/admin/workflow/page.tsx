'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, Task } from '@/lib/types';
import { Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AddTaskDialog } from '@/components/admin/workflow/AddTaskDialog';
import { TaskCard } from '@/components/admin/workflow/TaskCard';
import { useUser } from '@/hooks/useUser';

const columns: { id: Task['status']; title: string; color: string }[] = [
  { id: 'todo', title: 'جديد', color: 'bg-gray-400' },
  { id: 'in-progress', title: 'قيد التنفيذ', color: 'bg-blue-500' },
  { id: 'review', title: 'للمراجعة', color: 'bg-amber-500' },
  { id: 'done', title: 'تم', color: 'bg-emerald-500' },
];

export default function WorkflowPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [admins, setAdmins] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const { user } = useUser();
    const [myTasksOnly, setMyTasksOnly] = useState(false);

    const fetchAdmins = useCallback(async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin');
        if (error) {
            toast({ variant: "destructive", title: "خطأ في جلب المسؤولين", description: error.message });
        } else {
            setAdmins((data || []) as Profile[]);
        }
    }, [toast]);

    const fetchTasks = useCallback(async () => {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('createdAt', { ascending: false });
        if (error) {
            toast({ variant: "destructive", title: "خطأ في جلب المهام", description: error.message });
        } else {
            setTasks((data || []) as Task[]);
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

    useEffect(() => {
        fetchTasks();
        const channel = supabase.channel('admin_tasks')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchTasks]);

    const filteredTasks = useMemo(() => {
        if (!user) return [];
        if (myTasksOnly) return tasks.filter(task => task.assigneeId === user.uid);
        return tasks;
    }, [tasks, myTasksOnly, user]);

    const groupedTasks = useMemo(() => {
        return filteredTasks.reduce((acc, task) => {
            (acc[task.status] = acc[task.status] || []).push(task);
            return acc;
        }, {} as Record<Task['status'], Task[]>);
    }, [filteredTasks]);

    if (isLoading) {
        return (
            <div className="p-4 lg:p-6 space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <div className="flex gap-3">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="w-72 h-64 rounded-2xl shrink-0" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 flex flex-col h-[calc(100vh-8.5rem)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-gray-900">سير العمل</h1>
                    <p className="text-xs text-gray-400 mt-0.5">{tasks.length} مهمة</p>
                </div>
                <button
                    onClick={() => setMyTasksOnly(!myTasksOnly)}
                    className={`h-9 px-4 rounded-xl text-xs font-medium transition-all border ${myTasksOnly ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                    مهامي فقط
                </button>
            </div>

            {/* Columns */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex gap-3 items-start h-full min-w-max pb-4">
                    {columns.map((col) => {
                        const colTasks = groupedTasks[col.id] || [];
                        return (
                            <div key={col.id} className="w-72 shrink-0 flex flex-col h-full">
                                {/* Column Header */}
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <span className={`w-2 h-2 rounded-full ${col.color}`} />
                                    <h2 className="text-xs font-bold text-gray-700">{col.title}</h2>
                                    <span className="text-[10px] text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                                </div>

                                {/* Cards */}
                                <div className="flex-1 space-y-2 bg-gray-50/80 rounded-2xl p-2.5 min-h-[100px]">
                                    {colTasks.map(task => (
                                        <TaskCard key={task.id} task={task} onTaskUpdate={fetchTasks} />
                                    ))}
                                    {colTasks.length === 0 && (
                                        <div className="py-8 text-center text-[11px] text-gray-300">لا توجد مهام</div>
                                    )}
                                    <AddTaskDialog admins={admins} status={col.id} onTaskAdded={fetchTasks}>
                                        <button className="w-full h-9 rounded-xl border border-dashed border-gray-200 text-[11px] text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1 mt-1">
                                            <Plus className="h-3 w-3" />
                                            مهمة جديدة
                                        </button>
                                    </AddTaskDialog>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
