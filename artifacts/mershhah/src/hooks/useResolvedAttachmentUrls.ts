'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/types';

// chat_messages.attachment_url stores the raw storage PATH inside the
// private chat-attachments bucket, not a fetchable URL - the bucket is
// intentionally private (RLS scopes reads to the chat's owner or an admin,
// after a past incident where a public bucket + unscoped policies let an
// anonymous request download a real customer's photo). A permanent public
// URL saved at send time would either require reverting to that public
// bucket, or go stale the moment a signed URL's token expired - so every
// render resolves a fresh short-lived signed URL from the stored path
// instead.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function useResolvedAttachmentUrls(messages: ChatMessage[]): Record<string, string> {
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const resolvingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = messages.filter(
      (m) => m.attachment_url && !resolved[m.id] && !resolvingRef.current.has(m.id)
    );
    if (pending.length === 0) return;
    pending.forEach((m) => resolvingRef.current.add(m.id));

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        pending.map(async (m) => {
          const { data } = await supabase.storage
            .from('chat-attachments')
            .createSignedUrl(m.attachment_url!, SIGNED_URL_TTL_SECONDS);
          return [m.id, data?.signedUrl || ''] as const;
        })
      );
      if (cancelled) return;
      setResolved((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) {
          if (url) next[id] = url;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolvingRef guards against re-processing; `resolved` itself must stay out to avoid re-triggering on every resolution.
  }, [messages]);

  return resolved;
}
