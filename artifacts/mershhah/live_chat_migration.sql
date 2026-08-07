-- ============================================================
-- إضافة chat_type للتمييز بين محادثات الإدارة والمملّكين
-- انسخ هذا الكود في Supabase > SQL Editor > Run
-- ============================================================

-- 1. إضافة عمود chat_type
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS chat_type text DEFAULT 'admin' CHECK (chat_type IN ('admin', 'customer'));

-- 2. تحديث المحادثات الحالية لتكون من نوع admin
UPDATE public.chats SET chat_type = 'admin' WHERE chat_type IS NULL;

-- 3. فهرس
CREATE INDEX IF NOT EXISTS idx_chats_type ON public.chats(chat_type);
