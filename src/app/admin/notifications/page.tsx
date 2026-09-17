import { Badge, Callout, Card, SectionHeading } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readEmailConfig } from "@/lib/email/config";
import { TestNotificationButton } from "./test-button";

export default async function NotificationSettings() {
  await requireAdmin();
  const configResult = readEmailConfig();

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Notifications"
        description="Who gets told when a professional submits an application."
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">Submission emails</h2>
          <Badge tone={configResult.configured ? "success" : "warning"}>
            {configResult.configured ? "Configured" : "Not configured"}
          </Badge>
        </div>

        {configResult.configured ? (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">Recipients</dt>
            <dd className="font-medium text-ink">
              {configResult.config.adminRecipients.join(", ")}
            </dd>
            <dt className="text-muted">Sent from</dt>
            <dd className="font-medium text-ink">{configResult.config.from}</dd>
            <dt className="text-muted">Links point to</dt>
            <dd className="font-medium text-ink">{configResult.config.appUrl}</dd>
          </dl>
        ) : (
          <div className="mt-4">
            <Callout tone="warning" title="No submission emails are going out">
              {configResult.reason} Applications are still received and queued
              normally — only the notification is missing.
            </Callout>
          </div>
        )}

        <div className="mt-6">
          <TestNotificationButton />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-bold text-ink">What a notification contains</h2>
        <p className="mt-2 text-sm text-muted">
          Name, profession, jurisdiction, contact address, submission time, and
          whether submission flagged the application for manual review — plus a
          link to the review page. Credential numbers, uploaded documents and
          compliance disclosure answers are deliberately left out, because email
          is not a confidential channel.
        </p>
      </Card>
    </div>
  );
}
