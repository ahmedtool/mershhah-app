'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Info, AlertTriangle, CheckCircle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const typeConfig = {
  info: { icon: Info, className: "text-blue-500 border-blue-200 bg-blue-50" },
  warning: { icon: AlertTriangle, className: "text-yellow-500 border-yellow-200 bg-yellow-50" },
  success: { icon: CheckCircle, className: "text-green-500 border-green-200 bg-green-50" },
  update: { icon: Bell, className: "text-purple-500 border-purple-200 bg-purple-50" },
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

  const Icon = announcement ? typeConfig[announcement.type]?.icon ?? Info : Info;
  const style = announcement ? typeConfig[announcement.type]?.className ?? '' : '';

  return (
    <AnimatePresence>
      {isVisible && announcement && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, padding: 0, margin: 0, transition: { duration: 0.3 } }}
          className="mb-6 overflow-hidden"
        >
          <Alert className={style}>
            <Icon className="h-5 w-5" />
            <AlertTitle className="font-bold">{announcement.title}</AlertTitle>
            <AlertDescription>{announcement.content}</AlertDescription>
            <Button variant="ghost" size="icon" className="absolute top-3 left-3 h-6 w-6" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
