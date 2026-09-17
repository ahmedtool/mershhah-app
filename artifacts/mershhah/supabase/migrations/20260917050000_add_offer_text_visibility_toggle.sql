-- Lets an owner keep an offer's image showing on the public hub page while
-- hiding just the title/description text from visitors - the offer itself
-- stays fully visible to the owner on their own offers page either way.
alter table public.offers add column if not exists show_text_to_visitors boolean default true;
