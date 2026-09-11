-- Lets the owner tell which channel raised a ticket: the customer filling
-- the manual /support/[username] form, or the AI chat assistant creating
-- one mid-conversation via the create_support_ticket tool.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
