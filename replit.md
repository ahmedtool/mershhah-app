# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

### مرشح | Mershhah (`artifacts/mershhah`)
- **Kind**: web (Vite + React)
- **Preview path**: `/`
- **Stack**: React 18, Vite 7, Tailwind CSS v4, Wouter (routing), Supabase (auth + DB + Storage), TanStack Query, shadcn/ui
- **Description**: SaaS restaurant management platform for Saudi restaurants. Features: digital menu, AI chat assistant, owner dashboard, admin panel, public pages.
- **Migrated from**: Next.js 15 App Router (Firebase → Supabase)
- **Deployed**: Vercel via GitHub repo `ahmednshmijob-creator/morassh`
- **Key files**:
  - `src/App.tsx` — main router (Wouter Switch/Route tree)
  - `src/lib/navigation.ts` — Next.js navigation compatibility shim (useRouter, usePathname, useSearchParams, notFound)
  - `src/lib/supabase.ts` — Supabase client config (reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
  - `src/lib/public-pages.ts` — syncs restaurant data to `public_pages` table for public menu views
  - `src/hooks/useUser.ts` — auth hook with 8s timeout + 3-retry profile fetch
  - `src/ai/flows/` — AI flows calling `/api/ai/*` endpoints
  - `src/index.css` — CSS theme, RTL direction set at `:root`
  - `src/app/` — all pages as React components
  - `index.html` — `<html lang="ar" dir="rtl">`

### Admin Layout (`src/app/admin/layout.tsx`)
- Sidebar: `collapsible="none"`, `--sidebar-width: 17rem`, `side="right"` (RTL)
- SidebarProvider: `flex-row-reverse` for RTL
- SidebarInset + main: `min-w-0 overflow-hidden` to prevent content overflow

### Owner Layout (`src/app/owner/layout.tsx`)
- Same sidebar pattern as admin layout

### API Server (`artifacts/api-server`)
- **Kind**: api (Express)
- **Port**: 8080
- **Routes**: `/api/ai/*` — AI flow endpoints (generate-menu-image, analyze-reviews, etc.)

## Supabase Setup

- **URL**: `https://rkozspoiragvpifqtwoa.supabase.co`
- **Keys**: Set as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in both Replit env vars AND Vercel env vars
- **Tables**: profiles, restaurants, subscriptions, menu_items, menu_item_interactions, offers, branches, reviews, chats, chat_messages, activity, tools, activated_tools, plans, hub_visits, public_pages, support_tickets, announcements, team_members

## Vercel Deployment

- **Repo**: `ahmednshmijob-creator/morassh` (GitHub)
- **Build command**: `pnpm --filter @workspace/mershhah run build`
- **Output directory**: `artifacts/mershhah/dist/public`
- **Install command**: `npm install -g pnpm@10.26.1 && pnpm install --frozen-lockfile`
- **⚠️ GitHub pushes**: Use Node.js API scripts at `/tmp/push_*.mjs` — git pack is corrupted in local repo

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 22
- **Package manager**: pnpm 10.26.1
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Auth + DB**: Supabase (was Firebase)
- **Build**: esbuild (api-server), Vite (web app)

## Key Commands

- `pnpm --filter @workspace/mershhah run dev` — run Mershhah web app locally
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mershhah run build` — build for production

## App Architecture

- **Language**: Arabic-only (RTL always). `LanguageContext` always returns `locale: 'ar'`, `dir: 'rtl'`, `isRTL: true`
- **Super Admin email**: `ahmedsupsa@gmail.com` (hardcoded in LoginForm, RegisterForm, AdminSidebar)
- **Auth flow**: Supabase Auth → profile lookup in `profiles` table → redirect to `/admin/*` or `/owner/*`
- **Public pages**: Restaurant data cached in `public_pages` table (keyed by username), synced via `syncPublicPage()` on changes
- **Sidebar**: Fixed-width (17rem), non-collapsible, RTL-aware (appears on right side for Arabic)

## Migration Notes (Firebase → Supabase)

- All `firebase/firestore` → `supabase.from(table).*`
- All `firebase/auth` → `supabase.auth.*`
- All `firebase/storage` → `supabase.storage.from(bucket).*`
- `getSession()` timeout: 8 seconds with `.catch()` fallback
- Profile fetch: 3 retries with 800ms delay
