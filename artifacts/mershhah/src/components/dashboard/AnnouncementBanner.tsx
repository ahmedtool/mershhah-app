'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/lib/types';
import { X, Info, AlertTriangle, CheckCircle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const typeConfig = {
  info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-100', tileBg: 'bg-blue-100', tileColor: 'text-blue-600' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-100', tileBg: 'bg-amber-100', tileColor: 'text-amber-600' },
  success: { icon: CheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-100', tileBg: 'bg-emerald-100', tileColor: 'text-emerald-600' },
  update: { icon: Bell, bg: 'bg-violet-50', border: 'border-violet-100', tileBg: 'bg-violet-100', tileColor: 'text-violet-600' },
};

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data } = await supabase
          .from('announcements')
          .select('*')
          .eq('isActive', true)
          .order('createdAt', { ascending: false });

        const all = (data || []) as Announcement[];
        const latest = all.find((ann) => ['owner', 'all'].includes(ann.targetRole));

        if (latest) {
          const dismissedId = localStorage.getItem('dismissed-announcement');
          if (dismissedId !== latest.id) {
            setAnnouncement(latest);
            setIsVisible(true);
          } else {
            setAnnouncement(null);
            setIsVisible(false);
          }
        } else {
          setAnnouncement(null);
          setIsVisible(false);
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
        setAnnouncement(null);
        setIsVisible(false);
      }
    };

    fetchAnnouncements();

    const channel = supabase
      .channel('announcements-banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        fetchAnnouncements();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDismiss = () => {
    if (announcement) {
      localStorage.setItem('dismissed-announcement', announcement.id);
      setIsVisible(false);
    }
  };

  if (!announcement) return null;
  const config = typeConfig[announcement.type] ?? typeConfig.info;
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.3 } }}
          className="mb-6 overflow-hidden"
        >
          <div className={cn('rounded-2xl border p-4 flex items-start gap-3', config.bg, config.border)}>
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', config.tileBg)}>
              <Icon className={cn('h-5 w-5', config.tileColor)} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-sm font-bold text-gray-900">{announcement.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed mt-1">{announcement.content}</p>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-black/5 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
