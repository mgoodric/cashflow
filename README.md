# Cashflow

Personal finance manager for cashflow forecasting. Track accounts, income, and expenses with recurring event support, balance projections, and category-based flow visualization.

Built as a self-hosted alternative to Quicken's forecasting features, with YNAB-style expense tracking planned for future milestones.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Accounts** — Track checking, savings, credit, loan, and investment accounts
- **Cashflow Events** — One-off and recurring income/expenses with flexible recurrence rules (daily, weekly, biweekly, monthly, quarterly, yearly)
- **Balance Projection** — Interactive chart forecasting account balances over configurable time ranges (30d to 1y) with negative balance warnings
- **Sankey Flow Chart** — Visualize how income categories flow into expense categories
- **Transaction Import** — Import from QIF files (Quicken export) with duplicate detection and category mapping
- **Insights** — Detect recurring patterns in transaction history, audit category assignments
- **Self-Hosted** — Runs on your own infrastructure behind oauth2-proxy for authentication

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19) |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team) |
| Auth | [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) (external, header-based) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| Charts | [Recharts](https://recharts.org) (Area, Sankey) |
| Language | TypeScript (strict mode) |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- oauth2-proxy (or similar reverse proxy for authentication)

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL

# Generate and run database migrations
npm run db:generate
npm run db:migrate

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** Authentication currently requires oauth2-proxy headers. In development without a proxy, requests will return 401. You can temporarily modify `src/middleware.ts` to pass through requests. A local login fallback is on the [roadmap](#roadmap).

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/cashflow` |

Authentication is handled externally by oauth2-proxy, which forwards `X-User` and `X-Email` headers to the app. No auth-specific env vars are needed in the application.

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
│   │       ├── events/        # Event CRUD with recurrence
│   │       ├── import/        # QIF transaction import wizard
│   │       └── insights/      # Recurring pattern detection, category audit
│   ├── actions/               # Server actions (accounts, events, import, insights)
│   ├── components/
│   │   ├── ui/                # shadcn components
│   │   ├── shared/            # Empty state, confirm dialog
│   │   ├── accounts/          # Account form and card
│   │   ├── events/            # Event form, card, recurrence fields
│   │   ├── dashboard/         # Stats grid, projection chart, Sankey chart, account summary
│   │   ├── import/            # Import wizard
│   │   └── insights/          # Recurring list, category audit
│   └── lib/
│       ├── auth.ts            # oauth2-proxy header auth + user upsert
│       ├── db/                # Drizzle schema, client, row mappers
│       ├── types/database.ts  # TypeScript types + enums
│       ├── projection.ts      # Pure projection algorithm
│       ├── analysis/          # Recurrence detection, category auditing
│       └── import/            # QIF parsing, payee normalization
├── drizzle.config.ts          # Drizzle Kit configuration
├── Dockerfile                 # Multi-stage production build
└── .github/workflows/         # CI/CD (release, build, security)
```

## Database Schema

| Table | Description |
|-------|-------------|
| `users` | User identity from oauth2-proxy (sub claim + email) |
| `accounts` | Financial accounts (checking, savings, credit, loan, investment) |
| `categories` | Hierarchical categories (parent_id self-reference) |
| `cashflow_events` | Income/expense events with optional recurrence rules (JSONB) |
| `transactions` | Imported transaction history |
| `import_sessions` | QIF import tracking with rollback support |

All tables use UUID primary keys and `user_id` foreign keys for multi-tenant isolation.

## Deployment

The app is designed for self-hosting with Docker behind oauth2-proxy.

### Architecture

```
Internet → Reverse Proxy → oauth2-proxy → Cashflow (Docker)
                                                ↓
                                           PostgreSQL
```

### Deploy Flow

```
Push to branch → PR → Security checks pass → Merge
→ release-please opens Release PR → Checks pass → Auto-merge
→ Git tag created → GitHub Actions builds Docker image → GHCR
```

Use a container management tool like [Watchtower](https://containrrr.dev/watchtower/) to automatically pull new images, or pull manually with `docker pull`.

### Docker

The app ships as a standalone Next.js Docker image:

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/cashflow \
  -e NODE_ENV=production \
  ghcr.io/mgoodric/cashflow:latest
```

### oauth2-proxy Integration

The app reads user identity from headers set by your reverse proxy after oauth2-proxy authentication. It supports both `X-User`/`X-Email` and `X-Forwarded-User`/`X-Forwarded-Email` header conventions.

Example nginx configuration with `auth_request`:

```nginx
auth_request_set $user   $upstream_http_x_auth_request_user;
auth_request_set $email  $upstream_http_x_auth_request_email;
proxy_set_header X-User  $user;
proxy_set_header X-Email $email;
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Run pending migrations |

## Roadmap

- [ ] Local login fallback — email/password auth for use without oauth2-proxy
- [ ] "What-if" scenarios — duplicate projections with modified events
- [ ] Account transfer events (move money without double-counting)
- [ ] Event templates for common recurring items
- [ ] Monthly income vs expense bar chart
- [ ] Budget limits per category with warnings
- [ ] Transaction history — mark events as occurred with actual amounts
- [ ] Balance reconciliation
- [ ] Plaid integration for bank sync
- [ ] Mobile responsive / PWA

## License

[MIT](LICENSE)
