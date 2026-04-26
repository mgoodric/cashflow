"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Account,
  CashflowEvent,
  EventType,
  Scenario,
  ScenarioEvent,
} from "@/lib/types/database";
import {
  addScenarioEvent,
  removeScenarioEvent,
  updateScenario,
} from "@/actions/scenarios";
import { buildScenarioEvents, applyBalanceAdjustments } from "@/lib/scenario";
import { computeProjection } from "@/lib/projection";
import { formatCurrency } from "@/lib/format";
import { FREQUENCY_LABELS, SELECT_CLASS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScenarioDetailProps {
  scenario: Scenario;
  scenarioEvents: ScenarioEvent[];
  baseEvents: CashflowEvent[];
  accounts: Account[];
}

export function ScenarioDetail({
  scenario,
  scenarioEvents,
  baseEvents,
  accounts,
}: ScenarioDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modifyEventId, setModifyEventId] = useState<string | null>(null);
  const [modifyAmount, setModifyAmount] = useState("");
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    amount: "",
    eventType: "expense" as EventType,
    accountId: accounts[0]?.id ?? "",
    isRecurring: false,
    frequency: "monthly" as "monthly" | "quarterly" | "yearly",
    dayOfMonth: "1",
  });
  const [adjustments, setAdjustments] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const account of accounts) {
      const adj = scenario.balance_adjustments?.[account.id];
      initial[account.id] = adj != null ? String(adj) : "";
    }
    return initial;
  });

  // Build exclusion/modification lookup
  const excludedEventIds = useMemo(() => {
    const set = new Set<string>();
    for (const se of scenarioEvents) {
      if (se.action === "exclude" && se.event_id) set.add(se.event_id);
    }
    return set;
  }, [scenarioEvents]);

  const modifiedEvents = useMemo(() => {
    const map = new Map<string, ScenarioEvent>();
    for (const se of scenarioEvents) {
      if (se.action === "modify" && se.event_id) map.set(se.event_id, se);
    }
    return map;
  }, [scenarioEvents]);

  const scenarioEventByEventId = useMemo(() => {
    const map = new Map<string, ScenarioEvent>();
    for (const se of scenarioEvents) {
      if (se.event_id) map.set(se.event_id, se);
    }
    return map;
  }, [scenarioEvents]);

  // Compute projections
  const { today, endDate } = useMemo(() => {
    const now = new Date();
    const t = now.toISOString().split("T")[0];
    const end = new Date(now);
    end.setDate(end.getDate() + 90);
    return { today: t, endDate: end.toISOString().split("T")[0] };
  }, []);

  const baseProjection = useMemo(
    () => computeProjection(accounts, baseEvents, today, endDate),
    [accounts, baseEvents, today, endDate]
  );

  const scenarioProjection = useMemo(() => {
    const modifiedAccountList = applyBalanceAdjustments(accounts, scenario);
    const modifiedEvents = buildScenarioEvents(baseEvents, scenarioEvents);
    return computeProjection(modifiedAccountList, modifiedEvents, today, endDate);
  }, [accounts, baseEvents, scenarioEvents, scenario, today, endDate]);

  const baseEndBalance =
    baseProjection.dataPoints[baseProjection.dataPoints.length - 1]?.balance ?? 0;
  const scenarioEndBalance =
    scenarioProjection.dataPoints[scenarioProjection.dataPoints.length - 1]
      ?.balance ?? 0;
  const difference = scenarioEndBalance - baseEndBalance;

  // Handlers
  function handleExclude(eventId: string) {
    startTransition(async () => {
      const existing = scenarioEventByEventId.get(eventId);
      if (existing) {
        await removeScenarioEvent(existing.id);
      } else {
        await addScenarioEvent({
          scenarioId: scenario.id,
          eventId,
          action: "exclude",
        });
      }
      router.refresh();
    });
  }

  function handleModifySave(eventId: string) {
    const amount = parseFloat(modifyAmount);
    if (isNaN(amount)) return;

    startTransition(async () => {
      // Remove existing scenario event for this base event if any
      const existing = scenarioEventByEventId.get(eventId);
      if (existing) {
        await removeScenarioEvent(existing.id);
      }
      await addScenarioEvent({
        scenarioId: scenario.id,
        eventId,
        action: "modify",
        amount,
      });
      setModifyEventId(null);
      setModifyAmount("");
      router.refresh();
    });
  }

  function handleAddEvent() {
    const amount = parseFloat(addForm.amount);
    if (!addForm.name.trim() || isNaN(amount) || !addForm.accountId) return;

    startTransition(async () => {
      await addScenarioEvent({
        scenarioId: scenario.id,
        action: "add",
        name: addForm.name.trim(),
        amount,
        eventType: addForm.eventType,
        accountId: addForm.accountId,
        eventDate: today,
        isRecurring: addForm.isRecurring,
        recurrenceRule: addForm.isRecurring
          ? {
              frequency: addForm.frequency,
              interval: 1,
              day_of_month: parseInt(addForm.dayOfMonth) || 1,
            }
          : undefined,
      });
      setAddForm({
        name: "",
        amount: "",
        eventType: "expense",
        accountId: accounts[0]?.id ?? "",
        isRecurring: false,
        frequency: "monthly",
        dayOfMonth: "1",
      });
      setShowAddEvent(false);
      router.refresh();
    });
  }

  function handleSaveAdjustments() {
    const parsed: Record<string, number> = {};
    let hasAdjustment = false;
    for (const account of accounts) {
      const val = parseFloat(adjustments[account.id]);
      if (!isNaN(val) && val !== 0) {
        parsed[account.id] = val;
        hasAdjustment = true;
      }
    }

    startTransition(async () => {
      await updateScenario(scenario.id, {
        balanceAdjustments: hasAdjustment ? parsed : null,
      });
      router.refresh();
    });
  }

  const addedEvents = scenarioEvents.filter((se) => se.action === "add");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link
              href="/scenarios"
              className="text-sm text-muted-foreground hover:text-foreground/80"
            >
              Scenarios
            </Link>
            <span className="text-sm text-muted-foreground/70">/</span>
          </div>
          <h1 className="text-2xl font-bold">{scenario.name}</h1>
          {scenario.description && (
            <p className="text-sm text-muted-foreground">{scenario.description}</p>
          )}
        </div>
      </div>

      {/* A. Projection Comparison */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current (90-day)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(baseEndBalance)}</p>
            <p className="text-xs text-muted-foreground/70">Ending balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scenario (90-day)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(scenarioEndBalance)}
            </p>
            <p className="text-xs text-muted-foreground/70">Ending balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                difference > 0
                  ? "text-green-600"
                  : difference < 0
                    ? "text-red-600"
                    : ""
              }`}
            >
              {difference >= 0 ? "+" : ""}
              {formatCurrency(difference)}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {difference > 0
                ? "Better off"
                : difference < 0
                  ? "Worse off"
                  : "No change"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* B. Base Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Base Events</CardTitle>
        </CardHeader>
        <CardContent>
          {baseEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active events.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Frequency</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {baseEvents.map((event) => {
                    const isExcluded = excludedEventIds.has(event.id);
                    const modification = modifiedEvents.get(event.id);
                    const displayAmount = modification?.amount ?? event.amount;

                    return (
                      <tr
                        key={event.id}
                        className={`border-b ${isExcluded ? "text-muted-foreground/70 line-through" : ""}`}
                      >
                        <td className="py-2">{event.name}</td>
                        <td className="py-2">
                          <Badge
                            variant={
                              event.event_type === "income"
                                ? "default"
                                : "destructive"
                            }
                            className={
                              event.event_type === "income"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : ""
                            }
                          >
                            {event.event_type}
                          </Badge>
                        </td>
                        <td className="py-2">
                          {formatCurrency(displayAmount)}
                          {modification && (
                            <span className="ml-1 text-xs text-blue-600">
                              (modified)
                            </span>
                          )}
                        </td>
                        <td className="py-2">
                          {event.is_recurring && event.recurrence_rule
                            ? FREQUENCY_LABELS[event.recurrence_rule.frequency]
                            : "One-time"}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => handleExclude(event.id)}
                            disabled={isPending}
                            className="cursor-pointer"
                          >
                            <Badge
                              variant={isExcluded ? "destructive" : "default"}
                              className={
                                isExcluded
                                  ? ""
                                  : "bg-green-100 text-green-800 hover:bg-green-200"
                              }
                            >
                              {isExcluded ? "Excluded" : "Included"}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-2">
                          {!isExcluded && (
                            <>
                              {modifyEventId === event.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={modifyAmount}
                                    onChange={(e) =>
                                      setModifyAmount(e.target.value)
                                    }
                                    className="h-7 w-24"
                                    placeholder="Amount"
                                  />
                                  <Button
                                    size="sm"
                                    className="h-7"
                                    disabled={isPending}
                                    onClick={() => handleModifySave(event.id)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7"
                                    onClick={() => {
                                      setModifyEventId(null);
                                      setModifyAmount("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7"
                                  onClick={() => {
                                    setModifyEventId(event.id);
                                    setModifyAmount(
                                      String(modification?.amount ?? event.amount)
                                    );
                                  }}
                                >
                                  Modify
                                </Button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Added Scenario Events */}
      {addedEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scenario-Only Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {addedEvents.map((se) => (
                <div
                  key={se.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <span className="font-medium">{se.name}</span>
                    <Badge
                      variant={
                        se.event_type === "income" ? "default" : "destructive"
                      }
                      className={`ml-2 ${
                        se.event_type === "income"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : ""
                      }`}
                    >
                      {se.event_type}
                    </Badge>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {se.amount != null ? formatCurrency(se.amount) : ""}
                    </span>
                    {se.is_recurring && se.recurrence_rule && (
                      <span className="ml-2 text-xs text-muted-foreground/70">
                        {FREQUENCY_LABELS[se.recurrence_rule.frequency]}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        await removeScenarioEvent(se.id);
                        router.refresh();
                      });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* C. Add Event Section */}
      <Card>
        <CardHeader>
          <CardTitle>Add Scenario Event</CardTitle>
        </CardHeader>
        <CardContent>
          {!showAddEvent ? (
            <Button variant="outline" onClick={() => setShowAddEvent(true)}>
              Add Scenario Event
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="add-name">Name</Label>
                  <Input
                    id="add-name"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm({ ...addForm, name: e.target.value })
                    }
                    placeholder="Event name"
                  />
                </div>
                <div>
                  <Label htmlFor="add-amount">Amount</Label>
                  <Input
                    id="add-amount"
                    type="number"
                    step="0.01"
                    value={addForm.amount}
                    onChange={(e) =>
                      setAddForm({ ...addForm, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="add-type">Type</Label>
                  <select
                    id="add-type"
                    className={SELECT_CLASS}
                    value={addForm.eventType}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        eventType: e.target.value as EventType,
                      })
                    }
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="add-account">Account</Label>
                  <select
                    id="add-account"
                    className={SELECT_CLASS}
                    value={addForm.accountId}
                    onChange={(e) =>
                      setAddForm({ ...addForm, accountId: e.target.value })
                    }
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="add-recurring"
                  type="checkbox"
                  checked={addForm.isRecurring}
                  onChange={(e) =>
                    setAddForm({ ...addForm, isRecurring: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="add-recurring">Is recurring</Label>
              </div>
              {addForm.isRecurring && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="add-frequency">Frequency</Label>
                    <select
                      id="add-frequency"
                      className={SELECT_CLASS}
                      value={addForm.frequency}
                      onChange={(e) =>
                        setAddForm({
                          ...addForm,
                          frequency: e.target.value as
                            | "monthly"
                            | "quarterly"
                            | "yearly",
                        })
                      }
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="add-day">Day of Month</Label>
                    <Input
                      id="add-day"
                      type="number"
                      min="1"
                      max="31"
                      value={addForm.dayOfMonth}
                      onChange={(e) =>
                        setAddForm({ ...addForm, dayOfMonth: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleAddEvent}
                  disabled={
                    isPending || !addForm.name.trim() || !addForm.amount
                  }
                >
                  {isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddEvent(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* D. Balance Adjustments */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Adjustments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Adjust starting balances for this scenario (positive to add, negative
            to subtract).
          </p>
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-4 rounded border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Current: {formatCurrency(account.current_balance)}
                  </p>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    value={adjustments[account.id]}
                    onChange={(e) =>
                      setAdjustments({
                        ...adjustments,
                        [account.id]: e.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={handleSaveAdjustments} disabled={isPending}>
              {isPending ? "Saving..." : "Save Adjustments"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
