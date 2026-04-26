import Link from "next/link";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function InsightsPage() {
  const user = await requireUser();

  const [result] = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.userId, user.id));

  const transactionCount = result?.count ?? 0;

  const features = [
    {
      title: "Analyze Quicken Data",
      description:
        "Upload Quicken CSV exports to discover recurring patterns and spending trends without importing transactions. Find what's missing from your forecasting.",
      href: "/insights/analyze",
      context: "No import required",
    },
    {
      title: "Detect Recurring Patterns",
      description:
        "Analyze your transaction history to find recurring payments and income. Convert detected patterns into cashflow events for accurate forecasting.",
      href: "/insights/recurring",
      context: `Based on ${transactionCount} transactions`,
    },
    {
      title: "Audit Categories",
      description:
        "Review transactions that may be miscategorized based on payee patterns and amount analysis. Fix inconsistencies in bulk.",
      href: "/insights/categories",
      context: `Scanning ${transactionCount} transactions`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Analyze your transaction data for patterns and improvements
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.href}>
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{feature.context}</span>
                <Link href={feature.href}>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
