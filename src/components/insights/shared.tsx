import type { RecurrencePattern } from "@/lib/types/database";

export function ConfidenceDot({ pattern }: { pattern: RecurrencePattern }) {
  if (pattern.isStale) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400"
        title="Possibly ended"
      />
    );
  }
  if (pattern.confidence >= 0.85) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"
        title={`High confidence: ${Math.round(pattern.confidence * 100)}%`}
      />
    );
  }
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500"
      title={`Medium confidence: ${Math.round(pattern.confidence * 100)}%`}
    />
  );
}

export function buildEditQueryParams(pattern: RecurrencePattern): string {
  const params = new URLSearchParams();
  params.set("name", pattern.payee);
  params.set("amount", String(pattern.medianAmount));
  params.set("event_type", pattern.suggestedEventType);
  params.set("is_recurring", "true");
  params.set("frequency", pattern.frequency);
  params.set("day_of_month", String(pattern.suggestedDayOfMonth));
  if (pattern.mostCommonAccountId) {
    params.set("account_id", pattern.mostCommonAccountId);
  }
  return params.toString();
}
