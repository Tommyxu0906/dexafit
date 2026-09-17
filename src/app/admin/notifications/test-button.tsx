"use client";

import { useActionState } from "react";
import { Button, Callout } from "@/components/ui";
import { sendTestNotification } from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/state";

export function TestNotificationButton() {
  const [state, formAction, pending] = useActionState(sendTestNotification, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send a test notification"}
      </Button>
      {state.message ? (
        <Callout tone={state.ok ? "success" : "danger"}>{state.message}</Callout>
      ) : null}
    </form>
  );
}
