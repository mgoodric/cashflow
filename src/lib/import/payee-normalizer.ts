export function normalizePayee(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(inc|llc|co|corp|ltd|pllc|lp)\b\.?/g, "")
    .replace(/^(pos|ach|chk|check|debit|credit)\s*/, "")
    .replace(/\s*#\d+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
