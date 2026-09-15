"use client";

import { useActionState } from "react";
import { Button, Callout, Card } from "@/components/ui";
import { submitApplication } from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";

export function SubmitApplication() {
  const [state, formAction, pending] = useActionState(submitApplication, idleState);

  return (
    <Card>
      <h2 className="text-sm font-bold text-ink">Submit your application</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        DexaFit will verify your credentials and insurance. After you submit, edits to
        verified credentials send that section back for re-review.
      </p>

      {state.message && !state.ok ? (
        <div className="mt-4">
          <Callout tone="danger" title="Not ready to submit">
            {state.message}
          </Callout>
        </div>
      ) : null}

      <form action={formAction} className="mt-5 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </Card>
  );
}
