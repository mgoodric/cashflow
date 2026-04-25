import type { Transaction } from "@/lib/types/database";
import type { ParsedQifTransaction } from "@/lib/import/qif-parser";
import { normalizePayee } from "@/lib/import/payee-normalizer";
import { detectDateFormat, parseDate } from "@/lib/import/date-detector";

export function bridgeCsvToTransactions(
  parsed: ParsedQifTransaction[]
): Transaction[] {
  // Detect date format from raw dates
  const rawDates = parsed.map((t) => t.date);
  const detection = detectDateFormat(rawDates);
  const dateFormat = detection.format ?? "MM/DD/YYYY";

  return parsed
    .filter((t) => !t.isTransfer)
    .map((t, i) => {
      let isoDate: string;
      try {
        isoDate = parseDate(t.date, dateFormat);
      } catch {
        isoDate = t.date;
      }

      return {
        id: `csv-${i}`,
        user_id: "",
        account_id: t.qifAccountName,
        import_session_id: null,
        category_id: t.category || null,
        transaction_date: isoDate,
        amount: t.type === "expense" ? -t.amount : t.amount,
        payee: t.payee,
        payee_normalized: normalizePayee(t.payee),
        memo: t.memo,
        check_number: t.checkNumber,
        transaction_type: t.type,
        source: "csv-analysis",
        event_id: null,
        suggested_event_id: null,
        is_cleared: false,
        original_category: t.category || null,
        is_flagged: false,
        flag_reason: null,
        created_at: new Date().toISOString(),
      };
    });
}
