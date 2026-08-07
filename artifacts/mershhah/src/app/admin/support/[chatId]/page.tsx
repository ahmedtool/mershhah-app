'use client';

import { useRouter } from '@/lib/navigation';
import { useEffect } from 'react';

export default function AdminChatRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.push('/admin/support');
  }, [router]);
  return null;
}
