'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useSearchParams } from '@/lib/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40 p-4">
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
        >
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-green-100 p-4 rounded-full w-fit">
                        <CheckCircle className="h-12 w-12 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold mt-4">تمت عملية الدفع بنجاح!</CardTitle>
                    <CardDescription>
                        شكرًا لك. تم تفعيل اشتراكك بنجاح، ويمكنك الآن الوصول إلى جميع ميزات لوحة التحكم.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sessionId && (
                        <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
                            <p>رقم مرجع العملية:</p>
                            <p className="font-mono">{sessionId}</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button asChild className="w-full">
                        <Link href="/owner/dashboard">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            الانتقال إلى لوحة التحكم
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    </div>
  )
}


export default function SuccessPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">جاري التحميل...</div>}>
            <SuccessContent />
        </Suspense>
    );
}