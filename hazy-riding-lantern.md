# Cashflow Forecasting MVP — Implementation Plan

## Context

Personal finance manager replacing Quicken (forecasting) and YNAB (expense tracking). This session builds **MVP: forecasting core** — accounts, scheduled/recurring cashflow events, projection algorithm, and Recharts balance chart. Stack matches travel-tracker: **Next.js 16 + Supabase + Tailwind v4 + shadcn/ui v4 + Recharts**. Separate Supabase project (user creating now).

## Project Structure

```
cashflow/
├── supabase/migrations/          # 4 SQL migration files
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (Geist fonts, globals.css)
│   │   ├── page.tsx              # Redirect → /dashboard
│   │   ├── globals.css           # Tailwind v4 imports + theme
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx    # Email/password login (client component)
│   │   │   └── auth/callback/route.ts  # OAuth code exchange
│   │   └── (app)/
│   │       ├── layout.tsx        # Nav: Dashboard | Accounts | Events + sign-out
│   │       ├── dashboard/page.tsx
│   │       ├── accounts/
│   │       │   ├── page.tsx      # Account list
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/edit/page.tsx
│   │       └── events/
│   │           ├── page.tsx      # Event list
│   │           ├── new/page.tsx
│   │           └── [id]/edit/page.tsx
│   ├── actions/
│   │   ├── accounts.ts           # create/update/delete account
│   │   └── events.ts             # create/update/delete cashflow event
│   ├── components/
│   │   ├── ui/                   # shadcn (button, card, input, label, select, etc.)
│   │   ├── shared/               # empty-state, confirm-dialog
│   │   ├── accounts/             # account-form, account-card, delete-account-button
│   │   ├── events/               # event-form, event-card, recurrence-fields, delete-event-button
│   │   └── dashboard/            # stats-grid, projection-chart, account-summary-card
│   ├── lib/
│   │   ├── utils.ts              # cn() helper
│   │   ├── types/database.ts     # All TS types + enums
│   │   ├── projection.ts         # Pure projection algorithm
│   │   └── supabase/
│   │       ├── server.ts         # createServerClient (async, cookie handler)
│   │       ├── client.ts         # createBrowserClient (sync)
│   │       └── middleware.ts     # updateSession (auth check + redirect)
│   ├── hooks/                    # (empty for now)
│   └── middleware.ts             # Calls updateSession, asset matcher
├── .env.local.example
├── CLAUDE.md                     # Architecture docs + conventions
├── components.json
├── next.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

## Implementation Steps (in order)

### Step 1: Scaffold (~10 min)
**Goal:** Working Next.js project with all deps installed.

1. `npx create-next-app@latest cashflow --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
2. Install deps: `@supabase/ssr`, `@supabase/supabase-js`, `recharts`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `shadcn`
3. `npx shadcn@latest init` (base-nova, neutral, CSS variables)
4. `npx shadcn@latest add button card input label select textarea dialog separator badge table`
5. Create `.env.local.example`, verify `postcss.config.mjs` uses `@tailwindcss/postcss`
6. Verify dev server starts

**Files:** ~15 (mostly generated)

### Step 2: Supabase Auth Infrastructure (~5 min)
**Goal:** Auth flow working end-to-end.

Copy verbatim from travel-tracker (only change branding text):
- `src/lib/supabase/server.ts` — async createServerClient with cookie handler
- `src/lib/supabase/client.ts` — sync createBrowserClient
- `src/lib/supabase/middleware.ts` — updateSession with auth redirect
- `src/middleware.ts` — calls updateSession, asset matcher
- `src/app/(auth)/login/page.tsx` — email/password, signUp + signInWithPassword
- `src/app/(auth)/auth/callback/route.ts` — exchangeCodeForSession

**Files:** 6

### Step 3: Database Migrations (~5 min)
**Goal:** Schema ready to run against Supabase.

| File | Contents |
|------|----------|
| `001_enums.sql` | `account_type`, `event_type` enums |
| `002_accounts.sql` | accounts table + RLS (4 policies) + indexes |
| `003_categories.sql` | categories table + self-ref parent_id + RLS |
| `004_cashflow_events.sql` | cashflow_events table + FKs + JSONB recurrence_rule + RLS |

