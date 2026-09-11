-- The first RLS fix (fix_chat_rls.sql) enabled RLS and added a correct
-- policy, but didn't account for old, dormant policies left behind from
-- before RLS was disabled - Postgres OR's every permissive policy together,
-- so "Anyone can insert chats" (WITH CHECK true) stayed fully exploitable
-- alongside the new restrictive one. Confirmed live: an anonymous insert
-- passed RLS entirely and only failed on an unrelated NOT NULL constraint.
-- Drop every old policy, leave only the single correct one on each table.

DROP POLICY IF EXISTS "Anyone can insert chats" ON public.chats;
DROP POLICY IF EXISTS "Owners can update their restaurant chats" ON public.chats;
DROP POLICY IF EXISTS "Owners can view their restaurant chats" ON public.chats;
DROP POLICY IF EXISTS "chats: admin" ON public.chats;
DROP POLICY IF EXISTS "chats: admin full" ON public.chats;
DROP POLICY IF EXISTS "chats: owner" ON public.chats;

DROP POLICY IF EXISTS "chat_messages: participant" ON public.chat_messages;

-- Sanity check: exactly one policy should remain on each table.
SELECT tablename, count(*) AS remaining_policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('chats', 'chat_messages')
GROUP BY tablename;
