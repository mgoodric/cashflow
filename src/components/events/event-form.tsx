"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurrenceFields } from "./recurrence-fields";
import { SELECT_CLASS } from "@/lib/constants";
import type { Account, Category, CashflowEvent, RecurrenceRule } from "@/lib/types/database";

interface EventFormProps {
  event?: CashflowEvent;
  accounts: Account[];
  categories?: Category[];
  action: (formData: FormData) => void;
  title: string;
}

const defaultRule: RecurrenceRule = {
  frequency: "monthly",
  interval: 1,
  day_of_month: 1,
};

export function EventForm({ event, accounts, categories = [], action, title }: EventFormProps) {
  const [isRecurring, setIsRecurring] = useState(event?.is_recurring ?? false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(
    event?.recurrence_rule ?? defaultRule
  );
  const [eventType, setEventType] = useState(event?.event_type ?? "expense");
  const [categoryId, setCategoryId] = useState(event?.category_id ?? "");

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Event Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={event?.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_id">Account</Label>
            <select
              id="account_id"
              name="account_id"
              defaultValue={event?.account_id}
              required
              className={SELECT_CLASS}
            >
              <option value="">Select account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category_id">Category (optional)</Label>
            <select
              id="category_id"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <input type="hidden" name="category_id" value={categoryId} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="event_type"
                  value="income"
                  checked={eventType === "income"}
                  onChange={() => setEventType("income")}
                />
                <span className="text-sm text-green-600 font-medium">Income</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="event_type"
                  value="expense"
                  checked={eventType === "expense"}
                  onChange={() => setEventType("expense")}
                />
                <span className="text-sm text-red-600 font-medium">Expense</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={event?.amount}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event_date">Date</Label>
            <Input
              id="event_date"
              name="event_date"
              type="date"
              defaultValue={event?.event_date}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <span className="text-sm font-medium">Recurring event</span>
            </label>
          </div>

          <input type="hidden" name="is_recurring" value={isRecurring.toString()} />
          {isRecurring && (
            <>
              <input type="hidden" name="recurrence_rule" value={JSON.stringify(recurrenceRule)} />
              <RecurrenceFields rule={recurrenceRule} onChange={setRecurrenceRule} />
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={event?.notes ?? ""}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit">
              {event ? "Update Event" : "Create Event"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
