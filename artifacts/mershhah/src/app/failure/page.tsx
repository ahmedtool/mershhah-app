'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { XCircle, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useRouter } from '@/lib/navigation';

export default function FailurePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40 p-4">
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
        >
            <Card className="w-full max-w-md text-center border-destructive">
                <CardHeader>
                     <div className="mx-auto bg-destructive/10 p-4 rounded-full w-fit">
                        <XCircle className="h-12 w-12 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl font-bold mt-4">فشلت عملية الدفع</CardTitle>
                    <CardDescription>
                        عذرًا، يبدو أنه حدثت مشكلة أثناء معالجة عملية الدفع الخاصة بك. لم يتم خصم أي مبلغ.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        يمكنك المحاولة مرة أخرى، أو إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني.
                    </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button onClick={() => router.back()} className="w-full" variant="destructive">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        المحاولة مرة أخرى
                    </Button>
                     <Button asChild className="w-full" variant="ghost">
                        <Link href="/">
                             العودة إلى الرئيسية
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    </div>
  );
}