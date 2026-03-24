# Plan: Replace Supabase with Drizzle + oauth2-proxy, Add Sankey Chart

## Context

The cashflow app currently uses Supabase for both authentication (SSR cookie-based) and database access (Supabase JS client with RLS). Matt is self-hosting on Unraid behind oauth2-proxy (already deployed) and wants to:

1. **Drop Supabase entirely** — auth AND database. Starting fresh, no data migration.
2. **Use oauth2-proxy** for authentication — reads forwarded headers (sub claim, email) instead of Supabase auth.
3. **Use Drizzle ORM** connecting to Postgres on Unraid (DATABASE_URL already in infra docker-compose).
4. **Add a category-based Sankey chart** to the dashboard showing income categories → expense categories money flow.

19 files currently reference Supabase. Single user: matt@mattgoodrich.com.

---

## Implementation Plan

### Phase 1: Database Layer (Drizzle ORM)

**Install packages:**
```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

**Create Drizzle schema** — `src/lib/db/schema.ts`
- `users` table: id (uuid, PK), sub (text, unique), email (text), created_at
- `accounts` table: id (uuid, PK), user_id (FK → users), name, account_type, current_balance (numeric), currency, is_active, created_at, updated_at
- `categories` table: id (uuid, PK), user_id (FK → users), name, parent_id (self-ref FK), created_at
- `cashflow_events` table: id (uuid, PK), user_id (FK → users), account_id (FK → accounts), category_id (FK → categories, nullable), name, event_type, amount (numeric), event_date (date), is_recurring, recurrence_rule (jsonb), notes, is_active, created_at, updated_at
- `transactions` table: matching existing Transaction type
- `import_sessions` table: matching existing ImportSession type
- All tables match existing TypeScript types in `src/lib/types/database.ts`

**Create DB client** — `src/lib/db/index.ts`
- Export singleton `db` instance using `postgres` driver + `drizzle()`
- Connection via `DATABASE_URL` env var

**Create Drizzle config** — `drizzle.config.ts`
- Points to schema, outputs to `drizzle/` migrations dir

**Generate migrations:**
```bash
npx drizzle-kit generate
```

**Add npm script:** `"db:migrate": "drizzle-kit migrate"`, `"db:generate": "drizzle-kit generate"`

### Phase 2: Auth Layer (oauth2-proxy)

**Create auth utility** — `src/lib/auth.ts`
- `getUser(request?: NextRequest)` function
  - Reads `X-Forwarded-User` (sub claim) and `X-Forwarded-Email` from headers
  - In server components/actions: use `headers()` from `next/headers`
  - Returns `{ sub: string, email: string }` or null
  - Upserts user record in DB on first request (find by sub, create if missing)

**Replace middleware** — `src/middleware.ts`
- Remove Supabase import
- Check for `X-Forwarded-User` header presence
- If missing and not a static asset → return 401 (oauth2-proxy handles the redirect externally)
- No login redirect needed — oauth2-proxy handles auth flow before requests reach the app

**Update app layout** — `src/app/(app)/layout.tsx`
- Remove Supabase auth check and signOut action
- Use `getUser()` from new auth utility
- Remove sign-out button (oauth2-proxy handles session termination)
- Display user email in header from headers

### Phase 3: Replace All Supabase Queries with Drizzle

**Server actions to rewrite** (all use same pattern: auth → query → revalidate):

- `src/actions/accounts.ts` — createAccount, updateAccount, deleteAccount
- `src/actions/events.ts` — createEvent, updateEvent, deleteEvent
- `src/actions/insights.ts` — getTransactions, getCategories, analyzeRecurringPatterns, analyzeCategoryMisclassifications, createEventFromPattern, fixCategoryMisclassifications, dismissFlags
- `src/actions/import.ts` — executeImport, rollbackImport, getImportSessions

**Pattern transformation:**
```typescript
// BEFORE (Supabase)
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
const { data } = await supabase.from("accounts").select("*").eq("is_active", true);

// AFTER (Drizzle)
const user = await getUser();
if (!user) redirect("/login");
const data = await db.select().from(accounts).where(eq(accounts.isActive, true));
```

**Page components to update** (these query Supabase directly):
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/accounts/page.tsx`
- `src/app/(app)/accounts/[id]/edit/page.tsx`
- `src/app/(app)/events/page.tsx`
- `src/app/(app)/events/new/page.tsx`
- `src/app/(app)/events/[id]/edit/page.tsx`
- `src/app/(app)/import/page.tsx`
- `src/app/(app)/insights/page.tsx`
- `src/app/(app)/insights/recurring/page.tsx`
- `src/app/(app)/insights/categories/page.tsx`

