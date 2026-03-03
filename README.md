# Cash Flow Planner — UC-09

Self-hosted React + FastAPI app for forward financial planning. Timeline-based income/expense
event entry with running balance projection across accounts.

## Stack
- Frontend: React + Recharts (timeline/balance projection chart) + Tailwind
- Backend: FastAPI + asyncpg
- Database: apps Postgres database (cashflow_accounts, cashflow_events)

## Getting Started
TODO: Scaffold with Vite + React
TODO: Implement account and event CRUD endpoints
TODO: Implement forward balance projection algorithm (daily model)
TODO: Actual Budget import for actuals-vs-plan comparison

## Key Features
- Multi-account balance projection
- Recurring event support (monthly bills, annual expenses, income)
- Negative balance alerts within planning horizon
- Confirmed vs. estimated event distinction
- Discord /cashflow-summary command for quick snapshot
