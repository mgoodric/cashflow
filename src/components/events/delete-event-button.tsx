"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteEvent } from "@/actions/events";

interface DeleteEventButtonProps {
  eventId: string;
  eventName: string;
}

export function DeleteEventButton({ eventId, eventName }: DeleteEventButtonProps) {
  return (
    <ConfirmDialog
      title="Delete Event"
      description={`Are you sure you want to delete "${eventName}"? This action cannot be undone.`}
      onConfirm={() => deleteEvent(eventId)}
      trigger={
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      }
    />
  );
}
