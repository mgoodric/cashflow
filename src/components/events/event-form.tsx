"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurrenceFields } from "./recurrence-fields";
import { SELECT_CLASS } from "@/lib/constants";
import type { Account, Category, CashflowEvent, LoanConfig, RecurrenceRule } from "@/lib/types/database";

interface EventPrefill {
  name?: string;
  amount?: number;
  event_type?: "income" | "expense";
  is_recurring?: boolean;
  frequency?: "monthly" | "quarterly" | "yearly";
  day_of_month?: number;
  account_id?: string;
}

interface EventFormProps {
  event?: CashflowEvent;
  accounts: Account[];
  categories?: Category[];
  action: (formData: FormData) => void;
  title: string;
  prefill?: EventPrefill;
}

export function EventForm({ event, accounts, categories = [], action, title, prefill }: EventFormProps) {
  const [isRecurring, setIsRecurring] = useState(
    event?.is_recurring ?? prefill?.is_recurring ?? false
  );
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(
    event?.recurrence_rule ?? {
      frequency: prefill?.frequency ?? "monthly",
      interval: 1,
      day_of_month: prefill?.day_of_month ?? 1,
    }
  );
  const [eventType, setEventType] = useState(
    event?.event_type ?? prefill?.event_type ?? "expense"
  );
  const [categoryId, setCategoryId] = useState(event?.category_id ?? "");
  const [isLoan, setIsLoan] = useState(!!event?.loan_config);
  const [loanConfig, setLoanConfig] = useState<LoanConfig>(
    event?.loan_config ?? {
      annual_rate: 0,
      loan_type: "amortizing",
      extra_principal: 0,
      term_months: 360,
    }
  );

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
              defaultValue={event?.name ?? prefill?.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_id">Account</Label>
            <select
              id="account_id"
              name="account_id"
              defaultValue={event?.account_id ?? prefill?.account_id}
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
              defaultValue={event?.amount ?? prefill?.amount}
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

          {isRecurring && (
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isLoan}
                  onChange={(e) => setIsLoan(e.target.checked)}
                />
                <span className="text-sm font-medium">Loan payment (dynamic calculation)</span>
              </label>
            </div>
          )}

          {isLoan && (
            <>
              <input type="hidden" name="loan_config" value={JSON.stringify(loanConfig)} />
              <div className="space-y-4 rounded-md border p-4">
                <div className="space-y-2">
                  <Label htmlFor="annual_rate">APR (%)</Label>
                  <Input
                    id="annual_rate"
                    type="number"
                    step="0.001"
                    min="0"
                    value={loanConfig.annual_rate}
                    onChange={(e) =>
                      setLoanConfig({ ...loanConfig, annual_rate: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loan_type">Loan Type</Label>
                  <select
                    id="loan_type"
                    value={loanConfig.loan_type}
                    onChange={(e) =>
                      setLoanConfig({
                        ...loanConfig,
                        loan_type: e.target.value as LoanConfig["loan_type"],
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="interest_only">Interest Only</option>
                    <option value="amortizing">Amortizing</option>
                    <option value="fixed_principal">Fixed Principal</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extra_principal">Extra Principal per Payment</Label>
                  <Input
                    id="extra_principal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={loanConfig.extra_principal}
                    onChange={(e) =>
                      setLoanConfig({ ...loanConfig, extra_principal: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                {loanConfig.loan_type !== "interest_only" && (
                  <div className="space-y-2">
                    <Label htmlFor="term_months">Term (months)</Label>
                    <Input
                      id="term_months"
                      type="number"
                      step="1"
                      min="1"
                      value={loanConfig.term_months ?? 360}
                      onChange={(e) =>
                        setLoanConfig({ ...loanConfig, term_months: parseInt(e.target.value) || 360 })
                      }
                    />
                  </div>
                )}
              </div>
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
