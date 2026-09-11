-- chats/chat_messages had RLS disabled entirely - any anonymous request with
-- just the public anon key could read/write every support conversation on
-- the platform (confirmed live: real owner names and message text came back
-- with zero authentication). Scope access to exactly how the app already
-- uses these tables: the admin side (is_admin()) and the owning restaurant's
-- owner (ownerId = auth.uid()), nothing else.

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chats_owner_or_admin" ON public.chats;
CREATE POLICY "chats_owner_or_admin" ON public.chats
  FOR ALL
  USING (public.is_admin() OR "ownerId" = auth.uid()::text)
  WITH CHECK (public.is_admin() OR "ownerId" = auth.uid()::text);

DROP POLICY IF EXISTS "chat_messages_owner_or_admin" ON public.chat_messages;
CREATE POLICY "chat_messages_owner_or_admin" ON public.chat_messages
  FOR ALL
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.chats c WHERE c.id = chat_messages.chat_id AND c."ownerId" = auth.uid()::text
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.chats c WHERE c.id = chat_messages.chat_id AND c."ownerId" = auth.uid()::text
    )
  );
