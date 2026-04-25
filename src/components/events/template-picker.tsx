"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteTemplate } from "@/actions/templates";
import { FREQUENCY_LABELS } from "@/lib/constants";
import type { EventTemplate, RecurrenceRule } from "@/lib/types/database";

interface TemplatePickerProps {
  templates: EventTemplate[];
  onSelect: (template: EventTemplate) => void;
}

export function TemplatePicker({ templates, onSelect }: TemplatePickerProps) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      await deleteTemplate(id);
      setDeletingId(null);
    });
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <Card className="max-w-lg mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Event Templates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => onSelect(template)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{template.name}</span>
                  <span
                    className={`text-xs font-medium ${
                      template.event_type === "income"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    ${template.amount.toFixed(2)}
                  </span>
                  {template.is_recurring && template.recurrence_rule && (
                    <span className="text-xs text-muted-foreground">
                      {FREQUENCY_LABELS[template.recurrence_rule.frequency as RecurrenceRule["frequency"]]}
                    </span>
                  )}
                </div>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-7 px-2"
                onClick={() => handleDelete(template.id)}
                disabled={isPending && deletingId === template.id}
              >
                {isPending && deletingId === template.id ? "..." : "Delete"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
