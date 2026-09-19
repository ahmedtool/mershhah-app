'use client';

import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Wrench, Clock, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { StorageImage } from "@/components/shared/StorageImage";
import { getToolIcon } from "@/lib/tool-icons";
import { useLanguage } from "@/components/shared/LanguageContext";
import { cn } from "@/lib/utils";

// Same category vocabulary as the tools store, so a tool sits under the same
// heading in both places. Anything outside this list (the store accepts any
// non-empty category text) still gets its own section, labelled by its raw
// name and placed after these.
const CATEGORY_ORDER = ['marketing', 'operations', 'analytics'];
const CATEGORY_LABEL_KEYS: Record<string, string> = {
    marketing: 'toolsStore.tabMarketing',
    operations: 'toolsStore.tabOperations',
    analytics: 'toolsStore.tabAnalytics',
};

export default function OwnerToolsPage() {
    const { user } = useUser();
    const { t, locale } = useLanguage();
    const isEnglish = locale === 'en';
    const [tools, setTools] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

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

                const toolIds = activated.map((a: any) => a.tool_id);
                const { data: toolsData, error: toolsError } = await supabase
                    .from('tools')
                    .select('*')
                    .in('id', toolIds);

                if (toolsError) {
                    console.error('Error fetching tools:', toolsError);
                }

                const merged = (toolsData || []).map((tool: any) => {
                    const activation = activated.find((a: any) => a.tool_id === tool.id);
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

    const titleOf = (tool: any) => (isEnglish && tool.title_en) || tool.title;
    const descriptionOf = (tool: any) => (isEnglish && tool.description_en) || tool.description;
    const categoryLabel = (category: string) => (CATEGORY_LABEL_KEYS[category] ? t(CATEGORY_LABEL_KEYS[category]) : category);

    // Search looks at both languages, so an owner can find a tool by either name.
    const searched = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return tools;
        return tools.filter(tool =>
            [tool.title, tool.title_en, tool.description, tool.description_en]
                .some(field => (field || '').toLowerCase().includes(q))
        );
    }, [tools, searchQuery]);

    // Chip counts follow the search, so they always match what the owner
    // would see after tapping a chip.
    const categoryCounts = useMemo(() => {
        const counts = new Map<string, number>();
        searched.forEach(tool => counts.set(tool.category || 'other', (counts.get(tool.category || 'other') || 0) + 1));
        return counts;
    }, [searched]);

    const allCategories = useMemo(() => {
        const present = new Set<string>(tools.map(tool => tool.category || 'other'));
        const known = CATEGORY_ORDER.filter(c => present.has(c));
        const extra = Array.from(present).filter(c => !CATEGORY_ORDER.includes(c)).sort();
        return [...known, ...extra];
    }, [tools]);

    const sections = useMemo(() => {
        return allCategories
            .filter(c => activeCategory === 'all' || activeCategory === c)
            .map(c => ({ category: c, items: searched.filter(tool => (tool.category || 'other') === c) }))
            .filter(section => section.items.length > 0);
    }, [allCategories, activeCategory, searched]);

    const renderToolCard = (tool: any) => {
        const IconComp = tool.Icon;
        const expired = isExpired(tool.expires_at);
        return (
            <div key={tool.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <div className={`p-4 text-center ${tool.bg_color || 'bg-gray-50'}`}>
                    {tool.image_path ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto mb-2 bg-white/80 border border-white/50">
                            <StorageImage imagePath={tool.image_path} alt={titleOf(tool)} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-12 h-12 rounded-xl bg-white/80 border border-white/50 flex items-center justify-center mx-auto mb-2">
                            <IconComp className={`h-6 w-6 ${tool.color || 'text-gray-600'}`} />
                        </div>
                    )}
                    <h3 className="text-sm font-bold text-gray-900">{titleOf(tool)}</h3>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">{descriptionOf(tool)}</p>
                    {tool.expires_at && (
                        <div className="flex items-center gap-1.5 text-[10px]">
                            <Clock className="h-3 w-3 text-gray-600" />
                            <span className={expired ? 'text-red-500 font-bold' : 'text-gray-600'}>
                                {expired ? t('tools.expired') : `${t('tools.validUntil')} ${new Date(tool.expires_at).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}`}
                            </span>
                        </div>
                    )}
                    <Link href={`/owner/tools/${tool.id}`}>
                        <button className="w-full h-9 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                            {t('tools.openTool')}
                        </button>
                    </Link>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            <PageHeader title={t('nav.myTools')} description={t('tools.subtitle')} />
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
                </div>
            ) : tools.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                        <Wrench className="h-12 w-12 text-gray-200" />
                        <p className="text-gray-600 text-center text-sm">{t('tools.noActiveTools')}</p>
                        <Link href="/owner/store">
                            <button className="h-10 px-5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors">
                                {t('tools.toolsStore')}
                            </button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="space-y-3">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 pointer-events-none" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('tools.searchPlaceholder')}
                                className="h-10 rounded-xl border-gray-200 text-xs ps-9 pe-9"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {allCategories.length > 1 && (
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                                {['all', ...allCategories].map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setActiveCategory(c)}
                                        className={cn(
                                            "shrink-0 h-9 px-4 rounded-full text-[12px] font-bold transition-colors",
                                            activeCategory === c ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                                        )}
                                    >
                                        {c === 'all' ? t('toolsStore.tabAll') : categoryLabel(c)} ({c === 'all' ? searched.length : (categoryCounts.get(c) || 0)})
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {sections.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
                                <Search className="h-8 w-8 text-gray-200" />
                                <p className="text-sm font-bold text-gray-900">{t('tools.noResults')}</p>
                                <p className="text-[11px] text-gray-600">{t('tools.noResultsDesc')}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-8">
                            {sections.map(section => (
                                <section key={section.category} className="space-y-3">
                                    {allCategories.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-black text-gray-900">{categoryLabel(section.category)}</h2>
                                            <span className="text-[10px] font-bold text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">{section.items.length}</span>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {section.items.map(renderToolCard)}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
