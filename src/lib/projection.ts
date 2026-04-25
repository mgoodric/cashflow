import type { Account, CashflowEvent, EventOverride, EventType, LoanConfig, ProjectionDataPoint, ProjectionResult } from "./types/database";
import { computeLoanPayment } from "./loan";

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
    case "daily":
      next = addDays(current, rule.interval);
      break;
    case "weekly":
      next = addDays(current, 7 * rule.interval);
      break;
    case "biweekly":
      next = addDays(current, 14 * rule.interval);
      break;
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
      const yMonth = current.getUTCMonth();
      const yDay = current.getUTCDate();
      next = new Date(Date.UTC(yYear, yMonth, clampDay(yYear, yMonth, yDay)));
      break;
    }
    default:
      return null;
  }

  if (endDate && next > endDate) return null;
  return next;
}

function buildOverrideMap(
  overrides: EventOverride[]
): Map<string, EventOverride> {
  const map = new Map<string, EventOverride>();
  for (const o of overrides) {
    map.set(`${o.event_id}|${o.original_date}`, o);
  }
  return map;
}

function expandRecurringEvents(
  events: CashflowEvent[],
  startDate: Date,
  endDate: Date,
  overrides: EventOverride[] = [],
  accountId?: string
): Map<string, { name: string; amount: number; type: EventType }[]> {
  const eventMap = new Map<string, { name: string; amount: number; type: EventType }[]>();
  const overrideMap = buildOverrideMap(overrides);

  function addToMap(dateStr: string, entry: { name: string; amount: number; type: EventType }) {
    const existing = eventMap.get(dateStr) || [];
    existing.push(entry);
    eventMap.set(dateStr, existing);
  }

  function applyOverride(
    event: CashflowEvent,
    originalDateStr: string,
    baseEntry: { name: string; amount: number; type: EventType }
  ) {
    const override = overrideMap.get(`${event.id}|${originalDateStr}`);
    if (!override) {
      addToMap(originalDateStr, baseEntry);
      return;
    }

    if (override.is_skipped) return;

    const amount = override.override_amount ?? baseEntry.amount;
    const targetDate = override.override_date ?? originalDateStr;
    const targetDateObj = new Date(targetDate + "T00:00:00Z");

    if (targetDateObj >= startDate && targetDateObj <= endDate) {
      addToMap(targetDate, { ...baseEntry, amount });
    }
  }

  for (const event of events) {
    if (!event.is_active) continue;

    // For transfers, resolve to income or expense based on account context
    let effectiveType: EventType = event.event_type;
    if (event.event_type === "transfer") {
      if (accountId && accountId === event.destination_account_id) {
        effectiveType = "income";
      } else {
        effectiveType = "expense";
      }
    }

    const baseEntry = { name: event.name, amount: event.amount, type: effectiveType };
    const eventDate = new Date(event.event_date + "T00:00:00Z");

    if (!event.is_recurring) {
      if (eventDate >= startDate && eventDate <= endDate) {
        addToMap(event.event_date, baseEntry);
      }
      continue;
    }

    // Place the initial occurrence (with override check)
    let current = eventDate;
    if (current >= startDate && current <= endDate) {
      applyOverride(event, event.event_date, baseEntry);
    }

    // Expand future occurrences
    while (current <= endDate) {
      const next = getNextOccurrence(current, event);
      if (!next || next > endDate) break;

      if (next >= startDate) {
        const dateStr = next.toISOString().split("T")[0];
        applyOverride(event, dateStr, baseEntry);
      }
      current = next;
    }
  }

  return eventMap;
}

/**
 * Check if a given date matches a recurring event's schedule.
 */
