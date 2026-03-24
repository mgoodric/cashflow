import { describe, it, expect } from "vitest";
import { normalizePayee } from "../payee-normalizer";

describe("normalizePayee", () => {
  it("lowercases input", () => {
    expect(normalizePayee("AMAZON")).toBe("amazon");
  });

  it("strips company suffixes", () => {
    expect(normalizePayee("Apple Inc")).toBe("apple");
    expect(normalizePayee("Google LLC")).toBe("google");
    expect(normalizePayee("Acme Corp")).toBe("acme");
    expect(normalizePayee("Widget Co")).toBe("widget");
    expect(normalizePayee("Smith Ltd")).toBe("smith");
  });

  it("strips suffixes with trailing period", () => {
    expect(normalizePayee("Apple Inc.")).toBe("apple");
  });

  it("strips payment prefixes", () => {
    expect(normalizePayee("POS Target")).toBe("target");
    expect(normalizePayee("ACH Payroll")).toBe("payroll");
    expect(normalizePayee("CHK 1234")).toBe("1234");
    expect(normalizePayee("DEBIT Amazon")).toBe("amazon");
    expect(normalizePayee("CREDIT Refund")).toBe("refund");
  });

  it("strips trailing reference numbers", () => {
    expect(normalizePayee("Starbucks #12345")).toBe("starbucks");
    expect(normalizePayee("McDonalds #789")).toBe("mcdonalds");
  });

  it("collapses whitespace", () => {
    expect(normalizePayee("  Some   Store  ")).toBe("some store");
  });

  it("handles combined transformations", () => {
    expect(normalizePayee("POS STARBUCKS INC. #4532")).toBe("starbucks");
  });

  it("handles empty string", () => {
    expect(normalizePayee("")).toBe("");
  });
});
