# Product Requirements Document (PRD): Custom Finance Manager

## Overview
A unified personal finance management system designed to replace Quicken and YNAB. The system focuses on cash flow forecasting, flexible expense tracking, and robust reconciliation via banking APIs (like Plaid). It includes both a comprehensive desktop/web experience for planning and a mobile-optimized experience for on-the-go tracking.

## Core Workflows and Features

### 1. Forecasting & Planning (The "Quicken" use-case)
* **Scheduled Transactions**: Ability to record recurring future payments (mortgage, subscriptions) and future cash inflows (paychecks).
* **One-off Future Expenses**: Ability to plug in known future expenses (e.g., upcoming bonuses, planned purchases).
* **Cashflow Projections**: Visual and tabular forecasting of account balances into the future based on scheduled and one-off items.

### 2. On-the-Go Expense Tracking (The "YNAB" use-case)
* **Mobile Interface**: Fast, responsive data entry for recording expenses while out and about.
* **Transaction Splitting**: Support for complex transaction splits across multiple categories (e.g., $500 total = $255 groceries + $45 pharmacy + $200 clothing).
* **Category Tracking**: Tracking expenses against plan/budgeted amounts.

### 3. Account Management & Segregation
* **Multiple Accounts**: Support for checking, savings, credit cards, loans, investments.
* **Account Groupings/Tags**: 
  * Ability to tag specific accounts (e.g., Treasurer accounts for external orgs).
  * Exclude specific groupings from global Net Worth tracking.
  * Generate isolated reports specifically for those tags/groupings.

### 4. Reconciliation
* **Bank Sync**: Integration with an aggregator like Plaid to auto-download cleared transactions.
* **Matching**: Ability to match downloaded transactions against manually entered (or scheduled) transactions.

## Client Platforms
1. **Web Interface**: Rich interface suitable for heavy planning, generating reports, managing schedules, and deep reconciliation.
2. **Mobile Interface**: Streamlined interface focused on point-of-sale transaction entry, splitting, and checking current category balances.