### Phase 4: Sankey Chart

**Add category_id to event form** — `src/components/events/event-form.tsx`
- Accept `categories` prop (Category[])
- Add category selector dropdown (optional field)
- Include `category_id` in form submission as hidden input

**Create Sankey chart component** — `src/components/dashboard/sankey-chart.tsx`
- `"use client"` component
- Props: `events: CashflowEvent[]`, `categories: Category[]`
- Data transformation:
  - Group events by category + event_type
  - Build nodes: one per income category + one per expense category + "Uncategorized" fallback
  - Build links: income category → "Total Income" (center) → expense category, with amounts
  - Or simpler: income categories on left, expense categories on right, flows show amounts
- Time period selector (30d, 90d, 180d, 1y) matching projection chart pattern
- Uses `<Sankey>` from recharts (built-in, confirmed available)
- Wrapped in `<Card>` with shadcn styling matching existing dashboard cards

**Integrate into dashboard** — `src/app/(app)/dashboard/page.tsx`
- Query categories alongside accounts and events
- Pass to SankeyChart component below ProjectionChart

### Phase 5: Cleanup

**Delete files:**
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/auth/callback/route.ts`
- `src/app/(auth)/` directory entirely

**Remove packages:**
```bash
npm uninstall @supabase/ssr @supabase/supabase-js
```

**Update Dockerfile:**
- Remove dummy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars
- Add dummy `DATABASE_URL` for build prerendering if needed

**Update .env files:**
- `.env.local.example` → `DATABASE_URL=postgresql://user:pass@host:5432/cashflow`
- Remove Supabase vars from `.env.local`

---

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/db/schema.ts` | **Create** | Drizzle schema for all tables |
| `src/lib/db/index.ts` | **Create** | DB client singleton |
| `drizzle.config.ts` | **Create** | Drizzle Kit config |
| `src/lib/auth.ts` | **Create** | oauth2-proxy auth utility |
| `src/components/dashboard/sankey-chart.tsx` | **Create** | Sankey chart component |
| `src/middleware.ts` | **Rewrite** | oauth2-proxy header validation |
| `src/actions/*.ts` (4 files) | **Rewrite** | Drizzle queries |
| `src/app/(app)/*.tsx` (10+ pages) | **Modify** | Replace Supabase client with Drizzle |
| `src/components/events/event-form.tsx` | **Modify** | Add category selector |
| `src/app/(app)/layout.tsx` | **Rewrite** | Remove Supabase auth |
| `src/lib/supabase/*` (3 files) | **Delete** | No longer needed |
| `src/app/(auth)/*` (2 files) | **Delete** | No longer needed |
| `package.json` | **Modify** | Swap deps |
| `Dockerfile` | **Modify** | Update env vars |

## Existing Code to Reuse

- `src/lib/types/database.ts` — Keep all TypeScript interfaces (Account, CashflowEvent, Category, etc.)
- `src/lib/projection.ts` — Unchanged, pure function with no Supabase dependency
- `src/components/dashboard/projection-chart.tsx` — Unchanged, receives data as props
- `src/components/dashboard/stats-grid.tsx` — Unchanged
- `src/components/dashboard/account-summary-card.tsx` — Unchanged
- `src/lib/analysis/recurrence-detector.ts` — Unchanged, pure function
- `src/lib/analysis/category-auditor.ts` — Unchanged, pure function
- `src/lib/import/payee-normalizer.ts` — Unchanged, pure function
- Recharts Sankey is built into recharts 3.8.0 (already installed) — no new chart dependency

## Execution Strategy

Use **3 parallel Engineer agents** in worktree isolation:
1. **DB + Auth agent**: Phases 1-2 (Drizzle schema, DB client, auth utility, middleware)
2. **Server actions + pages agent**: Phase 3 (rewrite all Supabase queries) — depends on Phase 1-2 files
3. **Sankey chart agent**: Phase 4 (chart component, category form field)

Phase 3 depends on Phases 1-2 completing first (needs schema imports). Phases 1-2 and 4 can run in parallel. Phase 5 cleanup runs after all others.

## Verification

1. `npm run build` — confirms no TypeScript errors, no Supabase imports remain
2. `grep -r "supabase" src/` — zero results expected
3. `grep -r "SUPABASE" .env* Dockerfile` — zero results expected
4. Visual: Sankey chart renders with mock/test data on dashboard
5. All server actions reference `db` from Drizzle, not Supabase client
6. Middleware reads `X-Forwarded-User` header, not Supabase cookies
