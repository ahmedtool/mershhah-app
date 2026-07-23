
'use client';

import { notFound } from '@/lib/navigation';
import { posts } from '@/blog/posts';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, ArrowRight, Share2, Twitter, Linkedin, Bookmark } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React, { use, useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

export default function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const post = posts.find((post) => post.slug === resolvedParams.slug);
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    if (post) {
      setFormattedDate(new Date(post.metadata.publishedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }));
    }
  }, [post]);

  if (!post) {
    notFound();
  }

  return (
    <article className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-12">
            <Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link>
            <ArrowRight className="h-3 w-3 rotate-180" />
            <Link href="/blog" className="hover:text-primary transition-colors">المدونة</Link>
            <ArrowRight className="h-3 w-3 rotate-180" />
            <span className="text-foreground font-bold truncate">{post.metadata.title}</span>
        </nav>

        {/* Post Header */}
        <header className="space-y-10 mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-full text-xs font-black uppercase tracking-widest">
                <Bookmark className="h-3.5 w-3.5 fill-current" />
                أطروحة استراتيجية
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight text-gray-900">
                {post.metadata.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground font-medium border-y border-gray-100 py-8">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-full"><User className="h-4 w-4 text-primary" /></div>
                    <span className="font-bold text-gray-900">فريق مرشح</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-full"><Calendar className="h-4 w-4 text-primary" /></div>
                    <span>نُشر في: {formattedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-full"><Clock className="h-4 w-4 text-primary" /></div>
                    <span>وقت القراءة المقدر: {post.metadata.readingTime}</span>
                </div>
            </div>
        </header>

        {/* Post Content */}
        <div className="prose prose-lg md:prose-xl dark:prose-invert max-w-none 
                       prose-headings:font-black prose-headings:text-gray-900 prose-headings:tracking-tight prose-headings:mt-16 prose-headings:mb-6
                       prose-p:text-gray-600 prose-p:leading-[1.9] prose-p:mb-10 prose-p:text-justify
                       prose-strong:text-gray-900 prose-strong:font-black
                       prose-ul:list-disc prose-ul:pr-8 prose-li:mb-4 prose-li:text-gray-600
                       prose-blockquote:border-r-8 prose-blockquote:border-primary prose-blockquote:bg-gray-50 prose-blockquote:py-10 prose-blockquote:px-12 prose-blockquote:rounded-[2.5rem] prose-blockquote:italic prose-blockquote:text-gray-800 prose-blockquote:font-bold
                       mb-24"
            dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <Separator className="my-16 bg-gray-100" />

        {/* Footer Actions */}
        <footer className="flex flex-col sm:flex-row justify-between items-center gap-8 bg-gray-50 p-12 rounded-[3.5rem] border border-gray-100 shadow-inner">
            <div className="space-y-2 text-center sm:text-right">
                <p className="font-black text-2xl text-gray-900">هل وجدت هذه الأطروحة مفيدة؟</p>
                <p className="text-gray-500 font-medium">شارك هذه الاستراتيجيات مع زملائك من رواد الأعمال.</p>
            </div>
            <div className="flex gap-4">
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl hover:bg-primary/10 hover:text-primary border-gray-200 transition-all hover:scale-110">
                    <Twitter className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl hover:bg-primary/10 hover:text-primary border-gray-200 transition-all hover:scale-110">
                    <Linkedin className="h-5 w-5" />
                </Button>
                <Button variant="default" className="rounded-2xl h-12 gap-2 font-black shadow-lg shadow-primary/20 px-8 transition-all active:scale-95">
                    <Share2 className="h-5 w-5" />
                    مشاركة الرابط
                </Button>
            </div>
        </footer>

        {/* CTA Section inside post */}
        <div className="mt-20 p-12 md:p-20 bg-primary rounded-[4rem] text-white text-center shadow-2xl shadow-primary/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none" />
            <h2 className="text-3xl md:text-5xl font-black mb-8 relative z-10 leading-tight">جاهز لتطبيق هذه الرؤى <br/> في مشروعك؟</h2>
            <p className="text-white/80 mb-12 text-lg md:text-xl max-w-2xl mx-auto font-medium relative z-10 leading-relaxed">انضم إلى مرشح اليوم وابدأ في تحويل بيانات مشروعك إلى نمو حقيقي ومستدام عبر أدواتنا الذكية المتكاملة.</p>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-gray-50 h-16 px-14 text-xl font-black rounded-2xl relative z-10 transition-all active:scale-95 shadow-2xl">
                <Link href="/register">ابدأ رحلة التحول مجاناً</Link>
            </Button>
        </div>

        {/* Back Link */}
        <div className="mt-20 text-center">
            <Button asChild variant="ghost" className="font-black text-lg gap-2 group hover:text-primary py-8 px-10 rounded-2xl">
                <Link href="/blog">
                    <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-2" />
                    اكتشف المزيد من المقالات الاستراتيجية
                </Link>
            </Button>
        </div>
    </article>
  );
}
