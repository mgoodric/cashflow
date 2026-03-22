"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FREQUENCY_LABELS, SELECT_CLASS } from "@/lib/constants";
import type { RecurrenceRule } from "@/lib/types/database";

interface RecurrenceFieldsProps {
  rule: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
}

const frequencies = (Object.entries(FREQUENCY_LABELS) as [RecurrenceRule["frequency"], string][]).map(
  ([value, label]) => ({ value, label })
);

export function RecurrenceFields({ rule, onChange }: RecurrenceFieldsProps) {
  return (
    <div className="space-y-4 rounded-md border p-4">
      <h4 className="text-sm font-medium">Recurrence Settings</h4>

      <div className="space-y-2">
        <Label htmlFor="frequency">Frequency</Label>
        <select
          id="frequency"
          value={rule.frequency}
          onChange={(e) => onChange({ ...rule, frequency: e.target.value as RecurrenceRule["frequency"] })}
          className={SELECT_CLASS}
        >
          {frequencies.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="interval">Every N occurrences</Label>
        <Input
          id="interval"
          type="number"
          min={1}
          value={rule.interval}
          onChange={(e) => onChange({ ...rule, interval: parseInt(e.target.value) || 1 })}
        />
      </div>

      {(rule.frequency === "monthly" || rule.frequency === "quarterly") && (
        <div className="space-y-2">
          <Label htmlFor="day_of_month">Day of Month</Label>
          <Input
            id="day_of_month"
            type="number"
            min={1}
            max={31}
            value={rule.day_of_month ?? ""}
            onChange={(e) => onChange({ ...rule, day_of_month: parseInt(e.target.value) || undefined })}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="end_date">End Date (optional)</Label>
        <Input
          id="end_date"
          type="date"
          value={rule.end_date ?? ""}
          onChange={(e) => onChange({ ...rule, end_date: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
