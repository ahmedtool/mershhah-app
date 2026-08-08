-- ============================================================
-- إنشاء bucket للمرفقات + سياسات الرفع
-- انسخ هذا في Supabase > SQL Editor > Run
-- ============================================================

-- إنشاء bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- سياسة قراءة للجميع
DO $$ BEGIN
  CREATE POLICY "Public read for chat attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'chat-attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- سياسة رفع للجميع
DO $$ BEGIN
  CREATE POLICY "Anyone can upload chat attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat-attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
