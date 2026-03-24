---
task: Add Sankey chart and replace Supabase with Drizzle
slug: 20260323-150000_sankey-chart-oauth2-proxy-auth
effort: advanced
phase: complete
progress: 30/30
mode: interactive
started: 2026-03-23T15:00:00-05:00
updated: 2026-03-23T15:45:00-05:00
---

## Context

Matt wants to fully replace Supabase (both auth AND database) with:
1. **oauth2-proxy** for authentication — already deployed in front of the app on Unraid. User identity from the `sub` claim of the token.
2. **Drizzle ORM + direct Postgres** on Unraid for the database. Starting fresh — no data migration from Supabase.
3. **Category-based Sankey chart** showing income categories → expense categories money flow on the dashboard.

Single user: matt@mattgoodrich.com. The app is self-hosted on Unraid behind oauth2-proxy.

### Risks
- oauth2-proxy header format varies by provider — using X-Forwarded-User and X-Forwarded-Email
- Recharts Sankey built into v3.8.0 — confirmed available, no extra package needed
- Categories currently unused — events have category_id, Sankey shows empty state when no categories assigned

### Plan
Full Supabase replacement with Drizzle ORM + oauth2-proxy headers. Shared mappers for DRY row-to-type conversion. React cache() for per-request user deduplication.

## Criteria

- [x] ISC-1: Drizzle ORM package installed in package.json
- [x] ISC-2: Drizzle config file exists with Postgres connection
- [x] ISC-3: Drizzle schema defines users table with sub and email
- [x] ISC-4: Drizzle schema defines accounts table matching existing types
- [x] ISC-5: Drizzle schema defines categories table with parent_id
- [x] ISC-6: Drizzle schema defines cashflow_events table with category_id
- [x] ISC-7: SQL migration files generated from Drizzle schema
- [x] ISC-8: Database client helper exports reusable db instance
- [x] ISC-9: Auth utility reads user identity from oauth2-proxy headers
- [x] ISC-10: Auth utility falls back gracefully when headers missing
- [x] ISC-11: Middleware validates oauth2-proxy headers on protected routes
- [x] ISC-12: Login page and OAuth callback route removed
- [x] ISC-13: createAccount server action uses Drizzle queries
- [x] ISC-14: updateAccount server action uses Drizzle queries
- [x] ISC-15: deleteAccount server action uses Drizzle queries
- [x] ISC-16: createEvent server action uses Drizzle queries
- [x] ISC-17: updateEvent server action uses Drizzle queries
- [x] ISC-18: deleteEvent server action uses Drizzle queries
- [x] ISC-19: Dashboard page queries accounts via Drizzle
- [x] ISC-20: Dashboard page queries events via Drizzle
- [x] ISC-21: Event form includes category selector dropdown
- [x] ISC-22: Sankey chart component renders income category nodes
- [x] ISC-23: Sankey chart component renders expense category nodes
- [x] ISC-24: Sankey chart shows flow links with amounts between categories
- [x] ISC-25: Sankey chart integrated into dashboard page
- [x] ISC-26: Sankey chart has time period selector
- [x] ISC-27: Supabase JS packages removed from package.json
- [x] ISC-28: No Supabase imports remain in source code
- [x] ISC-29: Projection chart still functions with new data layer
- [x] ISC-30: Application builds successfully with npm run build
- [x] ISC-A-1: Anti: No Supabase environment variables required
- [x] ISC-A-2: Anti: No hardcoded user IDs in application code

## Decisions

- 2026-03-23 15:00: Drizzle ORM chosen over Prisma — lighter weight, TypeScript-first
- 2026-03-23 15:00: Starting fresh on Postgres — no Supabase data migration
- 2026-03-23 15:00: User identity from oauth2-proxy sub claim, single user model
- 2026-03-23 15:00: Category-based Sankey chosen — requires adding category_id to events
- 2026-03-23 15:30: Extracted shared mappers to src/lib/db/mappers.ts after /simplify review
- 2026-03-23 15:30: Added React cache() to getUser() for per-request deduplication
- 2026-03-23 15:30: Added user_id filtering to all queries (security fix from review)

## Verification

- ISC-1: `drizzle-orm` present in package.json dependencies
- ISC-2: `drizzle.config.ts` exists at project root
- ISC-3-6: Schema file at `src/lib/db/schema.ts` defines all 6 tables
- ISC-7: Migration at `drizzle/0000_dapper_roulette.sql` generated
- ISC-8: `src/lib/db/index.ts` exports singleton `db` instance
- ISC-9-10: `src/lib/auth.ts` reads X-Forwarded-User/Email, returns null when missing
- ISC-11: `src/middleware.ts` returns 401 when X-Forwarded-User missing
- ISC-12: `src/app/(auth)/` directory deleted, no login page exists
- ISC-13-18: All 6 CRUD actions in accounts.ts/events.ts use Drizzle queries
- ISC-19-20: Dashboard uses `db.select().from()` with Drizzle
- ISC-21: EventForm accepts categories prop, renders selector dropdown
- ISC-22-24: SankeyChart builds nodes/links from categorized events
- ISC-25: SankeyChart rendered in dashboard page below ProjectionChart
- ISC-26: Time period selector with 30d/90d/180d/1y buttons
- ISC-27: `grep "@supabase" package.json` returns no matches
- ISC-28: `grep -ri "supabase" src/` returns no matches
- ISC-29: ProjectionChart unchanged, receives data as props (no Supabase dep)
- ISC-30: `npm run build` passes with 0 errors
- ISC-A-1: No SUPABASE vars in .env.local or Dockerfile
- ISC-A-2: No hardcoded user IDs found via grep
