"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import type { CashflowEvent, RecurrencePattern } from "@/lib/types/database";
import { parseCsvContent } from "@/lib/import/csv-parser";
import { bridgeCsvToTransactions } from "@/lib/analysis/csv-bridge";
import { detectRecurringPatterns } from "@/lib/analysis/recurrence-detector";
import { normalizePayee } from "@/lib/import/payee-normalizer";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceDot, buildEditQueryParams } from "./shared";

interface CsvAnalyzerProps {
  existingEvents: CashflowEvent[];
}

interface AnalysisResult {
  totalTransactions: number;
  fileCount: number;
  allPatterns: RecurrencePattern[];
  newPatterns: RecurrencePattern[];
  trackedPatterns: { pattern: RecurrencePattern; matchedEventName: string }[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

const MIN_MATCH_LENGTH = 4;

function matchPatternToEvent(
  pattern: RecurrencePattern,
  normalizedEventNames: Map<string, string>
): string | null {
  if (pattern.payeeNormalized.length < MIN_MATCH_LENGTH) return null;

  for (const [normalized, originalName] of normalizedEventNames) {
    if (normalized.length < MIN_MATCH_LENGTH) continue;
    if (
      normalized.includes(pattern.payeeNormalized) ||
      pattern.payeeNormalized.includes(normalized)
    ) {
      return originalName;
    }
  }
  return null;
}

export function CsvAnalyzer({ existingEvents }: CsvAnalyzerProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dismissedPayees, setDismissedPayees] = useState<Set<string>>(new Set());
  const [trackedCollapsed, setTrackedCollapsed] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const valid: File[] = [];
    const errors: string[] = [];

    for (const file of Array.from(incoming)) {
      if (!file.name.endsWith(".csv")) {
        errors.push(`${file.name}: not a CSV file`);
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 10MB limit`);
      } else {
        valid.push(file);
      }
    }

    if (errors.length > 0) {
      setError(errors.join(". "));
    } else {
      setError(null);
    }

    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  async function handleAnalyze() {
    if (files.length === 0) return;

    setAnalyzing(true);
    setError(null);

    try {
      const allTransactions: ReturnType<typeof parseCsvContent>["transactions"] = [];

      const contents = await Promise.all(files.map(readFileAsText));
      for (const content of contents) {
        const parsed = parseCsvContent(content);
        allTransactions.push(...parsed.transactions);
      }

      const transactions = bridgeCsvToTransactions(allTransactions);
      const patterns = detectRecurringPatterns(transactions);

      // Pre-compute normalized event names for matching
      const normalizedEventNames = new Map<string, string>();
      for (const event of existingEvents) {
        normalizedEventNames.set(normalizePayee(event.name), event.name);
      }

      const newPatterns: RecurrencePattern[] = [];
      const trackedPatterns: { pattern: RecurrencePattern; matchedEventName: string }[] = [];

      for (const pattern of patterns) {
        const matchedName = matchPatternToEvent(pattern, normalizedEventNames);
        if (matchedName) {
          trackedPatterns.push({ pattern, matchedEventName: matchedName });
        } else {
          newPatterns.push(pattern);
        }
      }

      setResult({
        totalTransactions: transactions.length,
        fileCount: files.length,
        allPatterns: patterns,
        newPatterns,
        trackedPatterns,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze CSV files");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleDismiss(payeeNormalized: string) {
    setDismissedPayees((prev) => new Set(prev).add(payeeNormalized));
  }

  function handleReset() {
    setFiles([]);
    setResult(null);
    setError(null);
    setDismissedPayees(new Set());
    setTrackedCollapsed(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const visibleNewPatterns = result?.newPatterns.filter(
    (p) => !dismissedPayees.has(p.payeeNormalized)
  ) ?? [];

  // Pre-analysis: file upload view
  if (!result) {
    return (
      <div className="space-y-4">
        <div
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-sm text-gray-500">
            Drag & drop CSV files here, or{" "}
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              onClick={() => fileInputRef.current?.click()}
            >
              browse
            </button>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Quicken CSV exports, max 10MB per file
          </p>
        </div>

        {files.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <p className="mb-2 text-sm font-medium">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </p>
              <ul className="space-y-1">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-gray-600">{file.name}</span>
                    <button
                      type="button"
                      className="ml-2 text-xs text-gray-400 hover:text-red-500"
                      onClick={() => removeFile(i)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Button
          onClick={handleAnalyze}
          disabled={files.length === 0 || analyzing}
        >
          {analyzing ? "Analyzing..." : "Analyze"}
        </Button>
      </div>
    );
  }

  // Post-analysis: results view
  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>
              <span className="font-medium">{result.fileCount}</span> file
              {result.fileCount !== 1 ? "s" : ""} loaded
            </span>
            <span>
              <span className="font-medium">{result.totalTransactions}</span>{" "}
              transactions analyzed
            </span>
            <span>
              <span className="font-medium">{result.allPatterns.length}</span>{" "}
              pattern{result.allPatterns.length !== 1 ? "s" : ""} found
            </span>
            <span>
              <span className="font-medium">{result.newPatterns.length}</span>{" "}
              new
            </span>
            <span>
              <span className="font-medium">{result.trackedPatterns.length}</span>{" "}
              already tracked
            </span>
          </div>
        </CardContent>
      </Card>

      {/* New patterns */}
      {visibleNewPatterns.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">New Patterns</h3>
          {visibleNewPatterns.map((pattern) => {
            const showAmountRange =
              pattern.amountRange.min !== pattern.amountRange.max;

            return (
              <Card key={pattern.payeeNormalized}>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <ConfidenceDot pattern={pattern} />
                        <span className="truncate font-medium">
                          {pattern.payee}
                        </span>
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
                        <span>
                          Day of month: {pattern.suggestedDayOfMonth}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/events/new?${buildEditQueryParams(pattern)}`}
                      >
                        <Button size="sm">Edit & Add</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(pattern.payeeNormalized)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : result.newPatterns.length === 0 && result.allPatterns.length > 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">
              All detected patterns are already tracked as cashflow events.
            </p>
          </CardContent>
        </Card>
      ) : visibleNewPatterns.length === 0 && result.newPatterns.length > 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">
              All new patterns have been dismissed.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {result.allPatterns.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">
              No recurring patterns detected. Try uploading more transaction
              history.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Already tracked */}
      {result.trackedPatterns.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-semibold text-gray-700"
            onClick={() => setTrackedCollapsed((prev) => !prev)}
          >
            <span
              className={`inline-block transition-transform ${
                trackedCollapsed ? "" : "rotate-90"
              }`}
            >
              &#9654;
            </span>
            Already Tracked ({result.trackedPatterns.length})
          </button>
          {!trackedCollapsed &&
            result.trackedPatterns.map(({ pattern, matchedEventName }) => (
              <Card key={pattern.payeeNormalized}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3 text-sm">
                    <ConfidenceDot pattern={pattern} />
                    <span className="font-medium">{pattern.payee}</span>
                    <span className="text-gray-400">matched to</span>
                    <span className="text-gray-600">{matchedEventName}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Reset button */}
      <Button variant="outline" onClick={handleReset}>
        Clear & Start Over
      </Button>
    </div>
  );
}
