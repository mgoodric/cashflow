"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  createOverride,
  updateOverride,
  deleteOverride,
  changeAmountForward,
} from "@/actions/events";
import type {
  CashflowEvent,
  EventOverride,
  RecurrenceRule,
} from "@/lib/types/database";

interface EventOverridesProps {
  event: CashflowEvent;
  overrides: EventOverride[];
}

interface Occurrence {
  date: string;
  override: EventOverride | null;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function clampDay(year: number, month: number, day: number): number {
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Math.min(day, maxDay);
}

function getNextOccurrence(current: Date, rule: RecurrenceRule): Date | null {
  const endDate = rule.end_date
    ? new Date(rule.end_date + "T00:00:00Z")
    : null;

  let next: Date;

  switch (rule.frequency) {
    case "daily":
      next = addDays(current, rule.interval);
      break;
    case "weekly":
      next = addDays(current, 7 * rule.interval);
      break;
    case "biweekly":
      next = addDays(current, 14 * rule.interval);
      break;
    case "monthly": {
      const m = current.getUTCMonth() + rule.interval;
      const year = current.getUTCFullYear() + Math.floor(m / 12);
      const month = m % 12;
      const day = rule.day_of_month ?? current.getUTCDate();
      next = new Date(Date.UTC(year, month, clampDay(year, month, day)));
      break;
    }
    case "quarterly": {
      const qm = current.getUTCMonth() + 3 * rule.interval;
      const qYear = current.getUTCFullYear() + Math.floor(qm / 12);
      const qMonth = qm % 12;
      const qDay = rule.day_of_month ?? current.getUTCDate();
      next = new Date(
        Date.UTC(qYear, qMonth, clampDay(qYear, qMonth, qDay))
      );
      break;
    }
    case "yearly": {
      const yYear = current.getUTCFullYear() + rule.interval;
      const yMonth = current.getUTCMonth();
      const yDay = current.getUTCDate();
      next = new Date(
        Date.UTC(yYear, yMonth, clampDay(yYear, yMonth, yDay))
      );
      break;
    }
    default:
      return null;
  }

  if (endDate && next > endDate) return null;
  return next;
}

function computeUpcomingOccurrences(
  event: CashflowEvent,
  overrides: EventOverride[],
  count: number
): Occurrence[] {
  const rule = event.recurrence_rule;
  if (!rule) return [];

  const overrideMap = new Map<string, EventOverride>();
  for (const o of overrides) {
    overrideMap.set(o.original_date, o);
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const occurrences: Occurrence[] = [];

  let current = new Date(event.event_date + "T00:00:00Z");

  // Walk forward from the event start to find occurrences at or after today
  // First, advance past dates to get near today
  while (current.toISOString().split("T")[0] < todayStr) {
    const next = getNextOccurrence(current, rule);
    if (!next) break;
    current = next;
  }

  // If the current date is before today (no more occurrences), check if it's the last one
  const currentStr = current.toISOString().split("T")[0];
  if (currentStr >= todayStr) {
    occurrences.push({
      date: currentStr,
      override: overrideMap.get(currentStr) ?? null,
    });
  }

  // Get remaining occurrences
  while (occurrences.length < count) {
    const next = getNextOccurrence(current, rule);
    if (!next) break;
    current = next;
    const dateStr = current.toISOString().split("T")[0];
    occurrences.push({
      date: dateStr,
      override: overrideMap.get(dateStr) ?? null,
    });
  }

  return occurrences.slice(0, count);
}

export function EventOverrides({ event, overrides }: EventOverridesProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [showChangeAmount, setShowChangeAmount] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Override form state
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formSkipped, setFormSkipped] = useState(false);
  const [formNotes, setFormNotes] = useState("");

  // Change amount form state
  const [changeAmount, setChangeAmount] = useState("");
  const [changeEffectiveDate, setChangeEffectiveDate] = useState("");

  const occurrences = useMemo(
    () => computeUpcomingOccurrences(event, overrides, 12),
    [event, overrides]
  );

  const isIncome = event.event_type === "income";
  const amountColorClass = isIncome ? "text-green-600" : "text-red-600";

  function openEditForm(occurrence: Occurrence) {
    const currentAmount =
      occurrence.override?.override_amount ?? event.amount;
    const currentDate = occurrence.override?.override_date ?? occurrence.date;

    setFormAmount(String(currentAmount));
    setFormDate(currentDate);
    setFormSkipped(occurrence.override?.is_skipped ?? false);
    setFormNotes(occurrence.override?.notes ?? "");
    setEditingDate(occurrence.date);
  }

  function closeEditForm() {
    setEditingDate(null);
  }

  function handleSaveOverride(occurrence: Occurrence) {
    startTransition(async () => {
      const amount = parseFloat(formAmount);
      if (isNaN(amount)) return;

      if (occurrence.override) {
        await updateOverride(occurrence.override.id, {
          overrideAmount: amount,
          overrideDate: formDate !== occurrence.date ? formDate : null,
          isSkipped: formSkipped,
          notes: formNotes || null,
        });
      } else {
        await createOverride({
          eventId: event.id,
          originalDate: occurrence.date,
          overrideAmount: amount !== event.amount ? amount : undefined,
          overrideDate:
            formDate !== occurrence.date ? formDate : undefined,
          isSkipped: formSkipped,
          notes: formNotes || undefined,
        });
      }

      setEditingDate(null);
      router.refresh();
    });
  }

  function handleDeleteOverride(overrideId: string) {
    startTransition(async () => {
      await deleteOverride(overrideId);
      setEditingDate(null);
      router.refresh();
    });
  }

  function handleChangeAmountForward() {
    startTransition(async () => {
      const amount = parseFloat(changeAmount);
      if (isNaN(amount) || !changeEffectiveDate) return;

      await changeAmountForward({
        eventId: event.id,
        effectiveDate: changeEffectiveDate,
        newAmount: amount,
      });

      setShowChangeAmount(false);
      setChangeAmount("");
      setChangeEffectiveDate("");
      setSuccessMessage(
        `Amount will change to ${formatCurrency(amount)} starting ${formatDate(changeEffectiveDate)}`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      router.refresh();
    });
  }

  if (!event.is_recurring || !event.recurrence_rule) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upcoming Occurrences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {occurrences.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No upcoming occurrences found.
            </p>
          )}
          {occurrences.map((occurrence) => {
            const override = occurrence.override;
            const displayAmount =
              override?.override_amount ?? event.amount;
            const isSkipped = override?.is_skipped ?? false;
            const isModified = override != null && !isSkipped;
            const isEditing = editingDate === occurrence.date;

            return (
              <div key={occurrence.date}>
                <div className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium w-32">
                      {formatDate(occurrence.date)}
                    </span>
                    <span
                      className={`text-sm font-mono ${
                        isSkipped
                          ? "line-through text-muted-foreground"
                          : amountColorClass
                      }`}
                    >
                      {formatCurrency(displayAmount)}
                    </span>
                    {isSkipped && (
                      <Badge variant="secondary">Skipped</Badge>
                    )}
                    {isModified && (
                      <Badge variant="outline">Modified</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      isEditing
                        ? closeEditForm()
                        : openEditForm(occurrence)
                    }
                    disabled={isPending}
                  >
                    {isEditing ? "Close" : "Override"}
                  </Button>
                </div>

                {isEditing && (
                  <div className="ml-2 mr-2 mb-2 p-3 border rounded-md bg-muted/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="override-amount" className="text-xs">
                          Amount
                        </Label>
                        <Input
                          id="override-amount"
                          type="number"
                          step="0.01"
                          value={formAmount}
                          onChange={(e) => setFormAmount(e.target.value)}
                          disabled={isPending}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="override-date" className="text-xs">
                          Date
                        </Label>
                        <Input
                          id="override-date"
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          disabled={isPending}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="override-skip"
                        type="checkbox"
                        checked={formSkipped}
                        onChange={(e) => setFormSkipped(e.target.checked)}
                        disabled={isPending}
                        className="rounded border-input"
                      />
                      <Label htmlFor="override-skip" className="text-xs">
                        Skip this occurrence
                      </Label>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="override-notes" className="text-xs">
                        Notes (optional)
                      </Label>
                      <Textarea
                        id="override-notes"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        rows={2}
                        disabled={isPending}
                        className="text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveOverride(occurrence)}
                        disabled={isPending}
                      >
                        {isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={closeEditForm}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                      {override && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleDeleteOverride(override.id)
                          }
                          disabled={isPending}
                        >
                          Restore Default
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Change Amount From...</CardTitle>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-3 p-2 rounded bg-green-50 text-green-700 text-sm border border-green-200">
              {successMessage}
            </div>
          )}

          {!showChangeAmount ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setChangeAmount(String(event.amount));
                setChangeEffectiveDate(
                  occurrences[0]?.date ??
                    new Date().toISOString().split("T")[0]
                );
                setShowChangeAmount(true);
              }}
              disabled={isPending}
            >
              Change Amount From...
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                This will end the current recurring event and create a new one
                with the updated amount starting from the effective date.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="change-amount" className="text-xs">
                    New Amount
                  </Label>
                  <Input
                    id="change-amount"
                    type="number"
                    step="0.01"
                    value={changeAmount}
                    onChange={(e) => setChangeAmount(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="change-effective-date" className="text-xs">
                    Effective Date
                  </Label>
                  <Input
                    id="change-effective-date"
                    type="date"
                    value={changeEffectiveDate}
                    onChange={(e) =>
                      setChangeEffectiveDate(e.target.value)
                    }
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleChangeAmountForward}
                  disabled={isPending}
                >
                  {isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChangeAmount(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
