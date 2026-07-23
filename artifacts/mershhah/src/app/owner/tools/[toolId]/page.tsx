'use client';

import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { useParams } from 'wouter';
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ToolPlaceholderPage() {
    const params = useParams();
    const toolId = params.toolId as string;
    const [toolTitle, setToolTitle] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchToolInfo = async () => {
            if (!toolId) return;
            try {
                const { data } = await supabase
                    .from('tools')
                    .select('title')
                    .eq('id', toolId)
                    .single();
                setToolTitle(data?.title || toolId);
            } catch (error) {
                console.error("Error fetching tool title: ", error);
                setToolTitle(toolId);
            } finally {
                setIsLoading(false);
            }
        };
        fetchToolInfo();
    }, [toolId]);

    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <PageHeader
                title={`أداة: ${toolTitle || 'تحميل...'}`}
                description="هذه الصفحة قيد الإنشاء حالياً."
            />
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center gap-4 h-64 text-center">
                        <div className="bg-primary/10 p-4 rounded-full">
                            <Wrench className="h-12 w-12 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold">قيد التطوير</h3>
                        <p className="text-muted-foreground max-w-md">
                            نحن نعمل حالياً على بناء هذه الأداة. ستكون متاحة للاستخدام قريباً!
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
