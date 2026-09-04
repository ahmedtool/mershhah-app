'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { EditBlogPostDialog } from '@/components/admin/blog/EditBlogPostDialog';
import { Link } from 'wouter';

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('published_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } else {
      setPosts(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const togglePublished = async (post: any) => {
    const { error } = await supabase.from('blog_posts').update({ is_published: !post.is_published }).eq('id', post.id);
    if (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
      return;
    }
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_published: !p.is_published } : p));
    toast({ title: post.is_published ? 'تم إخفاء المقال' : 'تم نشر المقال' });
  };

  const deletePost = async (post: any) => {
    if (!confirm(`هل أنت متأكد من حذف مقال "${post.title}"؟`)) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', post.id);
    if (error) {
      toast({ variant: 'destructive', title: 'خطأ في الحذف', description: error.message });
      return;
    }
    setPosts(prev => prev.filter(p => p.id !== post.id));
    toast({ title: 'تم حذف المقال' });
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">المدونة</h1>
          <p className="text-xs text-gray-600 mt-0.5">{posts.length} مقال — {posts.filter(p => p.is_published).length} منشور</p>
        </div>
        <EditBlogPostDialog onSave={fetchPosts}>
          <button className="h-10 px-4 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" />
            مقال جديد
          </button>
        </EditBlogPostDialog>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-900 mb-1">لا توجد مقالات بعد</p>
          <p className="text-[11px] text-gray-600">ابدأ بإضافة أول مقال بالمدونة</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 p-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${post.is_published ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                <FileText className={`h-4 w-4 ${post.is_published ? 'text-emerald-500' : 'text-gray-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{post.title}</p>
                <p className="text-[11px] text-gray-600 truncate">
                  {post.description || 'بدون وصف'} — {new Date(post.published_at).toLocaleDateString('ar-SA')}
                </p>
              </div>
              <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${post.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {post.is_published ? 'منشور' : 'مسودة'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {post.is_published && (
                  <Link href={`/blog/${post.slug}`} target="_blank"
                    className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" title="عرض المقال">
                    <ExternalLink className="h-4 w-4 text-gray-600" />
                  </Link>
                )}
                <button onClick={() => togglePublished(post)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                  title={post.is_published ? 'إخفاء' : 'نشر'}>
                  {post.is_published ? <EyeOff className="h-4 w-4 text-gray-600" /> : <Eye className="h-4 w-4 text-gray-600" />}
                </button>
                <EditBlogPostDialog post={post} onSave={fetchPosts}>
                  <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" title="تعديل">
                    <Pencil className="h-4 w-4 text-gray-600" />
                  </button>
                </EditBlogPostDialog>
                <button onClick={() => deletePost(post)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors" title="حذف">
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
