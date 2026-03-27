import { describe, it, expect } from "vitest";
import { detectMisclassifications } from "../category-auditor";
import type { Transaction, Category } from "@/lib/types/database";

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    account_id: "acc-1",
    import_session_id: null,
    category_id: "cat-groceries",
    transaction_date: "2025-06-15",
    amount: -50,
    payee: "Kroger",
    payee_normalized: "kroger",
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

const categories: Category[] = [
  { id: "cat-groceries", user_id: "user-1", name: "Groceries", parent_id: null, created_at: "2025-01-01T00:00:00Z" },
  { id: "cat-dining", user_id: "user-1", name: "Dining", parent_id: null, created_at: "2025-01-01T00:00:00Z" },
  { id: "cat-gas", user_id: "user-1", name: "Gas", parent_id: null, created_at: "2025-01-01T00:00:00Z" },
];

describe("detectMisclassifications", () => {
  it("returns empty for no transactions", () => {
    expect(detectMisclassifications([], categories)).toEqual([]);
  });

  it("returns empty when all payees are correctly categorized", () => {
    // All kroger transactions in groceries — consistent, no flags
    const txns = Array.from({ length: 5 }, () => makeTxn());
    expect(detectMisclassifications(txns, categories)).toEqual([]);
  });

  it("flags payee-category mismatch", () => {
    // 4 kroger→groceries, 1 kroger→dining = mismatch
    const txns = [
      ...Array.from({ length: 4 }, () => makeTxn()),
      makeTxn({ category_id: "cat-dining" }),
    ];

    const flags = detectMisclassifications(txns, categories);
    const mismatch = flags.find((f) => f.currentCategoryId === "cat-dining");
    expect(mismatch).toBeDefined();
    expect(mismatch!.reason).toMatch(/payee_mismatch|both/);
    expect(mismatch!.suggestedCategoryId).toBe("cat-groceries");
    expect(mismatch!.suggestedCategoryName).toBe("Groceries");
  });

  it("flags amount outlier", () => {
    // Build enough data in groceries category for stats (need ≥5)
    const normalAmounts = Array.from({ length: 10 }, (_, i) =>
      makeTxn({
        payee: `Store ${i}`,
        payee_normalized: `store${i}`,
        amount: -(40 + Math.random() * 20), // ~40-60 range
      })
    );
    // Add an outlier
    const outlier = makeTxn({
      payee: "Big Purchase",
      payee_normalized: "big purchase",
      amount: -5000,
    });

    const flags = detectMisclassifications([...normalAmounts, outlier], categories);
    const outlierFlag = flags.find((f) => f.payee === "Big Purchase");
    expect(outlierFlag).toBeDefined();
    expect(outlierFlag!.reason).toMatch(/amount_outlier|both/);
    expect(outlierFlag!.amountZScore).toBeGreaterThan(2);
  });

  it("requires minimum 3 transactions per payee for profile", () => {
    // Only 2 kroger transactions — not enough for payee profile
    const txns = [
      makeTxn(),
      makeTxn({ category_id: "cat-dining" }),
    ];
    // No payee mismatch flags because profile needs ≥3
    const flags = detectMisclassifications(txns, categories);
    const payeeFlags = flags.filter((f) => f.reason === "payee_mismatch");
    expect(payeeFlags).toHaveLength(0);
  });

  it("sorts flags by confidence descending", () => {
    const txns = [
      ...Array.from({ length: 8 }, () => makeTxn()),
      makeTxn({ category_id: "cat-dining" }),
      makeTxn({ category_id: "cat-gas" }),
    ];

    const flags = detectMisclassifications(txns, categories);
    for (let i = 1; i < flags.length; i++) {
      expect(flags[i - 1].confidence).toBeGreaterThanOrEqual(flags[i].confidence);
    }
  });

  it("skips transactions without payee or category", () => {
    const txns = [
      makeTxn({ payee_normalized: null }),
      makeTxn({ category_id: null }),
    ];
    expect(detectMisclassifications(txns, categories)).toEqual([]);
  });
});
