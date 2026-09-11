-- FIX: Replace recursive RLS policies with auth.users approach
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/smmriycsboexindabanc/sql

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "profiles: read own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin full" ON public.profiles;

-- Recreate with auth.users approach (no recursion)
CREATE POLICY "profiles: read own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles: admin full" ON public.profiles FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix restaurants
DROP POLICY IF EXISTS "restaurants: admin full" ON public.restaurants;
CREATE POLICY "restaurants: admin full" ON public.restaurants FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix branches
DROP POLICY IF EXISTS "branches: admin full" ON public.branches;
CREATE POLICY "branches: admin full" ON public.branches FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix menu_items
DROP POLICY IF EXISTS "menu_items: admin full" ON public.menu_items;
CREATE POLICY "menu_items: admin full" ON public.menu_items FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix offers
DROP POLICY IF EXISTS "offers: admin full" ON public.offers;
CREATE POLICY "offers: admin full" ON public.offers FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix reviews
DROP POLICY IF EXISTS "reviews: admin full" ON public.reviews;
CREATE POLICY "reviews: admin full" ON public.reviews FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix hub_visits
DROP POLICY IF EXISTS "hub_visits: admin full" ON public.hub_visits;
CREATE POLICY "hub_visits: admin full" ON public.hub_visits FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix applications
DROP POLICY IF EXISTS "applications: admin full" ON public.applications;
CREATE POLICY "applications: admin full" ON public.applications FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix activity
DROP POLICY IF EXISTS "activity: admin full" ON public.activity;
CREATE POLICY "activity: admin full" ON public.activity FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix subscriptions
DROP POLICY IF EXISTS "subscriptions: admin full" ON public.subscriptions;
CREATE POLICY "subscriptions: admin full" ON public.subscriptions FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix tools
DROP POLICY IF EXISTS "tools: admin full" ON public.tools;
CREATE POLICY "tools: admin full" ON public.tools FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix plans
DROP POLICY IF EXISTS "plans: admin full" ON public.plans;
CREATE POLICY "plans: admin full" ON public.plans FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix chats
DROP POLICY IF EXISTS "chats: admin full" ON public.chats;
CREATE POLICY "chats: admin full" ON public.chats FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix announcements
DROP POLICY IF EXISTS "announcements: admin full" ON public.announcements;
CREATE POLICY "announcements: admin full" ON public.announcements FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Fix discount_codes
DROP POLICY IF EXISTS "discount_codes: admin full" ON public.discount_codes;
CREATE POLICY "discount_codes: admin full" ON public.discount_codes FOR ALL USING (
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- CRITICAL: auth.users RLS policy
-- Without this, all admin policies above return NULL because auth.users has RLS enabled with no policies
DROP POLICY IF EXISTS "users: own read" ON auth.users;
CREATE POLICY "users: own read" ON auth.users FOR SELECT USING (id = auth.uid());
