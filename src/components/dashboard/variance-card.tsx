"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CashflowEvent } from "@/lib/types/database";

interface VarianceCardProps {
  events: CashflowEvent[];
}

export function VarianceCard({ events }: VarianceCardProps) {
  const occurredEvents = events.filter(
    (e) => e.occurred_date != null && e.actual_amount != null
  );

  if (occurredEvents.length === 0) return null;

  const format = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const variances = occurredEvents.map((e) => ({
    id: e.id,
    name: e.name,
    projected: e.amount,
    actual: e.actual_amount!,
    variance: e.actual_amount! - e.amount,
    occurredDate: e.occurred_date!,
  }));

  // Sort by most recent occurred date
  variances.sort((a, b) => b.occurredDate.localeCompare(a.occurredDate));

  const totalVariance = variances.reduce((sum, v) => sum + v.variance, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Variance Tracking</span>
          <span className={`text-lg font-bold ${totalVariance > 0 ? "text-red-600" : totalVariance < 0 ? "text-green-600" : ""}`}>
            {totalVariance > 0 ? "+" : ""}
            {format(totalVariance)} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Event</th>
                <th className="pb-2 font-medium text-right">Projected</th>
                <th className="pb-2 font-medium text-right">Actual</th>
                <th className="pb-2 font-medium text-right">Variance</th>
                <th className="pb-2 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {variances.slice(0, 20).map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="py-2">{v.name}</td>
                  <td className="py-2 text-right">{format(v.projected)}</td>
                  <td className="py-2 text-right">{format(v.actual)}</td>
                  <td className={`py-2 text-right font-medium ${v.variance > 0 ? "text-red-600" : v.variance < 0 ? "text-green-600" : ""}`}>
                    {v.variance > 0 ? "+" : ""}
                    {format(v.variance)}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {new Date(v.occurredDate + "T00:00:00").toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
