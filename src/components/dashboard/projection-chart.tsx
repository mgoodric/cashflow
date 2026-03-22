"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeProjection } from "@/lib/projection";
import type { Account, CashflowEvent } from "@/lib/types/database";

interface ProjectionChartProps {
  accounts: Account[];
  events: CashflowEvent[];
}

const timeRanges = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
  { label: "1y", days: 365 },
] as const;

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface TooltipPayloadEntry {
  value: number;
  payload: {
    date: string;
    balance: number;
    events: { name: string; amount: number; type: string }[];
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-white p-3 shadow-md">
      <p className="text-sm font-medium">{formatDate(data.date)}</p>
      <p className={`text-lg font-bold ${data.balance < 0 ? "text-red-600" : "text-green-600"}`}>
        {formatCurrency(data.balance)}
      </p>
      {data.events.length > 0 && (
        <div className="mt-1 space-y-1">
          {data.events.map((evt, i) => (
            <p key={i} className="text-xs text-gray-500">
              {evt.type === "income" ? "+" : "-"}{formatCurrency(evt.amount)} {evt.name}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectionChart({ accounts, events }: ProjectionChartProps) {
  const [selectedRange, setSelectedRange] = useState(90);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);

  const projection = useMemo(() => {
    const today = new Date();
    const startDate = today.toISOString().split("T")[0];
    const end = new Date(today);
    end.setDate(end.getDate() + selectedRange);
    const endDate = end.toISOString().split("T")[0];

    return computeProjection(accounts, events, startDate, endDate, selectedAccount);
  }, [accounts, events, selectedRange, selectedAccount]);

  const hasNegative = projection.negativeDates.length > 0;

  // Sample data points for readability (max ~60 ticks)
  const sampleInterval = Math.max(1, Math.floor(projection.dataPoints.length / 60));
  const chartData = projection.dataPoints.filter((_, i) => i % sampleInterval === 0 || i === projection.dataPoints.length - 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Balance Projection</CardTitle>
            {hasNegative && (
              <Badge variant="destructive" className="mt-1">
                Negative balance on {projection.negativeDates.length} day(s)
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={selectedAccount ?? ""}
              onChange={(e) => setSelectedAccount(e.target.value || undefined)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
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
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#22c55e"
                fill="url(#positiveGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex gap-4 text-sm text-gray-500">
          <span>
            Lowest: <strong className={projection.lowestBalance < 0 ? "text-red-600" : ""}>
              {formatCurrency(projection.lowestBalance)}
            </strong> on {formatDate(projection.lowestBalanceDate)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
