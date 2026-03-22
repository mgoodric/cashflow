export type DateFormat = "MM/DD/YY" | "DD/MM/YY" | "MM/DD/YYYY" | "DD/MM/YYYY";

interface DateFormatResult {
  format: DateFormat | null;
  isAmbiguous: boolean;
  candidates: DateFormat[];
  sampleDates: string[];
}

function tryParse(dateStr: string, format: DateFormat): Date | null {
  // QIF dates can use / or - or . as separators, and ' for shortened years
  const cleaned = dateStr.replace(/['-]/g, "/").replace(/\s+/g, "");
  const parts = cleaned.split("/");
  if (parts.length !== 3) return null;

  let month: number, day: number, year: number;

  if (format === "MM/DD/YY" || format === "MM/DD/YYYY") {
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  // Handle 2-digit years
  if (year < 100) {
    year += year < 50 ? 2000 : 1900;
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Check day is valid for the month
  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() !== month - 1 ||
    testDate.getUTCDate() !== day
  ) {
    return null;
  }

  return testDate;
}

export function detectDateFormat(dateStrings: string[]): DateFormatResult {
  const samples = dateStrings.slice(0, 5);
  const formats: DateFormat[] = ["MM/DD/YY", "DD/MM/YY", "MM/DD/YYYY", "DD/MM/YYYY"];
  const validFormats: DateFormat[] = [];

  for (const format of formats) {
    const allValid = dateStrings.every((ds) => tryParse(ds, format) !== null);
    if (allValid) {
      validFormats.push(format);
    }
  }

  // Consolidate: if both MM/DD/YY and MM/DD/YYYY work, prefer the one matching the input
  const hasShortYear = dateStrings.some((ds) => {
    const parts = ds.replace(/['-]/g, "/").split("/");
    return parts.length === 3 && parts[2].length <= 2;
  });

  const candidates = validFormats.filter((f) => {
    if (hasShortYear) return f.endsWith("YY") && !f.endsWith("YYYY");
    return f.endsWith("YYYY");
  });

  // If filtering didn't help, use all valid formats
  const finalCandidates = candidates.length > 0 ? candidates : validFormats;

  return {
    format: finalCandidates.length === 1 ? finalCandidates[0] : null,
    isAmbiguous: finalCandidates.length > 1,
    candidates: finalCandidates,
    sampleDates: samples,
  };
}

export function parseDate(dateStr: string, format: DateFormat): string {
  const date = tryParse(dateStr, format);
  if (!date) {
    throw new Error(`Invalid date "${dateStr}" for format ${format}`);
  }
  return date.toISOString().split("T")[0];
}
