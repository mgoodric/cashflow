import type { Account, CashflowEvent, EventOverride, LoanConfig } from "./types/database";
import { computeLoanPayment } from "./loan";

export interface ProjectedRow {
  id: string;
  date: string;
  name: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  account_id: string;
  account_name: string;
  category_name: string | null;
  event_id: string;
  source: "projected";
  is_overridden: boolean;
  loan_payment?: { interest: number; principal: number; extraPrincipal: number };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function clampDay(year: number, month: number, day: number): number {
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.min(day, maxDay);
}

function getNextOccurrence(current: Date, event: CashflowEvent): Date | null {
  const rule = event.recurrence_rule;
  if (!rule) return null;

  const endDate = rule.end_date ? new Date(rule.end_date + "T00:00:00Z") : null;
  let next: Date;

  switch (rule.frequency) {
    case "daily": next = addDays(current, rule.interval); break;
    case "weekly": next = addDays(current, 7 * rule.interval); break;
    case "biweekly": next = addDays(current, 14 * rule.interval); break;
    case "monthly": {
      const m = current.getUTCMonth() + rule.interval;
      const year = current.getUTCFullYear() + Math.floor(m / 12);
      const month = m % 12;
      const day = rule.day_of_month ?? current.getUTCDate();
      next = new Date(Date.UTC(year, month, clampDay(year, month, day)));
      break;
    }
    case "quarterly": {
      const qm = current.getUTCMonth() + 3 * rule.interval;
      const qYear = current.getUTCFullYear() + Math.floor(qm / 12);
      const qMonth = qm % 12;
      const qDay = rule.day_of_month ?? current.getUTCDate();
      next = new Date(Date.UTC(qYear, qMonth, clampDay(qYear, qMonth, qDay)));
      break;
    }
    case "yearly": {
      const yYear = current.getUTCFullYear() + rule.interval;
      next = new Date(Date.UTC(yYear, current.getUTCMonth(), clampDay(yYear, current.getUTCMonth(), current.getUTCDate())));
      break;
    }
    default: return null;
  }

  if (endDate && next > endDate) return null;
  return next;
}

export function expandEventsToRows(
  events: CashflowEvent[],
  accounts: Account[],
  overrides: EventOverride[],
  futureDays: number = 90,
  pastDays: number = 30
): ProjectedRow[] {
  const rows: ProjectedRow[] = [];
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const startDate = addDays(todayUtc, -pastDays);
  const endDate = addDays(todayUtc, futureDays);

  const overrideMap = new Map<string, EventOverride>();
  for (const o of overrides) {
    overrideMap.set(`${o.event_id}|${o.original_date}`, o);
  }

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const loanBalances = new Map<string, number>();

  // Initialize loan balances
  for (const event of events) {
    if (event.loan_config && event.is_recurring) {
      const acct = accountMap.get(event.account_id);
      loanBalances.set(event.id, acct ? Math.abs(acct.current_balance) : 0);
    }
  }

  for (const event of events) {
    if (!event.is_active) continue;

    const acct = accountMap.get(event.account_id);
    const accountName = acct?.name ?? "Unknown";
    const isLoan = !!event.loan_config && event.is_recurring;

    function addRow(dateStr: string, amount: number, isOverridden: boolean, loanPayment?: ProjectedRow["loan_payment"]) {
      rows.push({
        id: `projected-${event.id}-${dateStr}`,
        date: dateStr,
        name: event.name,
        amount,
        type: event.event_type as ProjectedRow["type"],
        account_id: event.account_id,
        account_name: accountName,
        category_name: null,
        event_id: event.id,
        source: "projected",
        is_overridden: isOverridden,
        loan_payment: loanPayment,
      });
    }

    function processDate(dateStr: string) {
      const override = overrideMap.get(`${event.id}|${dateStr}`);
      if (override?.is_skipped) return;

      const targetDate = override?.override_date ?? dateStr;
      let isOverridden = !!override;

      if (isLoan) {
        const balance = loanBalances.get(event.id) ?? 0;
        if (balance <= 0) return;

        const config = event.loan_config!;
        const effectiveConfig: LoanConfig = override?.override_amount != null
          ? { ...config, extra_principal: override.override_amount }
          : config;

        const payment = computeLoanPayment(balance, effectiveConfig, new Date(targetDate + "T00:00:00Z"));
        loanBalances.set(event.id, payment.newBalance);

        if (override?.override_amount != null) isOverridden = true;

        addRow(targetDate, payment.totalPayment, isOverridden, {
          interest: payment.interest,
          principal: payment.principal,
          extraPrincipal: payment.extraPrincipal,
        });
      } else {
        const amount = override?.override_amount ?? event.amount;
        addRow(targetDate, amount, isOverridden);
      }
    }

    const eventDate = new Date(event.event_date + "T00:00:00Z");

    if (!event.is_recurring) {
      if (eventDate >= startDate && eventDate <= endDate) {
        processDate(event.event_date);
      }
      continue;
    }

    // Initial occurrence
    let current = eventDate;
    if (current >= startDate && current <= endDate) {
      processDate(event.event_date);
    }

    // Future occurrences
    while (current <= endDate) {
      const next = getNextOccurrence(current, event);
      if (!next || next > endDate) break;
      if (next >= startDate) {
        processDate(next.toISOString().split("T")[0]);
      }
      current = next;
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
