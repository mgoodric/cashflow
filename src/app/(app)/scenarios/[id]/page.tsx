import { getScenarioWithEvents } from "@/actions/scenarios";
import { ScenarioDetail } from "@/components/scenarios/scenario-detail";

interface ScenarioPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScenarioPage({ params }: ScenarioPageProps) {
  const { id } = await params;
  const { scenario, events, baseEvents, accounts } =
    await getScenarioWithEvents(id);

  return (
    <div>
      <ScenarioDetail
        scenario={scenario}
        scenarioEvents={events}
        baseEvents={baseEvents}
        accounts={accounts}
      />
    </div>
  );
}
