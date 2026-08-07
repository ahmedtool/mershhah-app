-- ============================================================
-- تحويل نظام الدعم إلى محادثة حية بين المالك والعميل
-- انسخ هذا الكود في Supabase > SQL Editor > Run
-- ============================================================

-- 1. إضافة أعمدة للـ chats
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS restaurant_id text;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS chat_type text DEFAULT 'admin' CHECK (chat_type IN ('admin', 'customer'));

-- 2. فهارس
CREATE INDEX IF NOT EXISTS idx_chats_restaurant ON public.chats(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_chats_customer_phone ON public.chats(customer_phone);
CREATE INDEX IF NOT EXISTS idx_chats_type ON public.chats(chat_type);

-- 3. RLS: المالك يشوف محادثات مطعمه فقط
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Owners can view their restaurant chats"
    ON public.chats FOR SELECT
    USING (
      restaurant_id IN (
        SELECT r.id FROM public.restaurants r
        JOIN public.profiles p ON r.owner_id = p.id
        WHERE p.id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can insert chats"
    ON public.chats FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update their restaurant chats"
    ON public.chats FOR UPDATE
    USING (
      restaurant_id IN (
        SELECT r.id FROM public.restaurants r
        JOIN public.profiles p ON r.owner_id = p.id
        WHERE p.id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. RLS: chat_messages - Anyone can read/write (like before)
-- Policies الموجودة تكفي
