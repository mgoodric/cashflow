import { describe, it, expect } from "vitest";
import { computeLoanPayment } from "../loan";
import { computeProjection } from "../projection";
import type { Account, CashflowEvent, LoanConfig } from "../types/database";

describe("computeLoanPayment", () => {
  it("interest-only: calculates daily interest for 31-day month", () => {
    const config: LoanConfig = { annual_rate: 0.085, loan_type: "interest_only", extra_principal: 0 };
    // January has 31 days
    const result = computeLoanPayment(150000, config, new Date(Date.UTC(2026, 0, 15)));
    // 150000 * 0.085 / 365 * 31 = 1082.19
    expect(result.interest).toBeCloseTo(1082.88, 1);
    expect(result.principal).toBe(0);
    expect(result.totalPayment).toBeCloseTo(1082.88, 0);
    expect(result.newBalance).toBe(150000);
  });

  it("interest-only: calculates daily interest for 28-day month", () => {
    const config: LoanConfig = { annual_rate: 0.085, loan_type: "interest_only", extra_principal: 0 };
    // February 2026 has 28 days
    const result = computeLoanPayment(150000, config, new Date(Date.UTC(2026, 1, 15)));
    // 150000 * 0.085 / 365 * 28 = 978.08
    expect(result.interest).toBeCloseTo(978.08, 1);
    expect(result.newBalance).toBe(150000);
  });

  it("interest-only with extra principal reduces balance", () => {
    const config: LoanConfig = { annual_rate: 0.085, loan_type: "interest_only", extra_principal: 1000 };
    const result = computeLoanPayment(150000, config, new Date(Date.UTC(2026, 0, 15)));
    expect(result.interest).toBeCloseTo(1082.88, 1);
    expect(result.extraPrincipal).toBe(1000);
    expect(result.totalPayment).toBeCloseTo(2082.88, 1);
    expect(result.newBalance).toBe(149000);
  });

  it("balance decreases over multiple months with extra principal", () => {
    const config: LoanConfig = { annual_rate: 0.085, loan_type: "interest_only", extra_principal: 1000 };
    let balance = 150000;

    // January
    const jan = computeLoanPayment(balance, config, new Date(Date.UTC(2026, 0, 15)));
    balance = jan.newBalance;
    expect(balance).toBe(149000);

    // February
    const feb = computeLoanPayment(balance, config, new Date(Date.UTC(2026, 1, 15)));
    balance = feb.newBalance;
    expect(balance).toBe(148000);

    // February interest should be less than January (lower balance + fewer days)
    expect(feb.interest).toBeLessThan(jan.interest);
  });

  it("amortizing: calculates standard P&I payment", () => {
    const config: LoanConfig = { annual_rate: 0.06, loan_type: "amortizing", extra_principal: 0, term_months: 360 };
    const result = computeLoanPayment(300000, config, new Date(Date.UTC(2026, 0, 15)));
    // Monthly rate = 0.005, standard payment ~$1798.65
    expect(result.totalPayment).toBeGreaterThan(1700);
    expect(result.totalPayment).toBeLessThan(1900);
    expect(result.principal).toBeGreaterThan(0);
    expect(result.newBalance).toBeLessThan(300000);
  });

  it("returns zero payment when balance is zero", () => {
    const config: LoanConfig = { annual_rate: 0.085, loan_type: "interest_only", extra_principal: 1000 };
    const result = computeLoanPayment(0, config, new Date(Date.UTC(2026, 0, 15)));
    expect(result.totalPayment).toBe(0);
    expect(result.newBalance).toBe(0);
  });
});

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1", user_id: "user-1", name: "HELOC", account_type: "loan",
    current_balance: -150000, currency: "USD", is_active: true,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeLoanEvent(overrides: Partial<CashflowEvent> = {}): CashflowEvent {
  return {
    id: "evt-loan", user_id: "user-1", account_id: "acc-1", category_id: null,
    name: "HELOC Payment", event_type: "expense", amount: 0,
    event_date: "2026-01-15", is_recurring: true,
    recurrence_rule: { frequency: "monthly", interval: 1, day_of_month: 15 },
    loan_config: { annual_rate: 0.085, loan_type: "interest_only", extra_principal: 1000 },
    destination_account_id: null, actual_amount: null, occurred_date: null,
    notes: null, is_active: true,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("projection with loan events", () => {
  it("loan event produces dynamic payment amounts", () => {
    const accounts = [
      { id: "checking", user_id: "user-1", name: "Checking", account_type: "checking" as const, current_balance: 50000, currency: "USD", is_active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      makeAccount({ current_balance: -150000 }),
    ];
    const events = [makeLoanEvent()];

    const result = computeProjection(accounts, events, "2026-01-01", "2026-03-31");

    // Should have payments on Jan 15, Feb 15, Mar 15
    const paymentDays = result.dataPoints.filter((dp) => dp.events.length > 0);
    expect(paymentDays.length).toBeGreaterThanOrEqual(3);

    // Each payment should be roughly interest + $1000 extra
    const jan = paymentDays.find((dp) => dp.date === "2026-01-15");
    expect(jan).toBeDefined();
    expect(jan!.events[0].amount).toBeGreaterThan(2000); // ~1082 interest + 1000 extra

    // February payment should be slightly different (different days, lower balance)
    const feb = paymentDays.find((dp) => dp.date === "2026-02-15");
    expect(feb).toBeDefined();
    expect(feb!.events[0].amount).not.toBe(jan!.events[0].amount);
  });
});
