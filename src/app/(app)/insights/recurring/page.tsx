import { analyzeRecurringPatterns } from "@/actions/insights";
import { RecurringList } from "@/components/insights/recurring-list";

export default async function RecurringPatternsPage() {
  const patterns = await analyzeRecurringPatterns();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recurring Patterns</h1>
        <p className="text-sm text-muted-foreground">
          Detected recurring transactions that can be converted into cashflow events
        </p>
      </div>

      <RecurringList patterns={patterns} />
    </div>
  );
}
