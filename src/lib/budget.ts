import type { Category, CashflowEvent } from "@/lib/types/database";

export interface CategoryBudgetStatus {
  category: Category;
  spending: number;
  percentage: number;
  status: "under" | "warning" | "over";
}

export function computeBudgetStatuses(
  cats: Category[],
  evts: CashflowEvent[]
): CategoryBudgetStatus[] {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));

  const budgetedCategories = cats.filter((c) => c.budget_limit !== null);

  return budgetedCategories.map((cat) => {
    const spending = computeCategorySpending(cat.id, evts, monthStart, monthEnd);
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
}

function computeCategorySpending(
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
  const endDate = rule.end_date ? new Date(rule.end_date + "T00:00:00Z") : null;

  let next: Date;

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
