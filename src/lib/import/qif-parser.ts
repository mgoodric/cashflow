import { deserializeQif, type QifData, QifType } from "qif-ts";
import type { AccountType } from "@/lib/types/database";
import { extractCategoriesFromTransactions } from "./category-extractor";

export interface ParsedQifAccount {
  name: string;
  qifType: string;
  suggestedAppType: AccountType;
}

export interface ParsedQifCategory {
  path: string;
  name: string;
  parentPath: string | null;
}

export interface ParsedQifTransaction {
  date: string;
  amount: number;
  payee: string;
  category: string;
  memo: string | null;
  checkNumber: string | null;
  qifAccountName: string;
  type: "income" | "expense";
  isTransfer: boolean;
}

export interface ParsedQifFile {
  accounts: ParsedQifAccount[];
  categories: ParsedQifCategory[];
  transactions: ParsedQifTransaction[];
  rawDateStrings: string[];
}

const QIF_TYPE_TO_ACCOUNT_TYPE: Record<string, AccountType> = {
  [QifType.Bank]: "checking",
  [QifType.Card]: "credit",
  [QifType.Asset]: "savings",
  [QifType.Liability]: "loan",
  [QifType.Investment]: "investment",
  [QifType.Cash]: "checking",
};

function extractAccountType(qifType: string): AccountType {
  return QIF_TYPE_TO_ACCOUNT_TYPE[qifType] ?? "checking";
}

export function parseQifContent(content: string): ParsedQifFile {
  // QIF files can contain multiple sections separated by type headers
  // Split by type headers and parse each section
  const sections = content.split(/(?=^!Type:|^!Account)/m).filter(Boolean);

  const accounts: ParsedQifAccount[] = [];
  const allTransactions: ParsedQifTransaction[] = [];
  const rawDateStrings: string[] = [];
  let currentAccountName = "Default";
  let currentAccountType = QifType.Bank as string;

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Check if this is an account header
    if (trimmed.startsWith("!Account")) {
      const lines = trimmed.split("\n");
      for (const line of lines) {
        if (line.startsWith("N")) currentAccountName = line.substring(1).trim();
        if (line.startsWith("T")) currentAccountType = `!Type:${line.substring(1).trim()}`;
      }
      const suggestedType = extractAccountType(currentAccountType);
      if (!accounts.find((a) => a.name === currentAccountName)) {
        accounts.push({
          name: currentAccountName,
          qifType: currentAccountType,
          suggestedAppType: suggestedType,
        });
      }
      continue;
    }

    try {
      const parsed: QifData = deserializeQif(trimmed);

      if (parsed.type && !accounts.find((a) => a.name === currentAccountName)) {
        accounts.push({
          name: currentAccountName,
          qifType: parsed.type,
          suggestedAppType: extractAccountType(parsed.type),
        });
      }

      for (const t of parsed.transactions) {
        if (t.date) rawDateStrings.push(t.date);

        const amount = t.amount ?? 0;
        const category = t.category ?? "";
        const isTransfer = category.startsWith("[") && category.endsWith("]");

        allTransactions.push({
          date: t.date ?? "",
          amount: Math.abs(amount),
          payee: t.payee ?? t.memo ?? "Unknown",
          category,
          memo: t.memo ?? null,
          checkNumber: t.reference ?? null,
          qifAccountName: currentAccountName,
          type: amount >= 0 ? "income" : "expense",
          isTransfer,
        });
      }
    } catch {
      // Skip unparseable sections (e.g., memorized transactions, classes)
      continue;
    }
  }

  // If no accounts were explicitly declared, create a default one
  if (accounts.length === 0) {
    accounts.push({
      name: "Imported Account",
      qifType: QifType.Bank,
      suggestedAppType: "checking",
    });
  }

  const categories = extractCategoriesFromTransactions(allTransactions);

  return {
    accounts,
    categories,
    transactions: allTransactions,
    rawDateStrings,
  };
}
