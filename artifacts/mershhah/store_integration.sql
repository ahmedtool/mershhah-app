-- Store Integration Migration
-- Run each section separately if needed

-- SECTION 1: Add columns to tools table
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS integration_url text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS config_schema jsonb;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS permissions text[];
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS version text default '1.0.0';
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS developer_name text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS developer_url text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS screenshots text[];
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) default 0;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS total_installs integer default 0;

-- SECTION 2: Add config column to activated_tools
ALTER TABLE public.activated_tools ADD COLUMN IF NOT EXISTS config jsonb default '{}';
ALTER TABLE public.activated_tools ADD COLUMN IF NOT EXISTS installed_by uuid;
