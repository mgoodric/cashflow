import { describe, it, expect } from "vitest";
import { computeProjection } from "../projection";
import type { Account, CashflowEvent } from "../types/database";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    user_id: "user-1",
    name: "Checking",
    account_type: "checking",
    current_balance: 1000,
    currency: "USD",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CashflowEvent> = {}): CashflowEvent {
  return {
    id: "evt-1",
    user_id: "user-1",
    account_id: "acc-1",
    category_id: null,
    name: "Test Event",
    event_type: "expense",
    amount: 100,
    event_date: "2026-01-15",
    is_recurring: false,
    recurrence_rule: null,
    notes: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeProjection", () => {
  it("returns starting balance when no events", () => {
    const result = computeProjection([makeAccount()], [], "2026-01-01", "2026-01-03");
    expect(result.dataPoints).toHaveLength(3);
    expect(result.dataPoints[0].balance).toBe(1000);
    expect(result.dataPoints[2].balance).toBe(1000);
    expect(result.negativeDates).toHaveLength(0);
  });

  it("subtracts expense on event date", () => {
    const result = computeProjection(
      [makeAccount()],
      [makeEvent({ event_date: "2026-01-02", amount: 300 })],
      "2026-01-01",
      "2026-01-03"
    );
    expect(result.dataPoints[0].balance).toBe(1000);
    expect(result.dataPoints[1].balance).toBe(700);
    expect(result.dataPoints[2].balance).toBe(700);
  });

  it("adds income on event date", () => {
    const result = computeProjection(
      [makeAccount()],
      [makeEvent({ event_type: "income", event_date: "2026-01-02", amount: 500 })],
      "2026-01-01",
      "2026-01-03"
    );
    expect(result.dataPoints[1].balance).toBe(1500);
  });

  it("tracks negative balance dates", () => {
    const result = computeProjection(
      [makeAccount({ current_balance: 50 })],
      [makeEvent({ event_date: "2026-01-02", amount: 100 })],
      "2026-01-01",
      "2026-01-03"
    );
    expect(result.negativeDates).toContain("2026-01-02");
    expect(result.lowestBalance).toBe(-50);
    expect(result.lowestBalanceDate).toBe("2026-01-02");
  });

  it("expands monthly recurring events", () => {
    const result = computeProjection(
      [makeAccount({ current_balance: 5000 })],
      [
        makeEvent({
          event_date: "2026-01-15",
          amount: 1000,
          is_recurring: true,
          recurrence_rule: { frequency: "monthly", interval: 1, day_of_month: 15 },
        }),
      ],
      "2026-01-01",
      "2026-03-31"
    );

    // Should hit on Jan 15, Feb 15, Mar 15
    const eventDays = result.dataPoints.filter((dp) => dp.events.length > 0);
    expect(eventDays).toHaveLength(3);
    expect(eventDays[0].date).toBe("2026-01-15");
    expect(eventDays[1].date).toBe("2026-02-15");
    expect(eventDays[2].date).toBe("2026-03-15");
    expect(result.dataPoints[result.dataPoints.length - 1].balance).toBe(2000);
  });

  it("expands weekly recurring events", () => {
    const result = computeProjection(
      [makeAccount({ current_balance: 1000 })],
      [
        makeEvent({
          event_date: "2026-01-01",
          amount: 50,
          is_recurring: true,
          recurrence_rule: { frequency: "weekly", interval: 1 },
        }),
      ],
      "2026-01-01",
      "2026-01-31"
    );

    // Jan 1, 8, 15, 22, 29 = 5 occurrences
    const eventDays = result.dataPoints.filter((dp) => dp.events.length > 0);
    expect(eventDays).toHaveLength(5);
  });

  it("clamps day_of_month to end of month (Feb 31 → Feb 28)", () => {
    const result = computeProjection(
      [makeAccount({ current_balance: 5000 })],
      [
        makeEvent({
          event_date: "2026-01-31",
          amount: 100,
          is_recurring: true,
          recurrence_rule: { frequency: "monthly", interval: 1, day_of_month: 31 },
        }),
      ],
      "2026-01-01",
      "2026-03-31"
    );

    const eventDays = result.dataPoints.filter((dp) => dp.events.length > 0);
    expect(eventDays[0].date).toBe("2026-01-31");
    expect(eventDays[1].date).toBe("2026-02-28"); // Clamped
    expect(eventDays[2].date).toBe("2026-03-31");
  });

  it("respects recurrence end_date", () => {
    const result = computeProjection(
      [makeAccount({ current_balance: 5000 })],
      [
        makeEvent({
          event_date: "2026-01-15",
          amount: 100,
          is_recurring: true,
          recurrence_rule: { frequency: "monthly", interval: 1, day_of_month: 15, end_date: "2026-02-20" },
        }),
      ],
      "2026-01-01",
      "2026-04-30"
    );

    const eventDays = result.dataPoints.filter((dp) => dp.events.length > 0);
    expect(eventDays).toHaveLength(2); // Jan 15 and Feb 15 only
  });

  it("skips inactive events", () => {
    const result = computeProjection(
      [makeAccount()],
      [makeEvent({ is_active: false, event_date: "2026-01-02", amount: 500 })],
      "2026-01-01",
      "2026-01-03"
    );
    expect(result.dataPoints[1].balance).toBe(1000);
  });

  it("filters by accountId", () => {
    const result = computeProjection(
      [makeAccount({ id: "acc-1" }), makeAccount({ id: "acc-2", current_balance: 2000 })],
      [
        makeEvent({ account_id: "acc-1", event_date: "2026-01-02", amount: 100 }),
        makeEvent({ id: "evt-2", account_id: "acc-2", event_date: "2026-01-02", amount: 200 }),
      ],
      "2026-01-01",
      "2026-01-03",
      "acc-1"
    );

    // Only acc-1 balance (1000) and acc-1 events (-100)
    expect(result.dataPoints[1].balance).toBe(900);
  });

  it("sums multiple accounts", () => {
    const result = computeProjection(
      [makeAccount({ current_balance: 1000 }), makeAccount({ id: "acc-2", current_balance: 2000 })],
      [],
      "2026-01-01",
      "2026-01-01"
    );
    expect(result.dataPoints[0].balance).toBe(3000);
  });

  it("handles multiple events on same day", () => {
    const result = computeProjection(
      [makeAccount({ current_balance: 1000 })],
      [
        makeEvent({ event_date: "2026-01-02", amount: 100 }),
        makeEvent({ id: "evt-2", event_date: "2026-01-02", amount: 200, event_type: "income" }),
      ],
      "2026-01-01",
      "2026-01-03"
    );
    // 1000 - 100 + 200 = 1100
    expect(result.dataPoints[1].balance).toBe(1100);
    expect(result.dataPoints[1].events).toHaveLength(2);
  });
});
