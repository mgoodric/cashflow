import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function InsightsPage() {
  const supabase = await createClient();

  const { count: transactionCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true });

  const features = [
    {
      title: "Detect Recurring Patterns",
      description:
        "Analyze your transaction history to find recurring payments and income. Convert detected patterns into cashflow events for accurate forecasting.",
      href: "/insights/recurring",
      context: `Based on ${transactionCount ?? 0} transactions`,
    },
    {
      title: "Audit Categories",
      description:
        "Review transactions that may be miscategorized based on payee patterns and amount analysis. Fix inconsistencies in bulk.",
      href: "/insights/categories",
      context: `Scanning ${transactionCount ?? 0} transactions`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-gray-500">
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
                <span className="text-xs text-gray-400">{feature.context}</span>
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
