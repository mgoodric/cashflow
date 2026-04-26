"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeProjection } from "@/lib/projection";
import type { Account, CashflowEvent } from "@/lib/types/database";

interface IncomeExpenseChartProps {
  events: CashflowEvent[];
  accounts: Account[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

interface MonthData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
  payload: MonthData;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
      <p className="text-sm font-medium">{data.month}</p>
      <p className="text-sm text-green-600">
        Income: {formatCurrency(data.income)}
      </p>
      <p className="text-sm text-red-600">
        Expenses: {formatCurrency(data.expenses)}
      </p>
      <p
        className={`mt-1 text-sm font-semibold ${data.net >= 0 ? "text-green-700" : "text-red-700"}`}
      >
        Net: {formatCurrency(data.net)}
      </p>
    </div>
  );
}

export function IncomeExpenseChart({
  events,
  accounts,
}: IncomeExpenseChartProps) {
  const chartData = useMemo(() => {
    const now = new Date();
    // 6 months ago through end of current month
    const startDate = new Date(
      Date.UTC(now.getFullYear(), now.getMonth() - 6, 1)
    );
    const endDate = new Date(
      Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)
    );

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Use a zero-balance dummy account so projection only tracks event flow
    const dummyAccounts: Account[] = accounts.length > 0
      ? accounts.map((a) => ({ ...a, current_balance: 0 }))
      : [
          {
            id: "dummy",
            user_id: "",
            name: "dummy",
            account_type: "checking" as const,
            current_balance: 0,
            currency: "USD",
            is_active: true,
            created_at: "",
            updated_at: "",
          },
        ];

    const projection = computeProjection(
      dummyAccounts,
      events,
      startStr,
      endStr
    );

    // Aggregate by month
    const monthMap = new Map<string, { income: number; expenses: number }>();

    for (const dp of projection.dataPoints) {
      const d = new Date(dp.date + "T00:00:00Z");
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, { income: 0, expenses: 0 });
      }
      const entry = monthMap.get(key)!;

      for (const evt of dp.events) {
        if (evt.type === "income") {
          entry.income += evt.amount;
        } else {
          entry.expenses += evt.amount;
        }
      }
    }

    // Sort by month key and format labels
    const monthFormatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]): MonthData => {
        const [year, month] = key.split("-").map(Number);
        const label = monthFormatter.format(
          new Date(Date.UTC(year, month - 1, 1))
        );
        return {
          month: label,
          income: Math.round(data.income * 100) / 100,
          expenses: Math.round(data.expenses * 100) / 100,
          net:
            Math.round((data.income - data.expenses) * 100) / 100,
        };
      });
  }, [events, accounts]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Income vs Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="income"
                name="Income"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
