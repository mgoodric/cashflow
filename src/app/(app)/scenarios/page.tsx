import { getScenarios } from "@/actions/scenarios";
import { ScenarioList } from "@/components/scenarios/scenario-list";

export default async function ScenariosPage() {
  const scenarios = await getScenarios();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Scenarios</h1>
        <p className="text-sm text-muted-foreground">
          Compare what-if financial scenarios
        </p>
      </div>

      <ScenarioList scenarios={scenarios} />
    </div>
  );
}
