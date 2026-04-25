import { getExistingEvents } from "@/actions/insights";
import { CsvAnalyzer } from "@/components/insights/csv-analyzer";

export default async function AnalyzePage() {
  const existingEvents = await getExistingEvents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analyze Quicken Data</h1>
        <p className="text-sm text-gray-500">
          Upload CSV exports from Quicken to discover recurring patterns and spending trends without importing transactions
        </p>
      </div>

      <CsvAnalyzer existingEvents={existingEvents} />
    </div>
  );
}
