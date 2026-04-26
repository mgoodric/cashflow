"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SELECT_CLASS } from "@/lib/constants";
import { parseQifContent } from "@/lib/import/qif-parser";
import { parseCsvContent } from "@/lib/import/csv-parser";
import type {
  ParsedQifFile,
} from "@/lib/import/qif-parser";
import {
  detectDateFormat,
  parseDate,
  type DateFormat,
} from "@/lib/import/date-detector";
import { executeImport } from "@/actions/import";
import type {
  Account,
  Category,
  ImportPayload,
  ImportResult,
} from "@/lib/types/database";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

type AccountMapping = {
  qifName: string;
  qifType: string;
  action: "create" | "match" | "skip";
  matchedAccountId?: string;
  suggestedAppType: string;
};

type CategoryMapping = {
  qifPath: string;
  name: string;
  parentPath: string | null;
  action: "create" | "match" | "skip";
  matchedCategoryId?: string;
};

interface ImportWizardProps {
  existingAccounts: Account[];
  existingCategories: Category[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: WizardStep;
  totalSteps: number;
}) {
  const labels = [
    "Upload",
    "Accounts",
    "Categories",
    "Dates",
    "Preview",
    "Import",
  ];
  return (
    <div className="mb-8 flex items-center justify-between">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isComplete = step < currentStep;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isComplete ? "\u2713" : step}
            </div>
            <span
              className={`text-sm ${
                isActive
                  ? "font-medium text-foreground"
                  : isComplete
                    ? "text-muted-foreground"
                    : "text-muted-foreground/70"
              }`}
            >
              {labels[i]}
            </span>
            {i < totalSteps - 1 && (
              <div
                className={`mx-2 h-px w-8 ${
                  isComplete ? "bg-primary/40" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ImportWizard({
  existingAccounts,
  existingCategories,
}: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importSource, setImportSource] = useState<"qif" | "csv">("qif");
  const [parsedFile, setParsedFile] = useState<ParsedQifFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [accountMappings, setAccountMappings] = useState<AccountMapping[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>(
    []
  );
  const [selectedDateFormat, setSelectedDateFormat] =
    useState<DateFormat | null>(null);
  const [dateFormatCandidates, setDateFormatCandidates] = useState<
    DateFormat[]
  >([]);
  const [dateFormatSamples, setDateFormatSamples] = useState<string[]>([]);
  const [isDateAmbiguous, setIsDateAmbiguous] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [skipTransfers, setSkipTransfers] = useState(false);
  const [showPreviewTable, setShowPreviewTable] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // -- File handling --

  const processFile = useCallback(
    (file: File) => {
      setParseError(null);
      const lowerName = file.name.toLowerCase();
      const isQif = lowerName.endsWith(".qif");
      const isCsv = lowerName.endsWith(".csv");
      if (!isQif && !isCsv) {
        setParseError("Only .qif and .csv files are supported.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setParseError("File exceeds 10MB size limit.");
        return;
      }
      setFileName(file.name);
      setImportSource(isCsv ? "csv" : "qif");
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = isCsv ? parseCsvContent(content) : parseQifContent(content);
          setParsedFile(parsed);

          // Initialize account mappings with auto-matching
          const mappings: AccountMapping[] = parsed.accounts.map((acc) => {
            const match = existingAccounts.find(
              (ea) =>
                ea.name.toLowerCase().includes(acc.name.toLowerCase()) ||
                acc.name.toLowerCase().includes(ea.name.toLowerCase())
            );
            return {
              qifName: acc.name,
              qifType: acc.qifType,
              suggestedAppType: acc.suggestedAppType,
              action: match ? "match" : "create",
              matchedAccountId: match?.id,
            };
          });
          setAccountMappings(mappings);

          // Initialize category mappings with auto-matching
          const catMappings: CategoryMapping[] = parsed.categories.map(
            (cat) => {
              const match = existingCategories.find(
                (ec) => ec.name.toLowerCase() === cat.name.toLowerCase()
              );
              return {
                qifPath: cat.path,
                name: cat.name,
                parentPath: cat.parentPath,
                action: match ? "match" : "create",
                matchedCategoryId: match?.id,
              };
            }
          );
          setCategoryMappings(catMappings);

          // Detect date format
          const detection = detectDateFormat(parsed.rawDateStrings);
          setDateFormatCandidates(detection.candidates);
          setDateFormatSamples(detection.sampleDates);
          setIsDateAmbiguous(detection.isAmbiguous);
          if (detection.format) {
            setSelectedDateFormat(detection.format);
          }
        } catch {
          setParseError(
            `Failed to parse ${isCsv ? "CSV" : "QIF"} file. The file may be corrupted or in an unsupported format.`
          );
        }
      };
      reader.onerror = () => {
        setParseError("Failed to read file.");
      };
      reader.readAsText(file);
    },
    [existingAccounts, existingCategories]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // -- Account mapping --

  function updateAccountMapping(
    index: number,
    value: string
  ) {
    setAccountMappings((prev) => {
      const next = [...prev];
      if (value === "create") {
        next[index] = { ...next[index], action: "create", matchedAccountId: undefined };
      } else if (value === "skip") {
        next[index] = { ...next[index], action: "skip", matchedAccountId: undefined };
      } else {
        next[index] = { ...next[index], action: "match", matchedAccountId: value };
      }
      return next;
    });
  }

  // -- Category mapping --

  function updateCategoryMapping(
    index: number,
    value: string
  ) {
    setCategoryMappings((prev) => {
      const next = [...prev];
      if (value === "create") {
        next[index] = { ...next[index], action: "create", matchedCategoryId: undefined };
      } else if (value === "skip") {
        next[index] = { ...next[index], action: "skip", matchedCategoryId: undefined };
      } else {
        next[index] = { ...next[index], action: "match", matchedCategoryId: value };
      }
      return next;
    });
  }

  // -- Import execution --

  async function handleImport() {
    if (!parsedFile || !selectedDateFormat) return;
    setIsImporting(true);
    setStep(6);

    try {
      const convertedTransactions = parsedFile.transactions
        .filter((t) => !t.isTransfer || !skipTransfers)
        .map((t) => ({
          date: parseDate(t.date, selectedDateFormat),
          amount: t.amount,
          payee: t.payee,
          category: t.category,
          memo: t.memo,
          checkNumber: t.checkNumber,
          qifAccountName: t.qifAccountName,
          type: t.type,
        }));

      const payload: ImportPayload = {
        source: importSource,
        filename: fileName ?? `import.${importSource}`,
        accountMappings: accountMappings.map((m) => ({
          qifName: m.qifName,
          qifType: m.qifType,
          action: m.action,
          matchedAccountId: m.matchedAccountId,
          newAccountType: m.action === "create" ? (m.suggestedAppType as Account["account_type"]) : undefined,
        })),
        categoryMappings: categoryMappings.map((m) => ({
          qifPath: m.qifPath,
          action: m.action,
          matchedCategoryId: m.matchedCategoryId,
        })),
        transactions: convertedTransactions,
        dateFormat: selectedDateFormat,
        skipDuplicates,
        skipTransfers,
      };

      const result = await executeImport(payload);
      setImportResult(result);
    } catch (err) {
      setImportResult({
        sessionId: "",
        accountsCreated: 0,
        categoriesCreated: 0,
        transactionsImported: 0,
        duplicatesSkipped: 0,
        errors: [err instanceof Error ? err.message : "Import failed unexpectedly"],
      });
    } finally {
      setIsImporting(false);
    }
  }

  // -- Computed stats --

  function getPreviewStats() {
    if (!parsedFile) return null;
    const txns = parsedFile.transactions;
    const nonTransfer = txns.filter((t) => !t.isTransfer);
    const income = nonTransfer.filter((t) => t.type === "income");
    const expense = nonTransfer.filter((t) => t.type === "expense");
    const transfers = txns.filter((t) => t.isTransfer);

    const newAccounts = accountMappings.filter((m) => m.action === "create").length;
    const matchedAccounts = accountMappings.filter((m) => m.action === "match").length;
    const newCategories = categoryMappings.filter((m) => m.action === "create").length;
    const matchedCategories = categoryMappings.filter((m) => m.action === "match").length;

    // Date range from raw strings using selected format
    let dateRange = { earliest: "", latest: "" };
    if (selectedDateFormat && parsedFile.rawDateStrings.length > 0) {
      try {
        const parsedDates = parsedFile.rawDateStrings
          .map((ds) => {
            try {
              return parseDate(ds, selectedDateFormat);
            } catch {
              return null;
            }
          })
          .filter(Boolean) as string[];
        parsedDates.sort();
        dateRange = {
          earliest: parsedDates[0] ?? "",
          latest: parsedDates[parsedDates.length - 1] ?? "",
        };
      } catch {
        // ignore date parsing errors in preview
      }
    }

    return {
      totalTransactions: txns.length,
      incomeCount: income.length,
      expenseCount: expense.length,
      transferCount: transfers.length,
      newAccounts,
      matchedAccounts,
      newCategories,
      matchedCategories,
      dateRange,
    };
  }

  // -- Navigation --

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return parsedFile !== null;
      case 2:
        return accountMappings.length > 0;
      case 3:
        return true; // categories are optional
      case 4:
        return selectedDateFormat !== null;
      case 5:
        return true;
      default:
        return false;
    }
  }

  // -- Render steps --

  function renderStep1() {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : parsedFile
                  ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/30"
                  : "border-border hover:border-border hover:bg-muted"
            }`}
          >
            {parsedFile ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  File loaded successfully
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">{fileName}</p>
                <div className="flex gap-3 pt-2">
                  <Badge variant="secondary">
                    {parsedFile.accounts.length} account{parsedFile.accounts.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="secondary">
                    {parsedFile.categories.length} categor{parsedFile.categories.length !== 1 ? "ies" : "y"}
                  </Badge>
                  <Badge variant="secondary">
                    {parsedFile.transactions.length} transaction{parsedFile.transactions.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground/80">
                  Drag and drop a .qif or .csv file here
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse (max 10MB)
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".qif,.csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
          {parseError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-400">
              {parseError}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderStep2() {
    if (!parsedFile) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Map Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Match each QIF account to an existing account, create a new one, or skip it.
          </p>
          <div className="space-y-3">
            {accountMappings.map((mapping, i) => (
              <div
                key={mapping.qifName}
                className="flex items-center gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {mapping.qifName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Type: {mapping.suggestedAppType}
                  </p>
                </div>
                <div className="shrink-0">
                  <select
                    className={SELECT_CLASS}
                    value={
                      mapping.action === "create"
                        ? "create"
                        : mapping.action === "skip"
                          ? "skip"
                          : mapping.matchedAccountId ?? "create"
                    }
                    onChange={(e) => updateAccountMapping(i, e.target.value)}
                  >
                    <option value="create">Create New</option>
                    <option value="skip">Skip</option>
                    {existingAccounts
                      .filter(
                        (ea) =>
                          ea.account_type === mapping.suggestedAppType ||
                          true // show all, compatible first
                      )
                      .map((ea) => (
                        <option key={ea.id} value={ea.id}>
                          {ea.name} ({ea.account_type})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderStep3() {
    if (!parsedFile) return null;
    if (categoryMappings.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Map Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No categories found in the QIF file. You can proceed to the next step.
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Map Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Match QIF categories to existing ones, create new, or skip.
          </p>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {categoryMappings.map((mapping, i) => {
              const depth = mapping.qifPath.split(":").length - 1;
              return (
                <div
                  key={mapping.qifPath}
                  className="flex items-center gap-4 rounded-lg border p-3"
                  style={{ marginLeft: depth * 16 }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {mapping.name}
                    </p>
                    {mapping.parentPath && (
                      <p className="text-xs text-muted-foreground/70">
                        {mapping.parentPath}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <select
                      className={SELECT_CLASS}
                      value={
                        mapping.action === "create"
                          ? "create"
                          : mapping.action === "skip"
                            ? "skip"
                            : mapping.matchedCategoryId ?? "create"
                      }
                      onChange={(e) => updateCategoryMapping(i, e.target.value)}
                    >
                      <option value="create">Create New</option>
                      <option value="skip">Skip</option>
                      {existingCategories.map((ec) => (
                        <option key={ec.id} value={ec.id}>
                          {ec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderStep4() {
    if (!parsedFile) return null;

    function formatSampleDate(raw: string, fmt: DateFormat): string {
      try {
        return parseDate(raw, fmt);
      } catch {
        return "(invalid)";
      }
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Date Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isDateAmbiguous && selectedDateFormat ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/30 dark:border-green-800 p-3">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Date format detected: {selectedDateFormat}
                </p>
              </div>
              {dateFormatSamples.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground/80">
                    Sample conversions:
                  </p>
                  {dateFormatSamples.slice(0, 3).map((raw, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {raw} → {formatSampleDate(raw, selectedDateFormat)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The date format is ambiguous. Please select the correct format:
              </p>
              <div className="space-y-3">
                {dateFormatCandidates.map((fmt) => (
                  <label
                    key={fmt}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                      selectedDateFormat === fmt
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="dateFormat"
                      value={fmt}
                      checked={selectedDateFormat === fmt}
                      onChange={() => setSelectedDateFormat(fmt)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{fmt}</p>
                      <div className="mt-1 space-y-0.5">
                        {dateFormatSamples.slice(0, 3).map((raw, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {raw} → {formatSampleDate(raw, fmt)}
                          </p>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderStep5() {
    const stats = getPreviewStats();
    if (!stats || !parsedFile) return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Accounts</p>
                <p className="text-lg font-semibold">
                  {stats.newAccounts} new, {stats.matchedAccounts} matched
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Categories</p>
                <p className="text-lg font-semibold">
                  {stats.newCategories} new, {stats.matchedCategories} matched
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="text-lg font-semibold">
                  {stats.totalTransactions} total
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="text-lg font-semibold text-green-600">
                  {stats.incomeCount}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-lg font-semibold text-red-600">
                  {stats.expenseCount}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Transfers</p>
                <p className="text-lg font-semibold">{stats.transferCount}</p>
              </div>
              {stats.dateRange.earliest && (
                <div className="col-span-2 rounded-lg bg-muted/50 p-3 md:col-span-3">
                  <p className="text-xs text-muted-foreground">Date Range</p>
                  <p className="text-lg font-semibold">
                    {stats.dateRange.earliest} to {stats.dateRange.latest}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  Skip duplicate transactions (matching date, amount, payee, account)
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipTransfers}
                  onChange={(e) => setSkipTransfers(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  Skip transfer transactions (account-to-account moves)
                </span>
              </label>
            </div>

            <div>
              <Button
                variant="outline"
                onClick={() => setShowPreviewTable(!showPreviewTable)}
              >
                {showPreviewTable ? "Hide" : "Preview"} Transactions
              </Button>
            </div>
          </CardContent>
        </Card>

        {showPreviewTable && (
          <Card>
            <CardHeader>
              <CardTitle>
                Transaction Preview (first 50)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedFile.transactions.slice(0, 50).map((t, i) => {
                    let formattedDate = t.date;
                    if (selectedDateFormat) {
                      try {
                        formattedDate = parseDate(t.date, selectedDateFormat);
                      } catch {
                        // show raw date on error
                      }
                    }
                    return (
                      <TableRow key={i}>
                        <TableCell>{formattedDate}</TableCell>
                        <TableCell className="max-w-[120px] truncate">
                          {t.qifAccountName}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {t.payee}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate">
                          {t.isTransfer ? (
                            <Badge variant="outline">Transfer</Badge>
                          ) : (
                            t.category || "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              t.type === "income"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {t.type === "expense" ? "-" : "+"}$
                            {t.amount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              t.type === "income" ? "secondary" : "destructive"
                            }
                          >
                            {t.type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  function renderStep6() {
    if (isImporting) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Importing...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Processing your file. This may take a moment for large files.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!importResult) return null;

    const hasErrors = importResult.errors.length > 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {hasErrors ? "Import Completed with Errors" : "Import Complete"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-3">
              <p className="text-xs text-muted-foreground">Accounts Created</p>
              <p className="text-lg font-semibold text-green-700">
                {importResult.accountsCreated}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-3">
              <p className="text-xs text-muted-foreground">Categories Created</p>
              <p className="text-lg font-semibold text-green-700">
                {importResult.categoriesCreated}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-3">
              <p className="text-xs text-muted-foreground">Transactions Imported</p>
              <p className="text-lg font-semibold text-green-700">
                {importResult.transactionsImported}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
              <p className="text-lg font-semibold">
                {importResult.duplicatesSkipped}
              </p>
            </div>
          </div>

          {hasErrors && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700">Errors:</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 p-3">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-600">
                    {err}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/insights/categories">
              <Button variant="outline">Audit Categories</Button>
            </Link>
            <Link href="/insights/recurring">
              <Button variant="outline">Detect Patterns</Button>
            </Link>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // -- Main render --

  const stepRenderers: Record<WizardStep, () => React.ReactNode> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
    6: renderStep6,
  };

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={step} totalSteps={6} />

      {stepRenderers[step]()}

      {step < 6 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => (s - 1) as WizardStep)}
            disabled={step === 1}
          >
            Back
          </Button>
          <div className="flex gap-3">
            {step === 5 ? (
              <>
                <Link href="/dashboard">
                  <Button variant="outline">Cancel</Button>
                </Link>
                <Button onClick={handleImport} disabled={!canProceed()}>
                  Import
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setStep((s) => (s + 1) as WizardStep)}
                disabled={!canProceed()}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
