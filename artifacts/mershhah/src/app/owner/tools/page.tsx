'use client';

import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function OwnerToolsPage() {
    const { user } = useUser();
    const [tools, setTools] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTools = async () => {
            if (!user?.restaurantId) return;
            try {
                const { data } = await supabase.from('tools').select('*');
                setTools(data || []);
            } catch (error) {
                console.error("Error fetching tools:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTools();
    }, [user]);

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
                        <Wrench className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-center">لا توجد أدوات مفعّلة حالياً</p>
                        <Link href="/owner/store"><Button>استعراض المتجر</Button></Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map(tool => (
                        <Card key={tool.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle>{tool.title}</CardTitle>
                                <CardDescription>{tool.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href={`/owner/tools/${tool.id}`}><Button variant="outline" className="w-full">فتح الأداة</Button></Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
