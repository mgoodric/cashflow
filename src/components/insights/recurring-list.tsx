"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { RecurrencePattern } from "@/lib/types/database";
import { createEventFromPattern } from "@/actions/insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ConfidenceDot, buildEditQueryParams } from "./shared";

function PatternCard({
  pattern,
  onDismiss,
  onAdded,
}: {
  pattern: RecurrencePattern;
  onDismiss: (payee: string) => void;
  onAdded: (payee: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showAmountRange =
    pattern.amountRange.min !== pattern.amountRange.max;

  function handleAddAsEvent() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await createEventFromPattern(pattern);
        setSuccessMessage("Event created successfully");
        setTimeout(() => onAdded(pattern.payeeNormalized), 1500);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to create event"
        );
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <ConfidenceDot pattern={pattern} />
              <span className="truncate font-medium">{pattern.payee}</span>
              <Badge variant="secondary">{pattern.frequency}</Badge>
              <Badge
                variant={
                  pattern.suggestedEventType === "income"
                    ? "default"
                    : "outline"
                }
              >
                {pattern.suggestedEventType}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
              <span>
                Median: {formatCurrency(pattern.medianAmount)}
              </span>
              {showAmountRange && (
                <span>
                  Range: {formatCurrency(pattern.amountRange.min)} -{" "}
                  {formatCurrency(pattern.amountRange.max)}
                </span>
              )}
              <span>{pattern.occurrenceCount} occurrences</span>
              <span>Last: {formatDate(pattern.lastOccurrence)}</span>
              <span>Day of month: {pattern.suggestedDayOfMonth}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={handleAddAsEvent}
              disabled={isPending || successMessage !== null}
            >
              {isPending ? "Adding..." : "Add as Event"}
            </Button>
            <Link
              href={`/events/new?${buildEditQueryParams(pattern)}`}
            >
              <Button variant="outline" size="sm">
                Edit & Add
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(pattern.payeeNormalized)}
            >
              Dismiss
            </Button>
          </div>
        </div>

        {successMessage && (
          <p className="mt-2 text-sm text-green-600">{successMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}

function PatternSection({
  title,
  patterns,
  onDismiss,
  onAdded,
}: {
  title: string;
  patterns: RecurrencePattern[];
  onDismiss: (payee: string) => void;
  onAdded: (payee: string) => void;
}) {
  if (patterns.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {patterns.map((pattern) => (
        <PatternCard
          key={pattern.payeeNormalized}
          pattern={pattern}
          onDismiss={onDismiss}
          onAdded={onAdded}
        />
      ))}
    </div>
  );
}

export function RecurringList({
  patterns: initialPatterns,
}: {
  patterns: RecurrencePattern[];
}) {
  const [patterns, setPatterns] = useState(initialPatterns);

  function removePattern(payeeNormalized: string) {
    setPatterns((prev) =>
      prev.filter((p) => p.payeeNormalized !== payeeNormalized)
    );
  }

  const highConfidence = patterns.filter(
    (p) => !p.isStale && p.confidence >= 0.85
  );
  const mediumConfidence = patterns.filter(
    (p) => !p.isStale && p.confidence >= 0.6 && p.confidence < 0.85
  );
  const stale = patterns.filter((p) => p.isStale);

  if (patterns.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-500">
            No recurring patterns detected. Import more transactions to improve detection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {patterns.length} pattern{patterns.length !== 1 ? "s" : ""} detected
          </CardTitle>
        </CardHeader>
      </Card>

      <PatternSection
        title="High Confidence"
        patterns={highConfidence}
        onDismiss={removePattern}
        onAdded={removePattern}
      />

      <PatternSection
        title="Medium Confidence"
        patterns={mediumConfidence}
        onDismiss={removePattern}
        onAdded={removePattern}
      />

      <PatternSection
        title="Possibly Ended"
        patterns={stale}
        onDismiss={removePattern}
        onAdded={removePattern}
      />
    </div>
  );
}
