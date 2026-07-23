'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function ReferLookupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>تتبع الإحالة</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-center">يتم التحقق من رابط إحالتك...</p></CardContent>
      </Card>
    </div>
  );
}
