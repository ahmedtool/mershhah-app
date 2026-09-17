-- The base schema migration already creates this bucket, but "Bucket not
-- found" on a live upload just now confirms that specific insert never
-- actually landed on this project (only the tables from that same
-- migration did). Re-running it here is safe either way - on conflict
-- (id) do nothing makes it a no-op if the bucket already exists.
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;
