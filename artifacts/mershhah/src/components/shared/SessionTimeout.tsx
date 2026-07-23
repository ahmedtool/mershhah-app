'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from '@/lib/navigation';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const IDLE_TIMEOUT = 15 * 60 * 1000;
const DIALOG_COUNTDOWN = 60;

export function SessionTimeout() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [isIdle, setIsIdle] = useState(false);
  const [countdown, setCountdown] = useState(DIALOG_COUNTDOWN);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLogout = useCallback(async () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIsIdle(false);
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsIdle(false);
    setCountdown(DIALOG_COUNTDOWN);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_TIMEOUT);
  }, []);

  useEffect(() => {
    if (isIdle) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current!);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isIdle, handleLogout]);

  useEffect(() => {
    if (!user || isLoading) return;

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    const eventHandler = () => { resetIdleTimer(); };
    events.forEach((event) => window.addEventListener(event, eventHandler));
    resetIdleTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, eventHandler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [user, isLoading, resetIdleTimer]);

  if (!isIdle) return null;

  return (
    <AlertDialog open={isIdle}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>هل ما زلت هنا؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيتم تسجيل خروجك تلقائيًا بسبب عدم النشاط.
            <br />
            سيتم تسجيل الخروج خلال <span className="font-bold text-lg text-destructive">{countdown}</span> ثانية.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={handleLogout}>تسجيل الخروج الآن</Button>
          <Button onClick={resetIdleTimer}>تمديد الجلسة</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
