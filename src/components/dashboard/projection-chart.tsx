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
import { buildScenarioEvents, applyBalanceAdjustments } from "@/lib/scenario";
import type { Account, CashflowEvent, Category, EventOverride, Scenario, ScenarioEvent } from "@/lib/types/database";

const NO_CATEGORY = "__none__";

interface ProjectionChartProps {
  accounts: Account[];
  events: CashflowEvent[];
  categories?: Category[];
  overrides?: EventOverride[];
  scenarios?: Scenario[];
  scenarioEvents?: ScenarioEvent[];
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
    <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
      <p className="text-sm font-medium">{formatDate(data.date)}</p>
      <p className={`text-lg font-bold ${data.balance < 0 ? "text-red-600" : "text-green-600"}`}>
        {formatCurrency(data.balance)}
      </p>
      {data.events.length > 0 && (
        <div className="mt-1 space-y-1">
          {data.events.map((evt, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {evt.type === "income" ? "+" : "-"}{formatCurrency(evt.amount)} {evt.name}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectionChart({
  accounts, events, categories = [], overrides = [],
  scenarios: availableScenarios = [], scenarioEvents: allScenarioEvents = [],
}: ProjectionChartProps) {
  const [selectedRange, setSelectedRange] = useState(90);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | undefined>(undefined);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const filteredEvents = useMemo(() => {
    if (!selectedCategory) return events;
    if (selectedCategory === NO_CATEGORY) {
      return events.filter((e) => !e.category_id);
    }
    return events.filter((e) => e.category_id === selectedCategory);
  }, [events, selectedCategory]);

  const { projection, scenarioProjection, selectedScenario } = useMemo(() => {
    const today = new Date();
    const startDate = today.toISOString().split("T")[0];
    const end = new Date(today);
    end.setDate(end.getDate() + selectedRange);
    const endDate = end.toISOString().split("T")[0];

    const base = computeProjection(accounts, filteredEvents, startDate, endDate, selectedAccount, overrides);

    let scenProj = null;
    let scen = null;
    if (selectedScenarioId) {
      scen = availableScenarios.find((s) => s.id === selectedScenarioId) ?? null;
      if (scen) {
        const scenEvts = allScenarioEvents.filter((se) => se.scenario_id === scen!.id);
        const modifiedEvents = buildScenarioEvents(filteredEvents, scenEvts);
        const adjustedAccounts = applyBalanceAdjustments(accounts, scen);
        scenProj = computeProjection(adjustedAccounts, modifiedEvents, startDate, endDate, selectedAccount, overrides);
      }
    }

    return { projection: base, scenarioProjection: scenProj, selectedScenario: scen };
  }, [accounts, filteredEvents, selectedRange, selectedAccount, overrides, selectedScenarioId, availableScenarios, allScenarioEvents]);

  const hasNegative = projection.negativeDates.length > 0;
  const isComparing = scenarioProjection !== null;

  const sampleInterval = Math.max(1, Math.floor(projection.dataPoints.length / 60));
  const chartData = projection.dataPoints
    .filter((_, i) => i % sampleInterval === 0 || i === projection.dataPoints.length - 1)
    .map((dp) => {
      const scenarioDp = scenarioProjection?.dataPoints.find((s) => s.date === dp.date);
      return { ...dp, scenarioBalance: scenarioDp?.balance };
    });

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
          <div className="flex flex-wrap gap-2">
            {availableScenarios.length > 0 && (
              <select
                value={selectedScenarioId ?? ""}
                onChange={(e) => setSelectedScenarioId(e.target.value || undefined)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="">No Scenario</option>
                {availableScenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
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
            <select
              value={selectedCategory ?? ""}
              onChange={(e) => setSelectedCategory(e.target.value || undefined)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">All Categories</option>
              <option value={NO_CATEGORY}>(No Category)</option>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
        <div className="h-[280px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="scenarioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                name="Current"
              />
              {isComparing && (
                <Area
                  type="monotone"
                  dataKey="scenarioBalance"
                  stroke="#8b5cf6"
                  fill="url(#scenarioGradient)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={selectedScenario?.name ?? "Scenario"}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            Lowest: <strong className={projection.lowestBalance < 0 ? "text-red-600" : ""}>
              {formatCurrency(projection.lowestBalance)}
            </strong> on {formatDate(projection.lowestBalanceDate)}
          </span>
          {isComparing && selectedScenario && scenarioProjection && (
            <span>
              {selectedScenario.name} lowest: <strong className={scenarioProjection.lowestBalance < 0 ? "text-red-600" : "text-purple-600"}>
                {formatCurrency(scenarioProjection.lowestBalance)}
              </strong> on {formatDate(scenarioProjection.lowestBalanceDate)}
            </span>
          )}
        </div>
        {isComparing && (
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 bg-green-500" /> Current
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-purple-500" /> {selectedScenario?.name}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
