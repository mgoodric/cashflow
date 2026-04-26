"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Scenario } from "@/lib/types/database";
import { createScenario, deleteScenario } from "@/actions/scenarios";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScenarioListProps {
  scenarios: Scenario[];
}

export function ScenarioList({ scenarios }: ScenarioListProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim()) return;

    startTransition(async () => {
      await createScenario({ name: name.trim(), description: description.trim() || undefined });
      setName("");
      setDescription("");
      setShowCreate(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    setDeleteId(id);
    startTransition(async () => {
      await deleteScenario(id);
      setConfirmDeleteId(null);
      setDeleteId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {!showCreate ? (
        <Button onClick={() => setShowCreate(true)}>Create Scenario</Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create Scenario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="scenario-name">Name</Label>
                <Input
                  id="scenario-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Job Change Scenario"
                  required
                />
              </div>
              <div>
                <Label htmlFor="scenario-desc">Description (optional)</Label>
                <textarea
                  id="scenario-desc"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this scenario models..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
                  {isPending ? "Creating..." : "Submit"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setName("");
                    setDescription("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No scenarios yet. Create one to start modeling what-if financial outcomes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{scenario.name}</h3>
                  {scenario.description && (
                    <p className="text-sm text-muted-foreground">{scenario.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70">
                    Created {formatDate(scenario.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/scenarios/${scenario.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className={
                      confirmDeleteId === scenario.id
                        ? "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                        : ""
                    }
                    disabled={deleteId === scenario.id}
                    onClick={() => handleDelete(scenario.id)}
                  >
                    {deleteId === scenario.id
                      ? "Deleting..."
                      : confirmDeleteId === scenario.id
                        ? "Confirm Delete"
                        : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
