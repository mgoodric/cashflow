# Cashflow Manager

Personal finance manager for cashflow forecasting. Replaces Quicken forecasting; YNAB-style expense tracking planned for future milestones.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Database:** PostgreSQL via Drizzle ORM
- **Auth:** oauth2-proxy (external, header-based) — reads `X-User` / `X-Email` headers
- **Styling:** Tailwind CSS v4 + shadcn/ui v4 (base-nova style)
- **Charts:** Recharts (Area, Sankey)
- **Language:** TypeScript (strict mode)

## Project Structure

```
cashflow/
├── drizzle/                   # Generated SQL migrations
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Geist fonts)
│   │   ├── page.tsx           # Redirects to /dashboard
│   │   ├── globals.css        # Tailwind v4 + shadcn theme
│   │   └── (app)/             # Authenticated routes
│   │       ├── dashboard/     # Stats, projection chart, Sankey chart
│   │       ├── accounts/      # Account CRUD
│   │       ├── events/        # Event CRUD with recurrence + categories
│   │       ├── import/        # QIF transaction import wizard
│   │       └── insights/      # Recurring pattern detection, category audit
│   ├── actions/               # Server actions (accounts, events, import, insights)
│   ├── components/
│   │   ├── ui/                # shadcn components
│   │   ├── shared/            # empty-state, confirm-dialog
│   │   ├── accounts/          # Account form and card
│   │   ├── events/            # Event form, card, recurrence fields
│   │   ├── dashboard/         # Stats grid, projection chart, Sankey chart, account summary
│   │   ├── import/            # Import wizard
│   │   └── insights/          # Recurring list, category audit
│   └── lib/
│       ├── auth.ts            # oauth2-proxy header auth + user upsert (React cache)
│       ├── db/
│       │   ├── schema.ts      # Drizzle schema (6 tables)
│       │   ├── index.ts       # DB client singleton
│       │   └── mappers.ts     # Row-to-type converters (toAccount, toEvent, etc.)
│       ├── types/database.ts  # TypeScript types + enums
│       ├── projection.ts      # Pure projection algorithm (client-side)
│       ├── analysis/          # Recurrence detection, category auditing
│       ├── import/            # QIF parsing, payee normalization
│       ├── constants.ts       # Account type labels, frequency labels, SELECT_CLASS
│       └── utils.ts           # cn() helper
├── drizzle.config.ts          # Drizzle Kit configuration
├── Dockerfile                 # Multi-stage production build
└── .github/workflows/         # CI/CD (release, build, security)
```

## Database Schema

Six tables defined in `src/lib/db/schema.ts`:

- **users** — Identity from oauth2-proxy (sub claim + email)
- **accounts** — Financial accounts (checking, savings, credit, loan, investment)
- **categories** — Hierarchical categories (parent_id self-reference)
- **cashflow_events** — Income/expense events with optional recurrence rules (JSONB)
- **transactions** — Imported transaction history
- **import_sessions** — QIF import tracking with rollback support

All tables use UUID primary keys, `user_id` foreign keys, and application-level user filtering via `requireUser()`.

## Auth

Authentication is handled externally by oauth2-proxy. The app reads identity from headers:
- `X-User` (or `X-Forwarded-User`) — user's sub/identity claim
- `X-Email` (or `X-Forwarded-Email`) — user's email

Key files:
- `src/lib/auth.ts` — `getUser()` (cached per request) and `requireUser()` (redirects if null)
- `src/middleware.ts` — returns 401 if `X-User` header missing

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
- All changes go through PRs to main (branch protection enabled)

### Deploy Flow
Push to branch → PR → security checks pass → merge → release-please opens Release PR → auto-merge after checks → tag created → GH Actions builds Docker image → GHCR.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Generate Drizzle migrations from schema
npm run db:migrate   # Run pending migrations
```

## Architecture Decisions

- **Drizzle ORM** — Lightweight, TypeScript-first ORM. Direct Postgres connection via `DATABASE_URL`
- **oauth2-proxy headers** — External auth, no login UI in app. Supports both `X-User` and `X-Forwarded-User` conventions
- **Shared mappers** — `lib/db/mappers.ts` provides `toAccount()`, `toEvent()`, `toCategory()`, `toTransaction()` to avoid duplicating row-to-type conversions
- **React cache on getUser()** — Deduplicates DB lookups within a single server request
- **NUMERIC for balances** — Not integer cents; simpler for personal use
- **JSONB recurrence_rule** — `{frequency, interval, day_of_month, end_date}` instead of RRULE
- **Client-side projection** — Pure function in `lib/projection.ts`; runs in browser for interactivity
- **Recharts as client component** — `"use client"` wrapper for all chart components
- **Server actions** — FormData-based pattern with `requireUser()` auth guard

## Conventions

- Server components by default; `"use client"` only when needed
- Server actions in `src/actions/` with `"use server"` directive
- Database access via `db` from `lib/db/index.ts` with Drizzle query builder
- All queries filter by `user_id` for multi-tenant safety
- Types in `lib/types/database.ts`; use mappers from `lib/db/mappers.ts` for row conversion
- Native HTML select elements with `SELECT_CLASS` constant (not shadcn Select)

## Milestones

### Phase 1 — MVP (complete)
Accounts, cashflow events (one-off + recurring), projection algorithm, Recharts balance chart, Drizzle ORM, oauth2-proxy auth.

### Phase 1.5 — Import & Intelligence (complete)
QIF file import with account/category mapping, recurring pattern detection from transaction history, category misclassification audit.

### Phase 2 — Forecasting Polish
- Local login fallback for use without oauth2-proxy
- "What-if" scenarios: duplicate a projection with modified events to compare outcomes
- Account transfer events (move money between accounts without double-counting)
- Event templates: save common events for quick re-use
- Monthly income vs expense bar chart on dashboard

### Phase 3 — Categories & Spending Breakdown
- Category CRUD (table exists with parent_id hierarchy)
- Budget limits per category with over-budget warnings
- Category-filtered projection view

### Phase 4 — Transaction History / Actuals
- Mark projected events as "occurred" with actual amounts
- Track variance: projected vs actual spending
- Balance reconciliation

### Phase 5 — Bank Sync (Plaid)
- Plaid Link integration for connecting bank accounts
- Auto-import transactions and match to projected events

### Phase 6 — Mobile & Polish
- Responsive redesign for mobile breakpoints
- PWA with offline support
- Dark mode
