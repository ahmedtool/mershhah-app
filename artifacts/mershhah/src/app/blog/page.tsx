
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BlogHeader } from '@/components/blog/BlogHeader';
import { PostCard } from '@/components/blog/PostCard';
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "@/components/shared/PublicFooter";
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function BlogPage() {
  useDocumentMeta(
    'المدونة',
    'مقالات عن إدارة المطاعم والمقاهي، القوائم الرقمية، تجربة العملاء، وأدوات النمو في السوق السعودي.'
  );
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('slug, title, description, reading_time, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      setPosts((data || []).map((p: any) => ({
        slug: p.slug,
        metadata: {
          title: p.title,
          description: p.description,
          publishedAt: p.published_at,
          readingTime: p.reading_time,
        },
      })));
      setIsLoading(false);
    };
    fetchPosts();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <Logo />
          <Button asChild variant="ghost" className="text-gray-600 text-sm font-bold hover:bg-gray-50 rounded-xl px-4">
            <Link href="/"><ArrowLeft className="ml-2 h-4 w-4" />العودة</Link>
          </Button>
        </div>
      </header>

      <main className="py-16 sm:py-24 px-4">
        <BlogHeader
          title="مدونة النمو الرقمي"
          description="دليلك المتكامل لبناء مشروع تجاري ناجح في قطاع الأغذية والمشروبات."
        />

        {isLoading ? (
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-600 text-sm mt-16">لا توجد مقالات منشورة بعد</p>
        ) : (
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}

        <div className="max-w-3xl mx-auto mt-16 bg-gray-900 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-lg font-black text-white mb-2">هل أنت صاحب مطعم أو مقهى؟</h2>
          <p className="text-xs text-gray-400 mb-6 max-w-md mx-auto">انضم إلى مشاريع تستخدم أدواتنا الذكية لزيادة أرباحها وتبسيط عملياتها.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="h-10 rounded-xl bg-white text-gray-900 text-xs font-bold text-center leading-10 hover:bg-gray-100 transition-colors">ابدأ مجاناً</Link>
            <Link href="/pricing" className="h-10 rounded-xl border border-gray-700 text-gray-300 text-xs font-bold text-center leading-10 hover:bg-gray-800 transition-colors">اكتشف الباقات</Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