function isPaymentDate(date: Date, event: CashflowEvent): boolean {
  const rule = event.recurrence_rule;
  if (!rule) return false;

  const eventDate = new Date(event.event_date + "T00:00:00Z");
  if (date < eventDate) return false;

  const endDate = rule.end_date ? new Date(rule.end_date + "T00:00:00Z") : null;
  if (endDate && date > endDate) return false;

  const dayOfMonth = rule.day_of_month ?? eventDate.getUTCDate();

  switch (rule.frequency) {
    case "monthly": {
      const maxDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      const targetDay = Math.min(dayOfMonth, maxDay);
      return date.getUTCDate() === targetDay;
    }
    case "quarterly": {
      const eventMonth = eventDate.getUTCMonth();
      const currentMonth = date.getUTCMonth();
      if ((currentMonth - eventMonth + 12) % 3 !== 0) return false;
      const maxDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      const targetDay = Math.min(dayOfMonth, maxDay);
      return date.getUTCDate() === targetDay;
    }
    case "yearly": {
      if (date.getUTCMonth() !== eventDate.getUTCMonth()) return false;
      const maxDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      const targetDay = Math.min(dayOfMonth, maxDay);
      return date.getUTCDate() === targetDay;
    }
    default:
      return false;
  }
}

export function computeProjection(
  accounts: Account[],
  events: CashflowEvent[],
  startDate: string,
  endDate: string,
  accountId?: string,
  overrides: EventOverride[] = []
): ProjectionResult {
  const filteredAccounts = accountId
    ? accounts.filter((a) => a.id === accountId)
    : accounts;

  const filteredEvents = accountId
    ? events.filter((e) => e.account_id === accountId || (e.event_type === "transfer" && e.destination_account_id === accountId))
    : events;

  let balance = filteredAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  // Separate loan events from regular events
  const loanEvents = filteredEvents.filter(
    (e) => e.loan_config && e.is_recurring
  );
  const regularEvents = filteredEvents.filter(
    (e) => !(e.loan_config && e.is_recurring)
  );

  const filteredOverrides = accountId
    ? overrides.filter((o) => regularEvents.some((e) => e.id === o.event_id))
    : overrides;

  const eventMap = expandRecurringEvents(regularEvents, start, end, filteredOverrides, accountId);

  // Track loan balances per loan event, starting from the account's current balance
  const loanBalances = new Map<string, number>();
  for (const loan of loanEvents) {
    const account = filteredAccounts.find((a) => a.id === loan.account_id);
    loanBalances.set(loan.id, account ? Math.abs(account.current_balance) : 0);
  }

  const dataPoints: ProjectionDataPoint[] = [];
  const negativeDates: string[] = [];
  let lowestBalance = balance;
  let lowestBalanceDate = startDate;

  let current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const dayEvents = eventMap.get(dateStr) || [];

    // Process regular events
    for (const evt of dayEvents) {
      if (evt.type === "income") {
        balance += evt.amount;
      } else {
        balance -= evt.amount;
      }
    }

    // Process loan payment events dynamically
    const loanDayEvents: { name: string; amount: number; type: EventType }[] = [];
    for (const loan of loanEvents) {
      if (!loan.is_active) continue;
      if (!isPaymentDate(current, loan)) continue;

      const loanBalance = loanBalances.get(loan.id) ?? 0;
      if (loanBalance <= 0) continue;

      const result = computeLoanPayment(
        loanBalance,
        loan.loan_config as LoanConfig,
        current
      );

      loanBalances.set(loan.id, result.newBalance);
      balance -= result.totalPayment;

      loanDayEvents.push({
        name: loan.name,
        amount: result.totalPayment,
        type: "expense" as EventType,
      });
    }

    const allDayEvents = [...dayEvents, ...loanDayEvents];

    dataPoints.push({
      date: dateStr,
      balance: Math.round(balance * 100) / 100,
      events: allDayEvents,
    });

    if (balance < 0) {
      negativeDates.push(dateStr);
    }

    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestBalanceDate = dateStr;
    }

    current = addDays(current, 1);
  }

  return {
    dataPoints,
    negativeDates,
    lowestBalance: Math.round(lowestBalance * 100) / 100,
    lowestBalanceDate,
  };
}
