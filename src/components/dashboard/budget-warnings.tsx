"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Category, CashflowEvent } from "@/lib/types/database";

interface BudgetWarningsProps {
  categories: Category[];
  events: CashflowEvent[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface BudgetLineItem {
  category: Category;
  spending: number;
  percentage: number;
  status: "under" | "warning" | "over";
}

function computeMonthlySpending(
  categoryId: string,
  events: CashflowEvent[],
  monthStart: Date,
  monthEnd: Date
): number {
  let total = 0;

  for (const event of events) {
    if (event.category_id !== categoryId) continue;
    if (event.event_type !== "expense") continue;

    const eventDate = new Date(event.event_date + "T00:00:00Z");

    if (!event.is_recurring) {
      if (eventDate >= monthStart && eventDate <= monthEnd) {
        total += event.amount;
      }
      continue;
    }

    const rule = event.recurrence_rule;
    if (!rule) continue;

    let current = eventDate;
    if (current >= monthStart && current <= monthEnd) {
      total += event.amount;
    }

    while (current <= monthEnd) {
      const next = getNextRecurrence(current, rule);
      if (!next || next > monthEnd) break;
      if (next >= monthStart) {
        total += event.amount;
      }
      current = next;
    }
  }

  return total;
}

function getNextRecurrence(
  current: Date,
  rule: NonNullable<CashflowEvent["recurrence_rule"]>
): Date | null {
  let next: Date;
  const endDate = rule.end_date ? new Date(rule.end_date + "T00:00:00Z") : null;

  switch (rule.frequency) {
    case "daily":
      next = new Date(current);
      next.setUTCDate(next.getUTCDate() + rule.interval);
      break;
    case "weekly":
      next = new Date(current);
      next.setUTCDate(next.getUTCDate() + 7 * rule.interval);
      break;
    case "biweekly":
      next = new Date(current);
      next.setUTCDate(next.getUTCDate() + 14 * rule.interval);
      break;
    case "monthly": {
      const m = current.getUTCMonth() + rule.interval;
      const year = current.getUTCFullYear() + Math.floor(m / 12);
      const month = m % 12;
      const day = rule.day_of_month ?? current.getUTCDate();
      const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      next = new Date(Date.UTC(year, month, Math.min(day, maxDay)));
      break;
    }
    case "quarterly": {
      const qm = current.getUTCMonth() + 3 * rule.interval;
      const qYear = current.getUTCFullYear() + Math.floor(qm / 12);
      const qMonth = qm % 12;
      const qDay = rule.day_of_month ?? current.getUTCDate();
      const qMax = new Date(Date.UTC(qYear, qMonth + 1, 0)).getUTCDate();
      next = new Date(Date.UTC(qYear, qMonth, Math.min(qDay, qMax)));
      break;
    }
    case "yearly": {
      const yYear = current.getUTCFullYear() + rule.interval;
      const yMonth = current.getUTCMonth();
      const yDay = current.getUTCDate();
      const yMax = new Date(Date.UTC(yYear, yMonth + 1, 0)).getUTCDate();
      next = new Date(Date.UTC(yYear, yMonth, Math.min(yDay, yMax)));
      break;
    }
    default:
      return null;
  }

  if (endDate && next > endDate) return null;
  return next;
}

export function BudgetWarnings({ categories, events }: BudgetWarningsProps) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));

  const budgetedCategories = categories.filter((c) => c.budget_limit !== null);

  if (budgetedCategories.length === 0) return null;

  const items: BudgetLineItem[] = budgetedCategories.map((cat) => {
    const spending = computeMonthlySpending(cat.id, events, monthStart, monthEnd);
    const limit = cat.budget_limit!;
    const percentage = limit > 0 ? (spending / limit) * 100 : 0;

    let status: "under" | "warning" | "over";
    if (percentage > 100) {
      status = "over";
    } else if (percentage >= 80) {
      status = "warning";
    } else {
      status = "under";
    }

    return { category: cat, spending, percentage, status };
  });

  // Sort: over first, then warning, then under
  items.sort((a, b) => {
    const order = { over: 0, warning: 1, under: 2 };
    return order[a.status] - order[b.status] || b.percentage - a.percentage;
  });

  const hasWarnings = items.some((i) => i.status === "over" || i.status === "warning");

  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Budget Overview
          {hasWarnings && (
            <Badge variant="destructive">
              {items.filter((i) => i.status === "over").length > 0
                ? `${items.filter((i) => i.status === "over").length} over budget`
                : "Nearing limits"}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{monthName} spending vs limits</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => {
            const barWidth = Math.min(Math.round(item.percentage), 100);
            const colorClass =
              item.status === "over"
                ? "bg-red-500"
                : item.status === "warning"
                  ? "bg-yellow-500"
                  : "bg-green-500";

            return (
              <div key={item.category.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.category.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.spending)} / {formatCurrency(item.category.budget_limit!)}
                    <span className="ml-1">
                      ({Math.round(item.percentage)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${colorClass}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                {item.status === "over" && (
                  <p className="text-xs text-red-600">
                    Over by {formatCurrency(item.spending - item.category.budget_limit!)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
