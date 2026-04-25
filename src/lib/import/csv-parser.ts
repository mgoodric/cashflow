import Papa from "papaparse";
import type { AccountType } from "@/lib/types/database";
import type {
  ParsedQifAccount,
  ParsedQifTransaction,
  ParsedQifFile,
} from "./qif-parser";
import { extractCategoriesFromTransactions } from "./category-extractor";

function inferAccountType(name: string): AccountType {
  const lower = name.toLowerCase();
  if (
    lower.includes("card") ||
    lower.includes("credit") ||
    lower.includes("visa") ||
    lower.includes("mastercard") ||
    lower.includes("amex") ||
    lower.includes("discover")
  ) {
    return "credit";
  }
  if (lower.includes("checking")) return "checking";
  if (lower.includes("savings")) return "savings";
  return "checking";
}

function extractAccountName(firstLine: string): string {
  const match = firstLine.match(/^(.+?)\s+Report Created:/);
  return match ? match[1].trim() : "Imported Account";
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, "").trim();
  return parseFloat(cleaned) || 0;
}

/**
 * Parse a Quicken Mac CSV export into the same shape as ParsedQifFile.
 *
 * Format: account name on line 1, metadata lines 2-6, column headers on line 7,
 * then data rows with columns: empty, Scheduled, Split, Date, Payee, Category,
 * Tags, Amount, Balance. Balance/Total rows are skipped.
 */
export function parseCsvContent(content: string): ParsedQifFile {
  const firstNewline = content.indexOf("\n");
  const firstLine = (firstNewline === -1 ? content : content.substring(0, firstNewline)).trim();
  const accountName = extractAccountName(firstLine);
  const accountType = inferAccountType(accountName);

  const account: ParsedQifAccount = {
    name: accountName,
    qifType: "csv",
    suggestedAppType: accountType,
  };

  // Find header row by searching for the Scheduled/Date marker, then slice from there
  const headerMarker = '"Scheduled"';
  const headerPos = content.indexOf(headerMarker);

  if (headerPos === -1) {
    return {
      accounts: [account],
      categories: [],
      transactions: [],
      rawDateStrings: [],
    };
  }

  // Find the start of the line containing the header
  const lineStart = content.lastIndexOf("\n", headerPos);
  const csvContent = content.substring(lineStart === -1 ? 0 : lineStart + 1);

  const parsed = Papa.parse<string[]>(csvContent, {
    header: false,
    skipEmptyLines: false,
  });

  const transactions: ParsedQifTransaction[] = [];
  const rawDateStrings: string[] = [];

  // Skip the first row (header) and process data rows
  for (let i = 1; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (!row || row.length < 8) continue;

    // Skip Balance:, Total, Net Total rows
    const firstCell = (row[0] ?? "").trim();
    if (firstCell.startsWith("Balance:")) continue;
    if (firstCell.startsWith("Total")) continue;
    if (firstCell.startsWith("Net Total")) continue;

    const date = (row[3] ?? "").trim();
    if (!date) continue;

    // Validate date format (M/D/YYYY or MM/DD/YYYY)
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) continue;

    const payee = (row[4] ?? "").trim();
    const category = (row[5] ?? "").trim();
    const tags = (row[6] ?? "").trim();
    const amountRaw = (row[7] ?? "").trim();

    const amountValue = parseAmount(amountRaw);
    const isTransfer = category.startsWith("Transfer:");

    let memo: string | null = null;
    if (tags) {
      memo = `[Tags: ${tags}]`;
    }

    rawDateStrings.push(date);

    transactions.push({
      date,
      amount: Math.abs(amountValue),
      payee: payee || "Unknown",
      category,
      memo,
      checkNumber: null,
      qifAccountName: accountName,
      type: amountValue >= 0 ? "income" : "expense",
      isTransfer,
    });
  }

  const categories = extractCategoriesFromTransactions(transactions);

  return {
    accounts: [account],
    categories,
    transactions,
    rawDateStrings,
  };
}
