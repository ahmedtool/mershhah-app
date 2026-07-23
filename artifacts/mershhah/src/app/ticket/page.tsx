'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Ticket } from "lucide-react";

export default function TicketPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ email: "", subject: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Ticket className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>فتح تذكرة دعم</CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center py-6">
              <p className="text-lg font-medium text-primary">تم إرسال تذكرتك بنجاح!</p>
              <p className="text-muted-foreground mt-2 text-sm">سيتواصل معك فريق الدعم قريباً</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject">الموضوع</Label>
                <Input id="subject" required value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="message">الرسالة</Label>
                <Textarea id="message" rows={5} required value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full">إرسال التذكرة</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
