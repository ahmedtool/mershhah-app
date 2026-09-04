'use client';

import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Box, Loader2, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { StorageImage } from "@/components/shared/StorageImage";
import { getToolIcon } from "@/lib/tool-icons";

export default function OwnerToolsPage() {
    const { user } = useUser();
    const [tools, setTools] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTools = async () => {
            if (!user?.id) return;
            try {
                const { data: activated, error: actError } = await supabase
                    .from('activated_tools')
                    .select('tool_id, activated_at, expires_at')
                    .eq('profile_id', user.id)
                    .eq('status', 'active');

                if (actError) {
                    console.error('Error fetching activated tools:', actError);
                    setTools([]);
                    return;
                }

                if (!activated || activated.length === 0) {
                    setTools([]);
                    return;
                }

                const toolIds = activated.map(a => a.tool_id);
                const { data: toolsData, error: toolsError } = await supabase
                    .from('tools')
                    .select('*')
                    .in('id', toolIds);

                if (toolsError) {
                    console.error('Error fetching tools:', toolsError);
                }

                const merged = (toolsData || []).map(tool => {
                    const activation = activated.find(a => a.tool_id === tool.id);
                    return {
                        ...tool,
                        activated_at: activation?.activated_at,
                        expires_at: activation?.expires_at,
                        Icon: getToolIcon(tool.icon),
                    };
                });
                setTools(merged);
            } catch (error) {
                console.error("Error fetching tools:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTools();
    }, [user]);

    const isExpired = (expiresAt?: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            <PageHeader title="أدواتي" description="أدوات إضافية تساعدك على النمو" />
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
                </div>
            ) : tools.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                        <Wrench className="h-12 w-12 text-gray-200" />
                        <p className="text-gray-400 text-center text-sm">لا توجد أدوات مفعّلة حالياً</p>
                        <Link href="/owner/store">
                            <button className="h-10 px-5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors">
                                متجر الأدوات
                            </button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map(tool => {
                        const IconComp = tool.Icon;
                        const expired = isExpired(tool.expires_at);
                        return (
                            <div key={tool.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                                <div className={`p-4 text-center ${tool.bg_color || 'bg-gray-50'}`}>
                                    {tool.image_path ? (
                                        <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto mb-2 bg-white/80 border border-white/50">
                                            <StorageImage imagePath={tool.image_path} alt={tool.title} className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-white/80 border border-white/50 flex items-center justify-center mx-auto mb-2">
                                            <IconComp className={`h-6 w-6 ${tool.color || 'text-gray-600'}`} />
                                        </div>
                                    )}
                                    <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{tool.description}</p>
                                    {tool.expires_at && (
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                            <Clock className="h-3 w-3 text-gray-300" />
                                            <span className={expired ? 'text-red-500 font-bold' : 'text-gray-400'}>
                                                {expired ? 'منتهية الصلاحية' : `صالح حتى ${new Date(tool.expires_at).toLocaleDateString('ar-SA')}`}
                                            </span>
                                        </div>
                                    )}
                                    <Link href={`/owner/tools/${tool.id}`}>
                                        <button className="w-full h-9 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                                            فتح الأداة
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
