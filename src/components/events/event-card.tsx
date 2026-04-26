import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteEventButton } from "./delete-event-button";
import { FREQUENCY_LABELS } from "@/lib/constants";
import type { CashflowEvent } from "@/lib/types/database";

interface EventCardProps {
  event: CashflowEvent;
  categoryName?: string | null;
}

export function EventCard({ event, categoryName }: EventCardProps) {
  const isIncome = event.event_type === "income";
  const endDate = event.recurrence_rule?.end_date;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{event.name}</CardTitle>
        <div className="flex gap-2">
          <Badge variant={isIncome ? "default" : "destructive"}>
            {isIncome ? "Income" : "Expense"}
          </Badge>
          {event.is_recurring && event.recurrence_rule && (
            <Badge variant="secondary">
              {FREQUENCY_LABELS[event.recurrence_rule.frequency] || "Recurring"}
            </Badge>
          )}
          {event.loan_config && (
            <Badge variant="outline">Loan</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${isIncome ? "text-green-600" : "text-red-600"}`}>
              {isIncome ? "+" : "-"}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(event.amount)}
            </p>
            <p className="text-sm text-muted-foreground">
              {event.account?.name} &middot; {new Date(event.event_date + "T00:00:00").toLocaleDateString()}
              {endDate && (
                <> &middot; ends {new Date(endDate + "T00:00:00").toLocaleDateString()}</>
              )}
            </p>
            {categoryName && (
              <p className="text-xs text-muted-foreground/70 mt-1">{categoryName}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/events/${event.id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            <DeleteEventButton eventId={event.id} eventName={event.name} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
