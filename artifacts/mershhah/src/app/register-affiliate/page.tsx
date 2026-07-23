'use client';
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/Logo";
import { Link } from "wouter";
import { Handshake, ArrowRight } from "lucide-react";

export default function RegisterAffiliatePage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", businessType: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Handshake className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">التسجيل كشريك</CardTitle>
            <CardDescription>انضم إلى برنامج شركاء مرشح واكسب عمولات على كل إحالة</CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-6">
                <p className="text-lg font-medium text-primary">تم إرسال طلبك بنجاح!</p>
                <p className="text-muted-foreground mt-2 text-sm">سيتواصل معك فريقنا خلال 24 ساعة</p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/">العودة للرئيسية</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <Input id="name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">رقم الجوال</Label>
                  <Input id="phone" type="tel" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="businessType">نوع نشاطك</Label>
                  <Input id="businessType" placeholder="مثال: مصمم، مستشار، مدرب..." value={form.businessType} onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full gap-2">
                  تقديم الطلب
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  لديك حساب؟{" "}
                  <Link href="/login" className="text-primary hover:underline">تسجيل الدخول</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
