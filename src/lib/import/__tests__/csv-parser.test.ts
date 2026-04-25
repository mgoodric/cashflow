import { describe, it, expect } from "vitest";
import { parseCsvContent } from "../csv-parser";

const SAMPLE_CSV = `Delta SkyMiles® Reserve Card Report Created: 2026-04-25 09:39:02 -0700
,
Filter Criteria:,All Dates
,Any Type
,Any Status
,
,"Scheduled","Split","Date","Payee","Category","Tags","Amount","Balance"
Balance:,,,,,,,,  38239.26
,,,"12/28/2026","FLODESK.COM CLAYMONT DE XXXX1016","Business Expenses:Shelf Indulgences","","-41.50","38,239.26"
,,,"12/28/2026","USAA","Auto & Transport:Auto Insurance","","-254.56","38,280.76"
,,,"12/15/2026","Credit Card Payment","Transfer:[Joint BECU Checking]","","8,000.00","38,785.32"
,,,"4/20/2026","OBSIDIAN","Shopping:Electronics & Software:SaaS","Annual","-52.42","-22,889.55"
Balance:,,,,,,,,      0.00
,
Total Inflows:,,,,,,, 237975.94
Total Outflows:,,,,,,,-199736.68
Net Total:,,,,,,,,  38239.26
`;

describe("parseCsvContent", () => {
  it("extracts account name from line 1", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].name).toBe("Delta SkyMiles® Reserve Card");
  });

  it("suggests credit account type for card-like names", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    expect(result.accounts[0].suggestedAppType).toBe("credit");
  });

  it("suggests checking account type for checking-like names", () => {
    const csv = SAMPLE_CSV.replace(
      "Delta SkyMiles® Reserve Card",
      "Joint BECU Checking"
    );
    const result = parseCsvContent(csv);
    expect(result.accounts[0].suggestedAppType).toBe("checking");
  });

  it("suggests savings account type for savings-like names", () => {
    const csv = SAMPLE_CSV.replace(
      "Delta SkyMiles® Reserve Card",
      "High Yield Savings"
    );
    const result = parseCsvContent(csv);
    expect(result.accounts[0].suggestedAppType).toBe("savings");
  });

  it("defaults to checking for unrecognized account names", () => {
    const csv = SAMPLE_CSV.replace(
      "Delta SkyMiles® Reserve Card",
      "My Brokerage"
    );
    const result = parseCsvContent(csv);
    expect(result.accounts[0].suggestedAppType).toBe("checking");
  });

  it("skips metadata, balance, and total rows", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    expect(result.transactions).toHaveLength(4);
  });

  it("parses standard transaction rows correctly", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    const tx = result.transactions[0];
    expect(tx.date).toBe("12/28/2026");
    expect(tx.payee).toBe("FLODESK.COM CLAYMONT DE XXXX1016");
    expect(tx.category).toBe("Business Expenses:Shelf Indulgences");
    expect(tx.amount).toBe(41.5);
    expect(tx.type).toBe("expense");
    expect(tx.qifAccountName).toBe("Delta SkyMiles® Reserve Card");
  });

  it("parses comma-formatted positive amounts correctly", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    const creditPayment = result.transactions[2];
    expect(creditPayment.amount).toBe(8000);
    expect(creditPayment.type).toBe("income");
  });

  it("parses comma-formatted negative amounts correctly", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    const obsidian = result.transactions[3];
    expect(obsidian.amount).toBe(52.42);
    expect(obsidian.type).toBe("expense");
  });

  it("determines income vs expense by amount sign", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    // Negative amounts are expenses
    expect(result.transactions[0].type).toBe("expense");
    expect(result.transactions[1].type).toBe("expense");
    // Positive amounts are income
    expect(result.transactions[2].type).toBe("income");
    // Negative again
    expect(result.transactions[3].type).toBe("expense");
  });

  it("detects transfers from category prefix", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    const transfer = result.transactions[2];
    expect(transfer.isTransfer).toBe(true);
    expect(transfer.category).toBe("Transfer:[Joint BECU Checking]");
  });

  it("marks non-transfer transactions correctly", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    expect(result.transactions[0].isTransfer).toBe(false);
    expect(result.transactions[1].isTransfer).toBe(false);
    expect(result.transactions[3].isTransfer).toBe(false);
  });

  it("stores tags in memo field when present", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    const obsidian = result.transactions[3];
    expect(obsidian.memo).toBe("[Tags: Annual]");
  });

  it("sets memo to null when tags are empty", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    expect(result.transactions[0].memo).toBeNull();
    expect(result.transactions[1].memo).toBeNull();
  });

  it("builds category tree from colon-separated paths", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    const categoryPaths = result.categories.map((c) => c.path);

    // Parent categories should be included
    expect(categoryPaths).toContain("Business Expenses");
    expect(categoryPaths).toContain("Business Expenses:Shelf Indulgences");
    expect(categoryPaths).toContain("Auto & Transport");
    expect(categoryPaths).toContain("Auto & Transport:Auto Insurance");
    expect(categoryPaths).toContain("Shopping");
    expect(categoryPaths).toContain("Shopping:Electronics & Software");
    expect(categoryPaths).toContain(
      "Shopping:Electronics & Software:SaaS"
    );
  });

  it("sets parentPath correctly for nested categories", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    const saas = result.categories.find(
      (c) => c.path === "Shopping:Electronics & Software:SaaS"
    );
    expect(saas?.parentPath).toBe("Shopping:Electronics & Software");
    expect(saas?.name).toBe("SaaS");

    const topLevel = result.categories.find((c) => c.path === "Shopping");
    expect(topLevel?.parentPath).toBeNull();
    expect(topLevel?.name).toBe("Shopping");
  });

  it("excludes transfer categories from category tree", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    const categoryPaths = result.categories.map((c) => c.path);
    expect(categoryPaths).not.toContain("Transfer:[Joint BECU Checking]");
  });

  it("collects raw date strings", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    expect(result.rawDateStrings).toEqual([
      "12/28/2026",
      "12/28/2026",
      "12/15/2026",
      "4/20/2026",
    ]);
  });

  it("sets checkNumber to null for all CSV transactions", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    for (const tx of result.transactions) {
      expect(tx.checkNumber).toBeNull();
    }
  });

  it("sets qifType to csv on the account", () => {
    const result = parseCsvContent(SAMPLE_CSV);
    expect(result.accounts[0].qifType).toBe("csv");
  });

  it("handles CSV with no data rows", () => {
    const emptyCSV = `My Account Report Created: 2026-01-01 00:00:00 -0700
,
Filter Criteria:,All Dates
,Any Type
,Any Status
,
,"Scheduled","Split","Date","Payee","Category","Tags","Amount","Balance"
Balance:,,,,,,,,  0.00
Balance:,,,,,,,,  0.00
,
Total Inflows:,,,,,,, 0.00
Total Outflows:,,,,,,, 0.00
Net Total:,,,,,,,,  0.00
`;
    const result = parseCsvContent(emptyCSV);
    expect(result.transactions).toHaveLength(0);
    expect(result.categories).toHaveLength(0);
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].name).toBe("My Account");
  });
});
