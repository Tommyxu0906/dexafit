import Link from "next/link";
import { Badge, Callout, Card, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getApplicationBundle,
  getOrCreateProfessional,
  primaryJurisdiction,
  toReadinessInput,
} from "@/lib/data/professional";
import { computePreApprovalReadiness } from "@/lib/domain/readiness";
import { createClient } from "@/lib/supabase/server";
import type { ReviewEventRow } from "@/lib/data/types";

const STATUS_COPY: Record<string, { tone: "info" | "success" | "warning" | "danger"; text: string }> = {
  SUBMITTED: { tone: "info", text: "Received. A DexaFit reviewer will start verification shortly." },
  CREDENTIAL_REVIEW: { tone: "info", text: "We are verifying your credentials with the issuing authorities." },
  COMPLIANCE_REVIEW: { tone: "info", text: "Your compliance disclosures are under review." },
  NEEDS_INFORMATION: { tone: "warning", text: "We need more information before we can continue." },
  APPROVED: { tone: "success", text: "You're approved and eligible for the DexaFit marketplace." },
  REJECTED: { tone: "danger", text: "This application was not approved." },
  SUSPENDED: { tone: "danger", text: "Your listing is suspended." },
  EXPIRED: { tone: "warning", text: "A required credential or policy has expired." },
};

export default async function StatusPage() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  if (!bundle) return null;

  const { application } = bundle;
  const copy = STATUS_COPY[application.status];
  const readiness = computePreApprovalReadiness(
    toReadinessInput(bundle, primaryJurisdiction(bundle)),
  );

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("application_review_events")
    .select("*")
    .eq("application_id", application.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title="Application status" />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Current status
            </p>
            <p className="mt-1 text-xl font-bold text-ink">
              {application.status.replace(/_/g, " ").toLowerCase()}
            </p>
          </div>
          <Badge tone={profile.marketplace_status === "ACTIVE" ? "success" : "neutral"}>
            Marketplace {profile.marketplace_status.toLowerCase()}
          </Badge>
        </div>
        {copy ? (
          <div className="mt-4">
            <Callout tone={copy.tone}>{copy.text}</Callout>
          </div>
        ) : null}
        {application.admin_notes ? (
          <div className="mt-4">
            <Callout tone="warning" title="Note from DexaFit">
              {application.admin_notes}
            </Callout>
          </div>
        ) : null}
      </Card>

      {readiness.blockers.length > 0 ? (
        <Card>
          <h2 className="text-sm font-bold text-ink">Outstanding items</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {readiness.blockers
              .filter((b) => b.code !== "NOT_ADMIN_APPROVED")
              .map((blocker) => (
                <li key={blocker.code + blocker.message} className="text-sm text-muted">
                  · {blocker.message}
                </li>
              ))}
          </ul>
          <Link
            href="/professionals/onboarding/credentials"
            className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline underline-offset-2"
          >
            Update my application
          </Link>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-bold text-ink">History</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {(events as ReviewEventRow[] | null)?.map((event) => (
            <li key={event.id} className="text-sm">
              <span className="font-medium text-ink">
                {event.event_type.replace(/_/g, " ").toLowerCase()}
              </span>
              <span className="ml-2 text-xs text-muted">
                {new Date(event.created_at).toLocaleString()}
              </span>
              {event.note ? <p className="mt-0.5 text-xs text-muted">{event.note}</p> : null}
            </li>
          )) ?? null}
        </ul>
      </Card>
    </div>
  );
}
