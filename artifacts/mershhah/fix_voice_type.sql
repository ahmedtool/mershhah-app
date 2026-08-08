-- إضافة 'voice' للـ check constraint على chat_messages
ALTER TABLE public.chat_messages 
  DROP CONSTRAINT IF EXISTS chat_messages_attachment_type_check;

ALTER TABLE public.chat_messages 
  ADD CONSTRAINT chat_messages_attachment_type_check 
  CHECK (attachment_type IN ('image', 'file', 'voice'));
