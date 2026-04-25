import { describe, it, expect } from "vitest";
import { buildScenarioEvents, applyBalanceAdjustments } from "../scenario";
import { computeProjection } from "../projection";
import type { Account, CashflowEvent, Scenario, ScenarioEvent } from "../types/database";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    user_id: "user-1",
    name: "Checking",
    account_type: "checking",
    current_balance: 5000,
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
    name: "Mortgage",
    event_type: "expense",
    amount: 2000,
    event_date: "2026-01-15",
    is_recurring: true,
    recurrence_rule: { frequency: "monthly", interval: 1, day_of_month: 15 },
    notes: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeScenarioEvent(overrides: Partial<ScenarioEvent> = {}): ScenarioEvent {
  return {
    id: "se-1",
    scenario_id: "scen-1",
    event_id: null,
    action: "exclude",
    name: null,
    event_type: null,
    amount: null,
    event_date: null,
    account_id: null,
    is_recurring: null,
    recurrence_rule: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "scen-1",
    user_id: "user-1",
    name: "NYC Move",
    description: null,
    balance_adjustments: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildScenarioEvents", () => {
  it("excludes events marked for exclusion", () => {
    const base = [makeEvent(), makeEvent({ id: "evt-2", name: "Insurance" })];
    const mods = [makeScenarioEvent({ action: "exclude", event_id: "evt-1" })];

    const result = buildScenarioEvents(base, mods);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Insurance");
  });

  it("modifies event amount", () => {
    const base = [makeEvent({ amount: 2000 })];
    const mods = [makeScenarioEvent({ action: "modify", event_id: "evt-1", amount: 3000 })];

    const result = buildScenarioEvents(base, mods);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(3000);
    expect(result[0].name).toBe("Mortgage");
  });

  it("adds scenario-only events", () => {
    const base = [makeEvent()];
    const mods = [
      makeScenarioEvent({
        id: "se-add",
        action: "add",
        name: "Private School",
        event_type: "expense",
        amount: 3500,
        event_date: "2026-09-01",
        account_id: "acc-1",
        is_recurring: true,
        recurrence_rule: { frequency: "monthly", interval: 1, day_of_month: 1 },
      }),
    ];

    const result = buildScenarioEvents(base, mods);
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Private School");
    expect(result[1].amount).toBe(3500);
    expect(result[1].is_recurring).toBe(true);
  });

  it("preserves unmodified events", () => {
    const base = [
      makeEvent(),
      makeEvent({ id: "evt-2", name: "Insurance", amount: 500 }),
    ];
    const mods = [makeScenarioEvent({ action: "modify", event_id: "evt-1", amount: 3000 })];

    const result = buildScenarioEvents(base, mods);
    const insurance = result.find((e) => e.id === "evt-2");
    expect(insurance?.amount).toBe(500);
  });
});

describe("applyBalanceAdjustments", () => {
  it("adjusts account balance", () => {
    const accounts = [makeAccount({ current_balance: 5000 })];
    const scenario = makeScenario({ balance_adjustments: { "acc-1": 50000 } });

    const result = applyBalanceAdjustments(accounts, scenario);
    expect(result[0].current_balance).toBe(55000);
  });

  it("handles negative adjustments", () => {
    const accounts = [makeAccount({ current_balance: 5000 })];
    const scenario = makeScenario({ balance_adjustments: { "acc-1": -3000 } });

    const result = applyBalanceAdjustments(accounts, scenario);
    expect(result[0].current_balance).toBe(2000);
  });

  it("leaves accounts without adjustments unchanged", () => {
    const accounts = [
      makeAccount({ id: "acc-1", current_balance: 5000 }),
      makeAccount({ id: "acc-2", current_balance: 10000 }),
    ];
    const scenario = makeScenario({ balance_adjustments: { "acc-1": 1000 } });

    const result = applyBalanceAdjustments(accounts, scenario);
    expect(result[0].current_balance).toBe(6000);
    expect(result[1].current_balance).toBe(10000);
  });

  it("returns original accounts when no adjustments", () => {
    const accounts = [makeAccount()];
    const scenario = makeScenario({ balance_adjustments: null });

    const result = applyBalanceAdjustments(accounts, scenario);
    expect(result[0].current_balance).toBe(5000);
  });
});

describe("scenario projection integration", () => {
  it("excluded event not reflected in projection", () => {
    const accounts = [makeAccount({ current_balance: 5000 })];
    const baseEvents = [makeEvent({ amount: 1000 })];
    const mods = [makeScenarioEvent({ action: "exclude", event_id: "evt-1" })];
    const scenarioEvents = buildScenarioEvents(baseEvents, mods);

    const base = computeProjection(accounts, baseEvents, "2026-01-01", "2026-02-28");
    const scenario = computeProjection(accounts, scenarioEvents, "2026-01-01", "2026-02-28");

    // Base: 5000 - 1000 (Jan) - 1000 (Feb) = 3000
    expect(base.dataPoints[base.dataPoints.length - 1].balance).toBe(3000);
    // Scenario: 5000 (no events)
    expect(scenario.dataPoints[scenario.dataPoints.length - 1].balance).toBe(5000);
  });

  it("modified event amount reflected in projection", () => {
    const accounts = [makeAccount({ current_balance: 5000 })];
    const baseEvents = [makeEvent({ amount: 1000 })];
    const mods = [makeScenarioEvent({ action: "modify", event_id: "evt-1", amount: 1500 })];
    const scenarioEvts = buildScenarioEvents(baseEvents, mods);

    const result = computeProjection(accounts, scenarioEvts, "2026-01-01", "2026-02-28");
    // 5000 - 1500 (Jan) - 1500 (Feb) = 2000
    expect(result.dataPoints[result.dataPoints.length - 1].balance).toBe(2000);
  });

  it("added event reflected in projection", () => {
    const accounts = [makeAccount({ current_balance: 5000 })];
    const baseEvents: CashflowEvent[] = [];
    const mods = [
      makeScenarioEvent({
        action: "add",
        name: "Tuition",
        event_type: "expense",
        amount: 2000,
        event_date: "2026-01-10",
        account_id: "acc-1",
        is_recurring: true,
        recurrence_rule: { frequency: "monthly", interval: 1, day_of_month: 10 },
      }),
    ];
    const scenarioEvts = buildScenarioEvents(baseEvents, mods);

    const result = computeProjection(accounts, scenarioEvts, "2026-01-01", "2026-02-28");
    // 5000 - 2000 (Jan 10) - 2000 (Feb 10) = 1000
    expect(result.dataPoints[result.dataPoints.length - 1].balance).toBe(1000);
  });

  it("balance adjustment changes starting balance", () => {
    const accounts = [makeAccount({ current_balance: 5000 })];
    const scenario = makeScenario({ balance_adjustments: { "acc-1": 100000 } });
    const adjusted = applyBalanceAdjustments(accounts, scenario);

    const result = computeProjection(adjusted, [], "2026-01-01", "2026-01-31");
    expect(result.dataPoints[0].balance).toBe(105000);
  });
});
