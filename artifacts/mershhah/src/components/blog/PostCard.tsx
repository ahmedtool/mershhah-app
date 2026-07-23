
'use client';

import { useState, useEffect } from 'react';
import { Link } from "wouter";
import { Calendar, Clock, ArrowLeft, FileText } from "lucide-react";

export function PostCard({ post }: { post: any }) {
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    setFormattedDate(new Date(post.metadata.publishedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, [post.metadata.publishedAt]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col hover:border-gray-200 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
          <Calendar className="h-3 w-3" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
          <Clock className="h-3 w-3" />
          <span>{post.metadata.readingTime}</span>
        </div>
      </div>

      <h3 className="text-sm font-bold text-gray-900 mb-3 leading-snug">
        <Link href={`/blog/${post.slug}`} className="hover:text-gray-600 transition-colors">
          {post.metadata.title}
        </Link>
      </h3>

      <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 mb-4 flex-1">
        {post.metadata.description}
      </p>

      <Link
        href={`/blog/${post.slug}`}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors mt-auto"
      >
        <span>اقرأ المزيد</span>
        <ArrowLeft className="h-3 w-3 rotate-180" />
      </Link>
    </div>
  );
}
