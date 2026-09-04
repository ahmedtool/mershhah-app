'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Box, Loader2, Clock, Settings, ExternalLink, ArrowRight } from "lucide-react";
import { useParams, Link, useLocation } from 'wouter';
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { Skeleton } from "@/components/ui/skeleton";
import { StorageImage } from "@/components/shared/StorageImage";
import { getToolIcon } from "@/lib/tool-icons";

export default function ToolDetailPage() {
    const params = useParams();
    const toolId = params.toolId as string;
    const { user } = useUser();
    const [tool, setTool] = useState<any>(null);
    const [activation, setActivation] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [config, setConfig] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchTool = async () => {
            if (!toolId) return;
            try {
                const [toolRes, activationRes] = await Promise.all([
                    supabase.from('tools').select('*').eq('id', toolId).single(),
                    user?.id ? supabase.from('activated_tools').select('*').eq('profile_id', user.id).eq('tool_id', toolId).single() : Promise.resolve({ data: null }),
                ]);
                setTool(toolRes.data);
                setActivation(activationRes.data);
                if (activationRes.data?.config) {
                    setConfig(activationRes.data.config);
                }
            } catch (error) {
                console.error("Error fetching tool:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTool();
    }, [toolId, user]);

    const handleSaveConfig = async () => {
        if (!user?.id || !toolId) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('activated_tools')
                .update({ config })
                .eq('profile_id', user.id)
                .eq('tool_id', toolId);
            if (error) throw error;
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 p-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
        );
    }

    if (!tool) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-4">
                <Wrench className="h-12 w-12 text-gray-200" />
                <h2 className="text-lg font-bold text-gray-900">الأداة غير موجودة</h2>
                <Link href="/owner/tools">
                    <button className="h-10 px-5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" />
                        العودة لأدواتي
                    </button>
                </Link>
            </div>
        );
    }

    const IconComp = getToolIcon(tool.icon);
    const expired = activation?.expires_at && new Date(activation.expires_at) < new Date();

    const toolPages: Record<string, string> = {
        'weekly-content-writer': '/owner/tools/weekly-content-writer',
        'summarize-feedback': '/owner/tools/summarize-feedback',
        'reply-templates': '/owner/tools/reply-templates',
        'marketing-calendar': '/owner/tools/marketing-calendar',
        'daily-pulse-dashboard': '/owner/tools/daily-pulse-dashboard',
    };

    const dedicatedPage = toolPages[toolId];

    return (
        <div className="space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/owner/tools">
                    <button className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </Link>
                {tool.image_path ? (
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-50">
                        <StorageImage imagePath={tool.image_path} alt={tool.title} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className={`w-14 h-14 rounded-2xl ${tool.bg_color || 'bg-gray-100'} ${tool.color || 'text-gray-600'} flex items-center justify-center`}>
                        <IconComp className="h-7 w-7" />
                    </div>
                )}
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900">{tool.title}</h1>
                    <p className="text-sm text-gray-400">{tool.description}</p>
                </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
                {activation ? (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${expired ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${expired ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        {expired ? 'منتهية الصلاحية' : 'مفعّلة'}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-500">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        غير مفعّلة
                    </div>
                )}
                {activation?.expires_at && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>صالح حتى {new Date(activation.expires_at).toLocaleDateString('ar-SA')}</span>
                    </div>
                )}
            </div>

            {/* Tool Content */}
            {tool.tool_type === 'external' && tool.external_url ? (
                <Card className="border-gray-100">
                    <CardContent className="p-0">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 rounded-t-2xl">
                            <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-[11px] text-gray-400 font-medium truncate" dir="ltr">{tool.external_url}</span>
                        </div>
                        <iframe
                            src={tool.external_url}
                            className="w-full min-h-[600px] border-0 rounded-b-2xl"
                            title={tool.title}
                            allow="fullscreen"
                        />
                    </CardContent>
                </Card>
            ) : tool.tool_type === 'embedded' && tool.content ? (
                <Card className="border-gray-100">
                    <CardContent className="p-0">
                        <iframe
                            srcDoc={tool.content}
                            className="w-full min-h-[600px] border-0 rounded-2xl"
                            title={tool.title}
                            sandbox="allow-scripts allow-forms allow-same-origin"
                            allow="fullscreen"
                        />
                    </CardContent>
                </Card>
            ) : dedicatedPage ? (
                <Card className="border-gray-100">
                    <CardContent className="p-0">
                        <iframe
                            src={dedicatedPage}
                            className="w-full min-h-[500px] border-0 rounded-2xl"
                            title={tool.title}
                        />
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-gray-100">
                    <CardContent className="p-8">
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            {tool.image_path ? (
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50">
                                    <StorageImage imagePath={tool.image_path} alt={tool.title} className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className={`w-16 h-16 rounded-2xl ${tool.bg_color || 'bg-gray-100'} ${tool.color || 'text-gray-600'} flex items-center justify-center`}>
                                    <IconComp className="h-8 w-8" />
                                </div>
                            )}
                            <h3 className="text-lg font-bold text-gray-900">{tool.title}</h3>
                            <p className="text-sm text-gray-400 max-w-md">{tool.description}</p>
                            {tool.price_label && (
                                <span className="text-sm font-bold text-gray-600">{tool.price_label}</span>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                                <Settings className="h-4 w-4 text-gray-300" />
                                <span className="text-xs text-gray-400">هذه الأداة قيد التطوير</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Integration Config */}
            {activation && !expired && (
                <Card className="border-gray-100">
                    <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-gray-400" />
                            <h3 className="text-sm font-bold text-gray-900">إعدادات الأداة</h3>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">رابط التكامل (اختياري)</label>
                                <input
                                    type="url"
                                    placeholder="https://api.example.com/webhook"
                                    value={config.integration_url || ''}
                                    onChange={(e) => setConfig({ ...config, integration_url: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">مفتاح API (اختياري)</label>
                                <input
                                    type="password"
                                    placeholder="sk-..."
                                    value={config.api_key || ''}
                                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                                    dir="ltr"
                                />
                            </div>
                            <button
                                onClick={handleSaveConfig}
                                disabled={saving}
                                className="h-10 px-5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                حفظ الإعدادات
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
