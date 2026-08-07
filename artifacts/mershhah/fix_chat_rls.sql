-- ============================================================
-- إصلاح صفحات الدعم - ضمان عمل المحادثات
-- انسخ هذا الكود في Supabase > SQL Editor > Run
-- ============================================================

-- 1. التأكد من وجود chat_type
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS chat_type text DEFAULT 'admin';

-- 2. تعطيل RLS على chats (المدير يحتاج قراءة كل المحادثات)
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;

-- 3. تعطيل RLS على chat_messages
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

-- 4. التأكد من وجود الـ storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 5. سياسة storage للـ chat attachments
CREATE POLICY "Public access for chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Anyone can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments');
