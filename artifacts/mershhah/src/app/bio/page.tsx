'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/shared/Logo';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Link } from 'wouter';

const paths = [
  {
    icon: Building2,
    title: "صاحب مشروع تجاري",
    description: "أدوات ذكية لزيادة أرباحك",
    link: "/register",
    buttonText: "اعرف المزيد",
    highlighted: true,
  },
];

export default function BioPage() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col items-center justify-center p-4" dir="rtl">
      <header className="absolute top-6">
        <Logo />
      </header>

      <main className="flex flex-col items-center justify-center text-center w-full mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-headline font-extrabold mb-2">
            أهلاً بك في مرشّح
          </h1>
          <p className="text-lg text-muted-foreground">
            ابدأ رحلتك نحو تنمية مشروعك.
          </p>
        </motion.div>

        <div className="w-full max-w-sm">
          {paths.map((path, index) => (
            <motion.div
              key={path.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            >
              <Card className={`flex flex-col h-full text-center items-center p-6 transition-shadow hover:shadow-lg ${path.highlighted ? 'border-2 border-primary shadow-lg' : 'border'}`}>
                <CardHeader className="items-center">
                  <div className={`p-4 rounded-full mb-4 ${path.highlighted ? 'bg-primary/10' : 'bg-muted'}`}>
                    <path.icon className={`w-8 h-8 ${path.highlighted ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <CardTitle className="text-xl font-bold">{path.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription>{path.description}</CardDescription>
                </CardContent>
                <CardContent className="w-full p-0">
                  <Button asChild variant={path.highlighted ? 'default' : 'outline'} className="w-full">
                    <Link href={path.link}>
                      {path.buttonText}
                      <ArrowLeft className="mr-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="absolute bottom-6 text-sm text-muted-foreground">
      </footer>
    </div>
  );
}
