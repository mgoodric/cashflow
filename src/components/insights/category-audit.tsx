"use client";

import { useState, useTransition } from "react";
import { fixCategoryMisclassifications, dismissFlags } from "@/actions/insights";
import type { MisclassificationFlag, Category } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SELECT_CLASS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

interface PayeeGroup {
  payee: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  consistency: number;
  totalTransactions: number;
  flags: MisclassificationFlag[];
}

function groupByPayee(flags: MisclassificationFlag[]): PayeeGroup[] {
  const groups = new Map<string, MisclassificationFlag[]>();
  for (const flag of flags) {
    const key = flag.payee.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.push(flag);
    } else {
      groups.set(key, [flag]);
    }
  }

  return Array.from(groups.entries()).map(([, groupFlags]) => {
    const first = groupFlags[0];
    return {
      payee: first.payee,
      suggestedCategoryId: first.suggestedCategoryId,
      suggestedCategoryName: first.suggestedCategoryName,
      consistency: first.payeeConsistency,
      totalTransactions: Math.round(groupFlags.length / (1 - first.payeeConsistency + 0.001)),
      flags: groupFlags,
    };
  });
}

interface CategoryAuditProps {
  flags: MisclassificationFlag[];
  categories: Category[];
}

export function CategoryAudit({ flags: initialFlags, categories }: CategoryAuditProps) {
  const [flags, setFlags] = useState(initialFlags);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [isPending, startTransition] = useTransition();

  const payeeMismatchFlags = flags.filter(
    (f) => f.reason === "payee_mismatch" || f.reason === "both"
  );
  const amountOutlierFlags = flags.filter((f) => f.reason === "amount_outlier");
  const payeeGroups = groupByPayee(payeeMismatchFlags);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleGroupSelection(group: PayeeGroup) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = group.flags.every((f) => next.has(f.transactionId));
      for (const f of group.flags) {
        if (allSelected) {
          next.delete(f.transactionId);
        } else {
          next.add(f.transactionId);
        }
      }
      return next;
    });
  }

  function getEffectiveCategoryId(flag: MisclassificationFlag): string | null {
    return overrides.get(flag.transactionId) ?? flag.suggestedCategoryId;
  }

  function removeFlags(ids: string[]) {
    setFlags((prev) => prev.filter((f) => !ids.includes(f.transactionId)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
  }

  function handleFix(flag: MisclassificationFlag) {
    const categoryId = getEffectiveCategoryId(flag);
    if (!categoryId) return;

    startTransition(async () => {
      await fixCategoryMisclassifications([
        { transactionId: flag.transactionId, newCategoryId: categoryId },
      ]);
      removeFlags([flag.transactionId]);
    });
  }

  function handleDismiss(flag: MisclassificationFlag) {
    startTransition(async () => {
      await dismissFlags([flag.transactionId]);
      removeFlags([flag.transactionId]);
    });
  }

  function handleFixAllLikeThis(group: PayeeGroup) {
    if (!group.suggestedCategoryId) return;
    const fixes = group.flags.map((f) => ({
      transactionId: f.transactionId,
      newCategoryId: overrides.get(f.transactionId) ?? group.suggestedCategoryId!,
    }));

    startTransition(async () => {
      await fixCategoryMisclassifications(fixes);
      removeFlags(group.flags.map((f) => f.transactionId));
    });
  }

  function handleFixAllSelected() {
    const fixes: Array<{ transactionId: string; newCategoryId: string }> = [];
    for (const id of selectedIds) {
      const flag = flags.find((f) => f.transactionId === id);
      if (!flag) continue;
      const categoryId = getEffectiveCategoryId(flag);
      if (!categoryId) continue;
      fixes.push({ transactionId: id, newCategoryId: categoryId });
    }
    if (fixes.length === 0) return;

    startTransition(async () => {
      await fixCategoryMisclassifications(fixes);
      removeFlags(fixes.map((f) => f.transactionId));
    });
  }

  if (flags.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No category misclassifications found. All transactions look good.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Flagged Transactions
            <Badge variant="secondary">{flags.length}</Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {payeeGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payee Mismatches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {payeeGroups.map((group) => (
              <div key={group.payee} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={group.flags.every((f) =>
                        selectedIds.has(f.transactionId)
                      )}
                      onChange={() => toggleGroupSelection(group)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="font-medium">{group.payee}</span>
                    <span className="text-sm text-muted-foreground">
                      — usually &apos;{group.suggestedCategoryName ?? "Uncategorized"}&apos;
                      ({Math.round(group.consistency * 100)}% of {group.totalTransactions}{" "}
                      transactions)
                    </span>
                  </div>
                  {group.consistency >= 0.7 && group.suggestedCategoryId && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleFixAllLikeThis(group)}
                    >
                      Fix All Like This
                    </Button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="w-8 pb-2" />
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Amount</th>
                        <th className="pb-2 pr-4">Current Category</th>
                        <th className="pb-2 pr-4">Suggested Category</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.flags.map((flag) => (
                        <tr key={flag.transactionId} className="border-b last:border-0">
                          <td className="py-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(flag.transactionId)}
                              onChange={() => toggleSelection(flag.transactionId)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="py-2 pr-4">{formatDate(flag.transactionDate)}</td>
                          <td className="py-2 pr-4">{formatCurrency(flag.amount)}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="outline">
                              {flag.currentCategoryName ?? "Uncategorized"}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant="secondary">
                              {flag.suggestedCategoryName ?? "Uncategorized"}
                            </Badge>
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="default"
                                size="xs"
                                disabled={isPending || !getEffectiveCategoryId(flag)}
                                onClick={() => handleFix(flag)}
                              >
                                Fix
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={isPending}
                                onClick={() => handleDismiss(flag)}
                              >
                                Keep
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {amountOutlierFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Amount Outliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="w-8 pb-2" />
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Payee</th>
                    <th className="pb-2 pr-4">Current Category</th>
                    <th className="pb-2 pr-4">Deviation</th>
                    <th className="pb-2 pr-4">Recategorize</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {amountOutlierFlags.map((flag) => (
                    <tr key={flag.transactionId} className="border-b last:border-0">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(flag.transactionId)}
                          onChange={() => toggleSelection(flag.transactionId)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="py-2 pr-4">{formatDate(flag.transactionDate)}</td>
                      <td className="py-2 pr-4 font-medium">{formatCurrency(flag.amount)}</td>
                      <td className="py-2 pr-4">{flag.payee}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">
                          {flag.currentCategoryName ?? "Uncategorized"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs text-muted-foreground">
                          {flag.amountZScore !== null
                            ? `${Math.abs(flag.amountZScore).toFixed(1)} std. deviations from typical`
                            : "Unusual amount"}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          className={SELECT_CLASS + " text-sm"}
                          value={
                            overrides.get(flag.transactionId) ??
                            flag.suggestedCategoryId ??
                            flag.currentCategoryId ??
                            ""
                          }
                          onChange={(e) => {
                            setOverrides((prev) => {
                              const next = new Map(prev);
                              next.set(flag.transactionId, e.target.value);
                              return next;
                            });
                          }}
                        >
                          <option value="">Select category</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="default"
                            size="xs"
                            disabled={isPending || !getEffectiveCategoryId(flag)}
                            onClick={() => handleFix(flag)}
                          >
                            Fix
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={isPending}
                            onClick={() => handleDismiss(flag)}
                          >
                            Keep
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 flex justify-center">
          <Button
            size="lg"
            disabled={isPending}
            onClick={handleFixAllSelected}
          >
            Fix All Selected ({selectedIds.size})
          </Button>
        </div>
      )}
    </div>
  );
}
