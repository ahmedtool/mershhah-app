'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift } from "lucide-react";
export default function ReferPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Gift className="h-8 w-8 text-primary mx-auto mb-2" />
          <CardTitle>برنامج الإحالة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">أحل أصدقاءك واحصل على مكافآت حصرية</p>
        </CardContent>
      </Card>
    </div>
  );
}
