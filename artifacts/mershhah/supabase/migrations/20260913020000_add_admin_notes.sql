-- Internal admin-only notes per subscriber, shown in the new management
-- drawer's overview tab. Plain text, never exposed on any owner-facing
-- page - only read/written from /admin/management.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_notes text;