**Key decisions:**
- `current_balance` as NUMERIC (not integer cents) for simplicity
- `recurrence_rule` as JSONB: `{frequency, interval, day_of_month, end_date}`
- `category_id` nullable on events (categories optional for forecasting)
- All user-owned tables: RLS with `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE

**Files:** 4

### Step 4: Types + Layouts (~5 min)
**Goal:** Type system and app shell.

- `src/lib/types/database.ts` — Account, Category, CashflowEvent, RecurrenceRule, ProjectionDataPoint types
- `src/app/layout.tsx` — root layout (Geist fonts, globals.css)
- `src/app/page.tsx` — redirect to /dashboard
- `src/app/(app)/layout.tsx` — sidebar/nav with Dashboard | Accounts | Events + sign-out
- `src/components/shared/empty-state.tsx` + `confirm-dialog.tsx`

**Files:** 6

### Step 5: Account CRUD (~10 min)
**Goal:** Create, list, edit, delete accounts.

- `src/actions/accounts.ts` — createAccount, updateAccount, deleteAccount (travel-tracker pattern: createClient → getUser → FormData → DB → revalidatePath → redirect)
- `src/app/(app)/accounts/page.tsx` — server component, fetch + render list
- `src/app/(app)/accounts/new/page.tsx` — render AccountForm with createAccount
- `src/app/(app)/accounts/[id]/edit/page.tsx` — fetch account, bind updateAccount
- `src/components/accounts/account-form.tsx` — client form (name, type select, balance, currency)
- `src/components/accounts/account-card.tsx` — display card
- `src/components/accounts/delete-account-button.tsx` — confirm dialog

**Files:** 7

### Step 6: Cashflow Event CRUD (~15 min)
**Goal:** Create, list, edit events with recurring support.

- `src/actions/events.ts` — createEvent, updateEvent, deleteEvent (recurrence_rule from hidden JSON input)
- `src/app/(app)/events/page.tsx` — server component, fetch events with account joins
- `src/app/(app)/events/new/page.tsx` — fetch accounts, render EventForm
- `src/app/(app)/events/[id]/edit/page.tsx` — fetch event + accounts, bind updateEvent
- `src/components/events/event-form.tsx` — client form with income/expense toggle, recurring checkbox
- `src/components/events/recurrence-fields.tsx` — frequency select, interval, day_of_month, end_date
- `src/components/events/event-card.tsx` — display card with recurrence indicator
- `src/components/events/delete-event-button.tsx` — confirm dialog

**Form pattern:** Same as travel-tracker flight-form — local state for toggles, hidden inputs for complex data (recurrence_rule serialized as JSON).

**Files:** 8

### Step 7: Projection Algorithm (~10 min)
**Goal:** Pure function that computes daily balance projection.

**File:** `src/lib/projection.ts`

```
Input: accounts[], events[], startDate, endDate, accountId?
Output: { dataPoints[], negativeDates[], lowestBalance, lowestBalanceDate }
```

Algorithm:
1. Filter to target account(s), get starting balance
2. Expand recurring events into individual occurrences within date range
3. Place all events (one-off + expanded) into date-keyed map
4. Walk day-by-day: `balance += income - expenses`
5. Track negative dates and lowest balance

Edge cases: month-end clamping (31st → 28th in Feb), end_date cutoff, DST-safe date math using UTC dates only.

**Files:** 1

### Step 8: Dashboard + Projection Chart (~10 min)
**Goal:** Visual projection with time range controls.

- `src/app/(app)/dashboard/page.tsx` — server component: fetch accounts + events, compute summary stats, pass to client components
- `src/components/dashboard/stats-grid.tsx` — 4 cards (Total Balance, Income This Month, Expenses This Month, Active Accounts)
- `src/components/dashboard/projection-chart.tsx` — **"use client"**: Recharts AreaChart with time range selector (30/60/90/180/365 days), account filter, green above zero / red below zero, tooltip with event details, negative balance warning
- `src/components/dashboard/account-summary-card.tsx` — per-account balance card

**Recharts SSR handling:** projection-chart.tsx is `"use client"`. If hydration issues arise, use `next/dynamic` with `{ ssr: false }`.

**Files:** 4

### Step 9: CLAUDE.md + Documentation (~5 min)
**Goal:** Project documentation for future sessions.

Write `CLAUDE.md` with:
- Tech stack + rationale
- Project structure
- Architecture decisions
- Database schema summary
- Commands (dev, build, lint)
- Conventions (matching travel-tracker)
- Milestone roadmap

**Files:** 1

## Dependency Graph

```
Step 1 (Scaffold) → Step 2 (Auth) → Step 4 (Types + Layouts)
                                          ↓
Step 3 (Migrations) ←——————————————→  Step 5 (Accounts) ——→ Step 6 (Events)
                                                                    ↓
                                    Step 7 (Projection) ——→ Step 8 (Dashboard)
                                                                    ↓
                                                            Step 9 (Docs)
```

Steps 3 and 5 can start in parallel once Step 4 is done. Step 7 depends only on types (Step 4).

## Verification

1. `npm run dev` starts without errors
2. `/login` renders, can create account + sign in
3. Can CRUD accounts at `/accounts`
4. Can CRUD events at `/events` (including recurring)
5. `/dashboard` shows stats grid + projection chart
6. Chart renders balance projection with time range control
7. Negative balance zones visually highlighted
8. `npm run build` completes without TypeScript errors
9. No secrets in source (only .env.local.example with placeholders)

## Blocking Dependency

**Supabase project must be created** before Steps 2-6 can be fully tested. Steps 1, 3 (writing SQL files), 4, 7, 9 can proceed without it. Once user provides URL + anon key, we wire `.env.local` and run migrations.
