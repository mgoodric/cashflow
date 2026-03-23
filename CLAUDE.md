# Cashflow Manager

Personal finance manager for cashflow forecasting. Replaces Quicken forecasting; YNAB-style expense tracking planned for future milestones.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Styling:** Tailwind CSS v4 + shadcn/ui v4 (base-nova style)
- **Charts:** Recharts
- **Language:** TypeScript (strict mode)

## Project Structure

```
cashflow/
├── supabase/migrations/       # SQL migration files (run manually via Supabase dashboard)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Geist fonts)
│   │   ├── page.tsx           # Redirects to /dashboard
│   │   ├── globals.css        # Tailwind v4 + shadcn theme
│   │   ├── (auth)/            # Login page + OAuth callback
│   │   └── (app)/             # Authenticated routes (dashboard, accounts, events)
│   ├── actions/               # Server actions (accounts.ts, events.ts)
│   ├── components/
│   │   ├── ui/                # shadcn components
│   │   ├── shared/            # empty-state, confirm-dialog
│   │   ├── accounts/          # Account CRUD components
│   │   ├── events/            # Event CRUD + recurrence components
│   │   └── dashboard/         # Stats grid, projection chart, account summary
│   ├── lib/
│   │   ├── utils.ts           # cn() helper
│   │   ├── types/database.ts  # TypeScript types + enums
│   │   ├── projection.ts      # Pure projection algorithm
│   │   └── supabase/          # Server/client/middleware helpers
│   └── middleware.ts          # Auth guard
```

## Database Schema

- **accounts** — Financial accounts (checking, savings, credit, loan, investment)
- **categories** — Hierarchical categories (parent_id self-ref)
- **cashflow_events** — Income/expense events with optional recurrence (JSONB rule)

All tables use RLS with `auth.uid() = user_id` policies.

## Git Conventions

This repo uses **release-please** for automated versioning. Commit messages MUST follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>
```

### Types
- `feat:` — New feature (→ minor version bump)
- `fix:` — Bug fix (→ patch version bump)
- `feat!:` or `fix!:` or `BREAKING CHANGE:` in body — Breaking change (→ major bump)
- `chore:` — Maintenance, deps, config (no version bump)
- `docs:` — Documentation only (no version bump)
- `refactor:` — Code change that neither fixes nor adds (no version bump)
- `test:` — Adding or updating tests (no version bump)
- `ci:` — CI/CD changes (no version bump)

### Rules
- After completing and verifying a task, create a commit with the appropriate prefix
- The description should explain **why**, not just what (the diff shows what)
- Keep the first line under 72 characters
- Multi-file changes get a single commit unless they're logically separate
- If a task adds a feature AND fixes a bug, use `feat:` (the higher bump wins)

### Deploy Flow
Push to main → release-please opens a Release PR → merge it → tag created → GH Actions builds Docker image → GHCR → Watchtower deploys on Unraid.

## Commands

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint
```

## Architecture Decisions

- **NUMERIC for balances** — Not integer cents; simpler for personal use
- **JSONB recurrence_rule** — `{frequency, interval, day_of_month, end_date}` instead of RRULE
- **Client-side projection** — Pure function in `lib/projection.ts`; runs in browser for interactivity
- **Recharts as client component** — `"use client"` wrapper; if SSR issues, use `next/dynamic`
- **Server actions** — FormData-based pattern matching travel-tracker

## Conventions

- Server components by default; `"use client"` only when needed
- Server actions in `src/actions/` with `"use server"` directive
- Supabase client via `createClient()` from `lib/supabase/server.ts` (server) or `client.ts` (browser)
- Types in `lib/types/database.ts`; cast Supabase responses with `as Type`

## Milestones

### Phase 1 — MVP (complete)
Accounts, cashflow events (one-off + recurring), projection algorithm, Recharts balance chart, auth, database with RLS.

### Phase 2 — Forecasting Polish
- Projection accuracy: handle events that already occurred this month vs. future-only
- "What-if" scenarios: duplicate a projection with modified events to compare outcomes
- Account transfer events (move money between accounts without double-counting)
- Event templates: save common events for quick re-use (e.g., "Paycheck", "Rent")
- Skip weekends option for business-day events
- Monthly income vs expense bar chart on dashboard

### Phase 3 — Categories & Spending Breakdown
- Category CRUD (table already exists with parent_id hierarchy)
- Assign categories to events
- Spending breakdown pie/bar chart on dashboard
- Budget limits per category with over-budget warnings
- Category-filtered projection view

### Phase 4 — Transaction History / Actuals
- Mark projected events as "occurred" with actual amounts
- Track variance: projected vs actual spending
- Running transaction ledger per account
- Balance reconciliation (adjust account balance to match bank statement)

### Phase 5 — Bank Sync (Plaid)
- Plaid Link integration for connecting bank accounts
- Auto-import transactions and match to projected events
- Auto-update account balances from bank feeds
- Requires server-side Plaid API key management

### Phase 6 — Mobile & Polish
- Responsive redesign for mobile breakpoints
- PWA with offline support, or native iOS via Supabase Swift SDK
- Push notifications for upcoming negative balance warnings
- Dark mode
