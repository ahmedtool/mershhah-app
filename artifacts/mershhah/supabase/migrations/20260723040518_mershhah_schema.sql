-- ============================================================
-- مرشح (Mershhah) - Supabase Schema
-- انسخ هذا الكود كاملاً في Supabase > SQL Editor > Run
-- ============================================================

-- ============================================================
-- 1. PROFILES (المستخدمون)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null unique,
  phone_number text,
  role text not null default 'owner' check (role in ('admin', 'owner')),
  account_status text not null default 'active' check (account_status in ('active', 'pending', 'suspended')),
  restaurant_name text,
  restaurant_id text,
  admin_permissions jsonb default '[]'::jsonb,
  ai_trial_used boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 2. RESTAURANTS (المطاعم)
-- ============================================================
create table if not exists public.restaurants (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  name_en text,
  username text unique not null,
  username_last_updated_at timestamptz,
  description text,
  description_en text,
  logo text,
  "primaryColor" text,
  "secondaryColor" text,
  "buttonTextColor" text,
  "borderRadius" numeric,
  "fontFamily" text,
  "socialLinks" jsonb,
  "deliveryApps" jsonb,
  "aiConfig" jsonb,
  is_paid_plan boolean default false,
  analysis_daily_count integer default 0,
  analysis_last_reset timestamptz,
  analysis_reviews_daily_count integer default 0,
  analysis_reviews_last_reset timestamptz,
  pulse_daily_count integer default 0,
  pulse_last_reset timestamptz,
  reply_templates_daily_count integer default 0,
  reply_templates_last_reset timestamptz,
  feedback_summary_daily_count integer default 0,
  feedback_summary_last_reset timestamptz,
  content_writer_daily_count integer default 0,
  content_writer_last_reset timestamptz,
  image_generation_daily_count integer default 0,
  image_generation_last_reset timestamptz,
  maps_search_daily_count integer default 0,
  maps_search_last_reset timestamptz,
  maps_details_daily_count integer default 0,
  maps_details_last_reset timestamptz,
  menu_import_monthly_count integer default 0,
  menu_import_last_reset timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. BRANCHES (الفروع)
-- ============================================================
create table if not exists public.branches (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text references public.restaurants(id) on delete cascade,
  name text not null,
  name_en text,
  city text not null,
  city_en text,
  district text,
  district_en text,
  address text,
  address_en text,
  phone text,
  google_maps_url text,
  opening_hours text,
  opening_hours_en text,
  status text default 'active' check (status in ('active', 'inactive')),
  latitude numeric,
  longitude numeric
);

-- ============================================================
-- 4. MENU ITEMS (قائمة الطعام)
-- ============================================================
create table if not exists public.menu_items (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text references public.restaurants(id) on delete cascade,
  name text not null,
  name_en text,
  description text,
  description_en text,
  category text,
  category_en text,
  image_url text,
  status text default 'available' check (status in ('available', 'unavailable')),
  display_tags text default 'none' check (display_tags in ('new', 'best_seller', 'daily_offer', 'none')),
  sizes jsonb default '[]'::jsonb,
  position integer default 0,
  clicks_count integer default 0,
  profit numeric,
  "profitMargin" numeric,
  popularity numeric,
  classification text check (classification in ('Star', 'Plow-Horse', 'Puzzle', 'Dog')),
  image_last_generated_at timestamptz,
  description_last_generated_at timestamptz,
  allergens jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- 5. OFFERS (العروض)
-- ============================================================
create table if not exists public.offers (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text references public.restaurants(id) on delete cascade,
  title text not null,
  title_en text,
  description text,
  description_en text,
  image_url text,
  external_link text,
  valid_until timestamptz,
  status text default 'active' check (status in ('active', 'expired')),
  items jsonb default '[]'::jsonb,
  views_count integer default 0,
  clicks_count integer default 0,
  link_clicks_count integer default 0
);

-- ============================================================
-- 6. REVIEWS (التقييمات)
-- ============================================================
create table if not exists public.reviews (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text references public.restaurants(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  is_visible boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- 7. SUBSCRIPTIONS (الاشتراكات)
-- ============================================================
create table if not exists public.subscriptions (
  id text primary key default gen_random_uuid()::text,
  profile_id uuid references public.profiles(id) on delete cascade,
  plan_name text,
  plan_id text,
  status text default 'active' check (status in ('active', 'inactive', 'cancelled')),
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- 8. PLANS (الباقات)
-- ============================================================
create table if not exists public.plans (
  id text primary key,
  name text not null,
  name_en text,
  description text,
  description_en text,
  price numeric default 0,
  duration_months integer default 1,
  is_active boolean default true,
  is_featured boolean default false,
  payment_link text,
  features jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- 9. TOOLS (الأدوات)
-- ============================================================
create table if not exists public.tools (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  title_en text,
  description text,
  description_en text,
  category text check (category in ('marketing', 'operations', 'analytics')),
  price_label text,
  price_label_en text,
  icon text,
  color text,
  bg_color text,
  popular boolean default false,
  type text check (type in ('free', 'paid')),
  image_path text,
  billing_type text check (billing_type in ('plan', 'addon')),
  period_months integer
);

-- ============================================================
-- 10. ACTIVATED TOOLS (الأدوات المفعّلة)
-- ============================================================
create table if not exists public.activated_tools (
  profile_id uuid references public.profiles(id) on delete cascade,
  tool_id text references public.tools(id) on delete cascade,
  billing_type text,
  period_months integer,
  status text default 'active',
  activated_at timestamptz default now(),
  expires_at timestamptz,
  primary key (profile_id, tool_id)
);

-- ============================================================
-- 11. ACTIVATION CODES (أكواد التفعيل)
-- ============================================================
create table if not exists public.activation_codes (
  id text primary key default gen_random_uuid()::text,
  tool_id text references public.tools(id) on delete cascade,
  status text default 'unused' check (status in ('unused', 'used')),
  used_by uuid references public.profiles(id),
  restaurant_id text,
  used_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- 12. APPLICATIONS (التطبيقات المدمجة)
-- ============================================================
create table if not exists public.applications (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  platform_id text,
  logo_url text,
  category text check (category in ('delivery', 'loyalty', 'payment', 'other'))
);

-- ============================================================
-- 13. SUPPORT TICKETS (تذاكر الدعم)
-- ============================================================
create table if not exists public.support_tickets (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text,
  restaurant_name text,
  name text,
  email text,
  phone text,
  subject text,
  message text,
  category text default 'other' check (category in ('complaint', 'inquiry', 'employment', 'suggestion', 'other')),
  status text default 'open' check (status in ('open', 'contacted', 'resolved', 'closed')),
  created_at timestamptz default now()
);

-- ============================================================
-- 14. LIVE CHAT - SESSIONS (جلسات الدردشة)
-- ============================================================
create table if not exists public.chats (
  id text primary key,
  "ownerId" text,
  "ownerName" text,
  "ownerLogo" text,
  "lastMessage" text,
  "lastMessageTimestamp" timestamptz,
  "adminHasUnread" boolean default false,
  "ownerHasUnread" boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 15. LIVE CHAT - MESSAGES (رسائل الدردشة)
-- ============================================================
create table if not exists public.chat_messages (
  id text primary key default gen_random_uuid()::text,
  chat_id text references public.chats(id) on delete cascade,
  "senderId" text,
  "senderRole" text check ("senderRole" in ('admin', 'owner')),
  text text,
  timestamp timestamptz default now(),
  attachment_url text,
  attachment_type text check (attachment_type in ('image', 'file')),
  attachment_filename text
);

-- ============================================================
-- 16. AI SESSIONS (جلسات المساعد الذكي)
-- ============================================================
create table if not exists public.ai_sessions (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text references public.restaurants(id) on delete cascade,
  created_at timestamptz default now(),
  last_activity_at timestamptz default now()
);

-- ============================================================
-- 17. AI SESSION MESSAGES (رسائل المساعد)
-- ============================================================
create table if not exists public.ai_session_messages (
  id text primary key default gen_random_uuid()::text,
  session_id text references public.ai_sessions(id) on delete cascade,
  restaurant_id text references public.restaurants(id) on delete cascade,
  sender text check (sender in ('user', 'bot')),
  text text,
  created_at timestamptz default now()
);

-- legacy alias view
create or replace view public.ai_messages as
  select * from public.ai_session_messages;

-- ============================================================
-- 18. TASKS (مهام الفريق)
-- ============================================================
create table if not exists public.tasks (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  status text default 'todo' check (status in ('todo', 'in-progress', 'review', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  "assigneeId" uuid references public.profiles(id),
  "assigneeName" text,
  "assigneeAvatar" text,
  "createdBy" uuid references public.profiles(id),
  "createdAt" timestamptz default now()
);

-- ============================================================
-- 19. ANNOUNCEMENTS (الإعلانات)
-- ============================================================
create table if not exists public.announcements (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  content text,
  type text check (type in ('info', 'warning', 'success', 'update')),
  "isActive" boolean default true,
  "targetRole" text default 'all' check ("targetRole" in ('owner', 'all')),
  "createdAt" timestamptz default now()
);

-- ============================================================
-- 20. ACTIVITY LOG (سجل النشاط)
-- ============================================================
create table if not exists public.activity (
  id text primary key default gen_random_uuid()::text,
  type text,
  "restaurantId" text,
  "restaurantName" text,
  "userId" text,
  "planName" text,
  timestamp timestamptz default now()
);

-- ============================================================
-- 21. HUB VISITS (زيارات الهاب)
-- ============================================================
create table if not exists public.hub_visits (
  id bigint generated always as identity primary key,
  restaurant_id text references public.restaurants(id) on delete cascade,
  source text,
  created_at timestamptz default now()
);

-- ============================================================
-- 22. MENU ITEM INTERACTIONS (تفاعلات قائمة الطعام)
-- ============================================================
create table if not exists public.menu_item_interactions (
  id bigint generated always as identity primary key,
  menu_item_id text references public.menu_items(id) on delete cascade,
  restaurant_id text references public.restaurants(id) on delete cascade,
  created_at timestamptz default now()
);

-- ============================================================
-- 23. IMAGE GALLERY (معرض الصور المولّدة)
-- ============================================================
create table if not exists public.image_gallery (
  id text primary key default gen_random_uuid()::text,
  "restaurantId" text references public.restaurants(id) on delete cascade,
  "storagePath" text,
  "sourceItemId" text,
  "sourceItemName" text,
  "createdAt" timestamptz default now(),
  "expiresAt" timestamptz
);

-- ============================================================
-- 24. PUBLIC PAGES (الصفحات العامة - cache)
-- ============================================================
create table if not exists public.public_pages (
  id text primary key,  -- restaurant username
  data jsonb,
  updated_at timestamptz default now()
);

-- ============================================================
-- STORAGE BUCKETS (مجلدات الملفات)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('restaurant-assets', 'restaurant-assets', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY (الحماية)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.branches enable row level security;
alter table public.menu_items enable row level security;
alter table public.offers enable row level security;
alter table public.reviews enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plans enable row level security;
alter table public.tools enable row level security;
alter table public.activated_tools enable row level security;
alter table public.activation_codes enable row level security;
alter table public.applications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.ai_session_messages enable row level security;
alter table public.tasks enable row level security;
alter table public.announcements enable row level security;
alter table public.activity enable row level security;
alter table public.hub_visits enable row level security;
alter table public.menu_item_interactions enable row level security;
alter table public.image_gallery enable row level security;
alter table public.public_pages enable row level security;

-- PROFILES policies
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);
create policy "profiles: admin full" on public.profiles for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- RESTAURANTS policies
create policy "restaurants: owner full" on public.restaurants for all using (owner_id = auth.uid());
create policy "restaurants: admin full" on public.restaurants for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "restaurants: public read" on public.restaurants for select using (true);

-- BRANCHES policies
create policy "branches: owner full" on public.branches for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "branches: admin full" on public.branches for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "branches: public read" on public.branches for select using (true);

-- MENU ITEMS policies
create policy "menu_items: owner full" on public.menu_items for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "menu_items: admin full" on public.menu_items for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "menu_items: public read" on public.menu_items for select using (true);

-- OFFERS policies
create policy "offers: owner full" on public.offers for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "offers: admin full" on public.offers for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "offers: public read" on public.offers for select using (true);

-- REVIEWS policies
create policy "reviews: public insert" on public.reviews for insert with check (true);
create policy "reviews: public read" on public.reviews for select using (true);
create policy "reviews: owner manage" on public.reviews for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "reviews: admin full" on public.reviews for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- PLANS / TOOLS / APPLICATIONS - public read, admin write
create policy "plans: public read" on public.plans for select using (true);
create policy "plans: admin write" on public.plans for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "tools: public read" on public.tools for select using (true);
create policy "tools: admin write" on public.tools for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "applications: public read" on public.applications for select using (true);
create policy "applications: admin write" on public.applications for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ACTIVATED TOOLS
create policy "activated_tools: owner" on public.activated_tools for all using (profile_id = auth.uid());
create policy "activated_tools: admin" on public.activated_tools for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- SUBSCRIPTIONS
create policy "subscriptions: owner" on public.subscriptions for all using (profile_id = auth.uid());
create policy "subscriptions: admin" on public.subscriptions for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- SUPPORT TICKETS
create policy "support_tickets: insert any" on public.support_tickets for insert with check (true);
create policy "support_tickets: owner read own" on public.support_tickets for select using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "support_tickets: admin full" on public.support_tickets for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- CHATS / CHAT_MESSAGES
create policy "chats: owner" on public.chats for all using ("ownerId" = auth.uid()::text);
create policy "chats: admin" on public.chats for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "chat_messages: participant" on public.chat_messages for all using (
  chat_id in (select id from public.chats where "ownerId" = auth.uid()::text)
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- AI SESSIONS / MESSAGES
create policy "ai_sessions: public insert" on public.ai_sessions for insert with check (true);
create policy "ai_sessions: owner read" on public.ai_sessions for select using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "ai_sessions: admin" on public.ai_sessions for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "ai_session_messages: public insert" on public.ai_session_messages for insert with check (true);
create policy "ai_session_messages: owner read" on public.ai_session_messages for select using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "ai_session_messages: admin" on public.ai_session_messages for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- TASKS / ANNOUNCEMENTS (admin only write, authenticated read)
create policy "tasks: authenticated read" on public.tasks for select using (auth.uid() is not null);
create policy "tasks: admin write" on public.tasks for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "announcements: authenticated read" on public.announcements for select using (auth.uid() is not null);
create policy "announcements: admin write" on public.announcements for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ACTIVITY / HUB_VISITS / MENU_ITEM_INTERACTIONS (open insert, admin read)
create policy "activity: open insert" on public.activity for insert with check (true);
create policy "activity: admin read" on public.activity for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "hub_visits: open insert" on public.hub_visits for insert with check (true);
create policy "hub_visits: owner read" on public.hub_visits for select using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "hub_visits: admin read" on public.hub_visits for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "menu_item_interactions: open insert" on public.menu_item_interactions for insert with check (true);
create policy "menu_item_interactions: owner read" on public.menu_item_interactions for select using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);

-- IMAGE GALLERY
create policy "image_gallery: owner full" on public.image_gallery for all using (
  "restaurantId" in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "image_gallery: admin full" on public.image_gallery for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- PUBLIC PAGES (open read, owner write)
create policy "public_pages: open read" on public.public_pages for select using (true);
create policy "public_pages: owner write" on public.public_pages for all using (auth.uid() is not null);

-- STORAGE POLICIES
create policy "restaurant-assets: public read" on storage.objects for select using (bucket_id = 'restaurant-assets');
create policy "restaurant-assets: auth upload" on storage.objects for insert with check (bucket_id = 'restaurant-assets' and auth.uid() is not null);
create policy "restaurant-assets: owner delete" on storage.objects for delete using (bucket_id = 'restaurant-assets' and auth.uid() is not null);

create policy "chat-attachments: auth all" on storage.objects for all using (bucket_id = 'chat-attachments' and auth.uid() is not null);

-- ============================================================
-- ACTIVATION CODES RLS
-- ============================================================
create policy "activation_codes: admin full" on public.activation_codes for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "activation_codes: owner read unused" on public.activation_codes for select using (auth.uid() is not null);

