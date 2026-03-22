import type { Account, CashflowEvent, EventType, ProjectionDataPoint, ProjectionResult } from "./types/database";

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

function expandRecurringEvents(
  events: CashflowEvent[],
  startDate: Date,
  endDate: Date
): Map<string, { name: string; amount: number; type: EventType }[]> {
  const eventMap = new Map<string, { name: string; amount: number; type: EventType }[]>();

  function addToMap(dateStr: string, entry: { name: string; amount: number; type: EventType }) {
    const existing = eventMap.get(dateStr) || [];
    existing.push(entry);
    eventMap.set(dateStr, existing);
  }

  for (const event of events) {
    if (!event.is_active) continue;

    const entry = { name: event.name, amount: event.amount, type: event.event_type };
    const eventDate = new Date(event.event_date + "T00:00:00Z");

    if (!event.is_recurring) {
      if (eventDate >= startDate && eventDate <= endDate) {
        addToMap(event.event_date, entry);
      }
      continue;
    }

    // Place the initial occurrence
    let current = eventDate;
    if (current >= startDate && current <= endDate) {
      addToMap(event.event_date, entry);
    }

    // Expand future occurrences
    while (current <= endDate) {
      const next = getNextOccurrence(current, event);
      if (!next || next > endDate) break;

      if (next >= startDate) {
        const dateStr = next.toISOString().split("T")[0];
        addToMap(dateStr, entry);
      }
      current = next;
    }
  }

  return eventMap;
}

export function computeProjection(
  accounts: Account[],
  events: CashflowEvent[],
  startDate: string,
  endDate: string,
  accountId?: string
): ProjectionResult {
  const filteredAccounts = accountId
    ? accounts.filter((a) => a.id === accountId)
    : accounts;

  const filteredEvents = accountId
    ? events.filter((e) => e.account_id === accountId)
    : events;

  let balance = filteredAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  const eventMap = expandRecurringEvents(filteredEvents, start, end);

  const dataPoints: ProjectionDataPoint[] = [];
  const negativeDates: string[] = [];
  let lowestBalance = balance;
  let lowestBalanceDate = startDate;

  let current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const dayEvents = eventMap.get(dateStr) || [];

    for (const evt of dayEvents) {
      if (evt.type === "income") {
        balance += evt.amount;
      } else {
        balance -= evt.amount;
      }
    }

    dataPoints.push({ date: dateStr, balance: Math.round(balance * 100) / 100, events: dayEvents });

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
