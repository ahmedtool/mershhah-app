'use client';

import { useState, useEffect } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminStorePage() {
  const [tools, setTools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const { data } = await supabase.from('tools').select('*');
        setTools(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTools();
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4" dir="rtl">
      <PageHeader title="متجر الأدوات" description="إدارة الأدوات المتاحة في المنصة">
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة أداة
        </Button>
      </PageHeader>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : tools.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Package className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">لا توجد أدوات في المتجر بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map(tool => (
            <Card key={tool.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{tool.title}</CardTitle>
                  <Badge variant={tool.active ? "default" : "secondary"}>
                    {tool.active ? "مفعّل" : "معطّل"}
                  </Badge>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
