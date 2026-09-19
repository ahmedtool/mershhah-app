-- Lets a sent message be edited in place (owner/admin support chat) while
-- still showing an "(edited)" marker instead of silently rewriting history.
alter table public.chat_messages add column if not exists edited_at timestamptz;
