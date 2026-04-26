"use client";

import { useState, useMemo } from "react";
import { Sankey, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CashflowEvent, Category, RecurrenceRule, EventType } from "@/lib/types/database";

interface SankeyChartProps {
  events: CashflowEvent[];
  categories: Category[];
}

const timeRanges = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
  { label: "1y", days: 365 },
] as const;

const INCOME_COLORS = ["#22c55e", "#16a34a", "#15803d", "#166534", "#4ade80", "#86efac"];
const EXPENSE_COLORS = ["#ef4444", "#f97316", "#dc2626", "#ea580c", "#f87171", "#fb923c"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
  const endDate = rule.end_date ? new Date(rule.end_date + "T00:00:00Z") : null;

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
      next = new Date(Date.UTC(qYear, qMonth, clampDay(qYear, qMonth, qDay)));
      break;
    }
    case "yearly": {
      const yYear = current.getUTCFullYear() + rule.interval;
      const yMonth = current.getUTCMonth();
      const yDay = current.getUTCDate();
      next = new Date(Date.UTC(yYear, yMonth, clampDay(yYear, yMonth, yDay)));
      break;
    }
    default:
      return null;
  }

  if (endDate && next > endDate) return null;
  return next;
}

interface Occurrence {
  categoryId: string | null;
  eventType: EventType;
  amount: number;
}

function expandEventsInPeriod(
  events: CashflowEvent[],
  startDate: Date,
  endDate: Date
): Occurrence[] {
  const occurrences: Occurrence[] = [];

  for (const event of events) {
    if (!event.is_active) continue;

    const eventDate = new Date(event.event_date + "T00:00:00Z");

    if (!event.is_recurring) {
      if (eventDate >= startDate && eventDate <= endDate) {
        occurrences.push({
          categoryId: event.category_id,
          eventType: event.event_type,
          amount: event.amount,
        });
      }
      continue;
    }

    // Place initial occurrence
    let current = eventDate;
    if (current >= startDate && current <= endDate) {
      occurrences.push({
        categoryId: event.category_id,
        eventType: event.event_type,
        amount: event.amount,
      });
    }

    // Expand recurring occurrences
    if (event.recurrence_rule) {
      while (current <= endDate) {
        const next = getNextOccurrence(current, event.recurrence_rule);
        if (!next || next > endDate) break;

        if (next >= startDate) {
          occurrences.push({
            categoryId: event.category_id,
            eventType: event.event_type,
            amount: event.amount,
          });
        }
        current = next;
      }
    }
  }

  return occurrences;
}

interface SankeyNode {
  name: string;
  fill?: string;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: {
      payload?: SankeyLink & {
        sourceName?: string;
        targetName?: string;
      };
    };
    name?: string;
    value?: number;
  }>;
}

function SankeyTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0];
  const linkPayload = data?.payload?.payload;

  if (linkPayload && linkPayload.sourceName && linkPayload.targetName) {
    return (
      <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
        <p className="text-sm font-medium">
          {linkPayload.sourceName} &rarr; {linkPayload.targetName}
        </p>
        <p className="text-lg font-bold">{formatCurrency(linkPayload.value)}</p>
      </div>
    );
  }

  if (data?.name && data?.value !== undefined) {
    return (
      <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
        <p className="text-sm font-medium">{data.name}</p>
        <p className="text-lg font-bold">{formatCurrency(data.value)}</p>
      </div>
    );
  }

  return null;
}

function buildSankeyData(
  occurrences: Occurrence[],
  categories: Category[]
): SankeyData | null {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Group by category + type and sum amounts
  const incomeByCategory = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();

  for (const occ of occurrences) {
    const catName = occ.categoryId ? (categoryMap.get(occ.categoryId) ?? "Uncategorized") : "Uncategorized";
    const map = occ.eventType === "income" ? incomeByCategory : expenseByCategory;
    map.set(catName, (map.get(catName) ?? 0) + occ.amount);
  }

  if (incomeByCategory.size === 0 && expenseByCategory.size === 0) {
    return null;
  }

  // If either side is empty, we can't draw links
  if (incomeByCategory.size === 0 || expenseByCategory.size === 0) {
    return null;
  }

  const totalIncome = Array.from(incomeByCategory.values()).reduce((a, b) => a + b, 0);

  // Build nodes: income categories first, then expense categories
  const incomeCategories = Array.from(incomeByCategory.keys()).sort();
  const expenseCategories = Array.from(expenseByCategory.keys()).sort();

  const nodes: SankeyNode[] = [
    ...incomeCategories.map((name, i) => ({
      name: name,
      fill: INCOME_COLORS[i % INCOME_COLORS.length],
    })),
    ...expenseCategories.map((name, i) => ({
      name: name,
      fill: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
    })),
  ];

  // Build links: each income -> each expense proportionally
  const links: SankeyLink[] = [];

  for (let i = 0; i < incomeCategories.length; i++) {
    const incomeName = incomeCategories[i];
    const incomeAmount = incomeByCategory.get(incomeName) ?? 0;
    const incomeRatio = incomeAmount / totalIncome;

    for (let j = 0; j < expenseCategories.length; j++) {
      const expenseName = expenseCategories[j];
      const expenseAmount = expenseByCategory.get(expenseName) ?? 0;
      const linkValue = Math.round(incomeRatio * expenseAmount * 100) / 100;

      if (linkValue > 0) {
        links.push({
          source: i,
          target: incomeCategories.length + j,
          value: linkValue,
        });
      }
    }
  }

  // Annotate links with names for tooltip
  const annotatedLinks = links.map((link) => ({
    ...link,
    sourceName: nodes[link.source].name,
    targetName: nodes[link.target].name,
  }));

  return { nodes, links: annotatedLinks };
}

export function SankeyChart({ events, categories }: SankeyChartProps) {
  const [selectedRange, setSelectedRange] = useState(90);

  const sankeyData = useMemo(() => {
    const today = new Date();
    const startDate = new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ));
    const endDate = addDays(startDate, selectedRange);

    const occurrences = expandEventsInPeriod(events, startDate, endDate);
    return buildSankeyData(occurrences, categories);
  }, [events, categories, selectedRange]);

  const hasCategories = events.some((e) => e.category_id !== null);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Income to Expenses Flow</CardTitle>
          <div className="flex gap-2">
            {timeRanges.map((range) => (
              <Button
                key={range.days}
                variant={selectedRange === range.days ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRange(range.days)}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasCategories ? (
          <div className="flex h-[400px] flex-col items-center justify-center text-center">
            <div className="rounded-lg border-2 border-dashed border-border p-8">
              <p className="text-lg font-medium text-muted-foreground">
                No categories assigned yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground/70">
                Assign categories to your cashflow events to see how your income
                flows into expenses. Edit your events and select a category to
                get started.
              </p>
            </div>
          </div>
        ) : !sankeyData ? (
          <div className="flex h-[400px] flex-col items-center justify-center text-center">
            <div className="rounded-lg border-2 border-dashed border-border p-8">
              <p className="text-lg font-medium text-muted-foreground">
                Not enough data for this period
              </p>
              <p className="mt-2 text-sm text-muted-foreground/70">
                You need both income and expense events with categories assigned
                within the selected time range to generate the flow chart.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyData}
                nodeWidth={20}
                nodePadding={24}
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                link={{ stroke: "#d1d5db", strokeOpacity: 0.5 }}
                node={{
                  fill: "#8884d8",
                  opacity: 1,
                }}
              >
                <Tooltip content={<SankeyTooltip />} />
              </Sankey>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
