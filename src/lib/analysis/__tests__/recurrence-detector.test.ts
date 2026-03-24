import { describe, it, expect } from "vitest";
import { detectRecurringPatterns } from "../recurrence-detector";
import type { Transaction } from "@/lib/types/database";

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    account_id: "acc-1",
    import_session_id: null,
    category_id: "cat-1",
    transaction_date: "2025-01-15",
    amount: -50,
    payee: "Netflix",
    payee_normalized: "netflix",
    memo: null,
    check_number: null,
    transaction_type: "expense",
    source: "qif",
    event_id: null,
    suggested_event_id: null,
    is_cleared: false,
    original_category: null,
    is_flagged: false,
    flag_reason: null,
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function monthlyDates(startMonth: number, count: number, day: number = 15): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const month = startMonth + i;
    const year = 2025 + Math.floor((month - 1) / 12);
    const m = ((month - 1) % 12) + 1;
    dates.push(`${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

describe("detectRecurringPatterns", () => {
  it("returns empty for no transactions", () => {
    expect(detectRecurringPatterns([])).toEqual([]);
  });

  it("returns empty for single transaction", () => {
    expect(detectRecurringPatterns([makeTxn()])).toEqual([]);
  });

  it("detects monthly pattern from consistent transactions", () => {
    const dates = monthlyDates(1, 6);
    const txns = dates.map((d) =>
      makeTxn({ transaction_date: d, payee_normalized: "netflix", amount: -15.99 })
    );

    const patterns = detectRecurringPatterns(txns);
    expect(patterns.length).toBeGreaterThanOrEqual(1);

    const netflix = patterns.find((p) => p.payeeNormalized === "netflix");
    expect(netflix).toBeDefined();
    expect(netflix!.frequency).toBe("monthly");
    expect(netflix!.confidence).toBeGreaterThan(0.6);
    expect(netflix!.occurrenceCount).toBe(6);
    expect(netflix!.medianAmount).toBeCloseTo(15.99);
  });

  it("detects quarterly pattern", () => {
    const dates = ["2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15"];
    const txns = dates.map((d) =>
      makeTxn({ transaction_date: d, payee_normalized: "insurance", amount: -300 })
    );

    const patterns = detectRecurringPatterns(txns);
    const insurance = patterns.find((p) => p.payeeNormalized === "insurance");
    expect(insurance).toBeDefined();
    expect(insurance!.frequency).toBe("quarterly");
  });

  it("detects yearly pattern", () => {
    const dates = ["2023-03-01", "2024-03-01", "2025-03-01"];
    const txns = dates.map((d) =>
      makeTxn({ transaction_date: d, payee_normalized: "amazon prime", amount: -139 })
    );

    const patterns = detectRecurringPatterns(txns);
    const prime = patterns.find((p) => p.payeeNormalized === "amazon prime");
    expect(prime).toBeDefined();
    expect(prime!.frequency).toBe("yearly");
  });

  it("rejects irregular intervals", () => {
    const dates = ["2025-01-01", "2025-01-20", "2025-03-10", "2025-05-25"];
    const txns = dates.map((d) =>
      makeTxn({ transaction_date: d, payee_normalized: "random store", amount: -42 })
    );

    const patterns = detectRecurringPatterns(txns);
    const random = patterns.find((p) => p.payeeNormalized === "random store");
    expect(random).toBeUndefined();
  });

  it("groups transactions by normalized payee", () => {
    const dates = monthlyDates(1, 4);
    const txns = [
      ...dates.map((d) => makeTxn({ transaction_date: d, payee_normalized: "netflix", amount: -15 })),
      ...dates.map((d) => makeTxn({ transaction_date: d, payee_normalized: "spotify", amount: -10 })),
    ];

    const patterns = detectRecurringPatterns(txns);
    expect(patterns.filter((p) => p.payeeNormalized === "netflix")).toHaveLength(1);
    expect(patterns.filter((p) => p.payeeNormalized === "spotify")).toHaveLength(1);
  });

  it("sorts patterns by confidence descending", () => {
    const dates = monthlyDates(1, 6);
    const txns = [
      ...dates.map((d) => makeTxn({ transaction_date: d, payee_normalized: "netflix", amount: -15 })),
      ...dates.map((d) => makeTxn({ transaction_date: d, payee_normalized: "gym", amount: -50 })),
    ];

    const patterns = detectRecurringPatterns(txns);
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(patterns[i].confidence);
    }
  });

  it("suggests correct day of month", () => {
    const dates = monthlyDates(1, 5, 20);
    const txns = dates.map((d) =>
      makeTxn({ transaction_date: d, payee_normalized: "rent", amount: -1500 })
    );

    const patterns = detectRecurringPatterns(txns);
    const rent = patterns.find((p) => p.payeeNormalized === "rent");
    expect(rent!.suggestedDayOfMonth).toBe(20);
  });

  it("identifies most common event type", () => {
    const dates = monthlyDates(1, 4);
    const txns = dates.map((d) =>
      makeTxn({ transaction_date: d, payee_normalized: "paycheck", amount: 3000, transaction_type: "income" })
    );

    const patterns = detectRecurringPatterns(txns);
    const paycheck = patterns.find((p) => p.payeeNormalized === "paycheck");
    expect(paycheck!.suggestedEventType).toBe("income");
  });
});
