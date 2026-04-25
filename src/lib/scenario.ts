import type { Account, CashflowEvent, Scenario, ScenarioEvent } from "./types/database";

/**
 * Apply scenario modifications to the base event list:
 * 1. Remove excluded events
 * 2. Replace modified events with scenario versions
 * 3. Add scenario-only events
 */
export function buildScenarioEvents(
  baseEvents: CashflowEvent[],
  scenarioEvents: ScenarioEvent[]
): CashflowEvent[] {
  const excludedIds = new Set<string>();
  const modifications = new Map<string, ScenarioEvent>();
  const additions: ScenarioEvent[] = [];

  for (const se of scenarioEvents) {
    switch (se.action) {
      case "exclude":
        if (se.event_id) excludedIds.add(se.event_id);
        break;
      case "modify":
        if (se.event_id) modifications.set(se.event_id, se);
        break;
      case "add":
        additions.push(se);
        break;
    }
  }

  // Start with base events, excluding removed ones
  const result: CashflowEvent[] = [];

  for (const event of baseEvents) {
    if (excludedIds.has(event.id)) continue;

    const mod = modifications.get(event.id);
    if (mod) {
      result.push({
        ...event,
        amount: mod.amount ?? event.amount,
        name: mod.name ?? event.name,
        event_type: mod.event_type ?? event.event_type,
        notes: mod.notes !== null ? mod.notes : event.notes,
      });
    } else {
      result.push(event);
    }
  }

  // Add scenario-only events
  for (const se of additions) {
    if (!se.name || !se.event_type || se.amount == null || !se.event_date || !se.account_id) continue;

    result.push({
      id: se.id,
      user_id: "",
      account_id: se.account_id,
      category_id: null,
      name: se.name,
      event_type: se.event_type,
      amount: se.amount,
      event_date: se.event_date,
      is_recurring: se.is_recurring ?? false,
      recurrence_rule: se.recurrence_rule,
      destination_account_id: null,
      loan_config: null,
      actual_amount: null,
      occurred_date: null,
      notes: se.notes,
      is_active: true,
      created_at: se.created_at,
      updated_at: se.created_at,
    });
  }

  return result;
}

/**
 * Apply scenario balance adjustments to accounts.
 * Returns a new array with adjusted starting balances.
 */
export function applyBalanceAdjustments(
  accounts: Account[],
  scenario: Scenario
): Account[] {
  if (!scenario.balance_adjustments) return accounts;

  return accounts.map((account) => {
    const adjustment = scenario.balance_adjustments?.[account.id];
    if (adjustment == null) return account;

    return {
      ...account,
      current_balance: account.current_balance + adjustment,
    };
  });
}
