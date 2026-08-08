-- تفعيل Realtime على جدول chats
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;

-- تفعيل Realtime على جدول chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
