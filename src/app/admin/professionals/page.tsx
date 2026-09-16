import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { PROFESSION_LABELS, type ProfessionType } from "@/lib/domain/enums";
import { createClient } from "@/lib/supabase/server";

type QueueRow = {
  id: string;
  status: string;
  submitted_at: string | null;
  manual_review_required: boolean;
  professional_profiles: {
    id: string;
    display_name: string | null;
    legal_first_name: string | null;
    legal_last_name: string | null;
    profession_type: ProfessionType | null;
    marketplace_status: string;
  } | null;
};

function isExpired(date: string | null): boolean {
  return date ? new Date(`${date}T23:59:59Z`).getTime() < Date.now() : false;
}

export default async function AdminProfessionalsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("professional_applications")
    .select(
      `id, status, submitted_at, manual_review_required,
       professional_profiles!inner (
         id, display_name, legal_first_name, legal_last_name,
         profession_type, marketplace_status
       )`,
    )
    // A draft has not been submitted to anyone, so it is not review work. It
    // also keeps a reviewer's own account out of their queue: signing in lands
    // on the provider wizard, which opens a draft for whoever arrives.
    .neq("status", "DRAFT")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  const rows = (applications ?? []) as unknown as QueueRow[];

  const professionalIds = rows
    .map((r) => r.professional_profiles?.id)
    .filter((id): id is string => Boolean(id));

  const [{ data: credentials }, { data: policies }] = await Promise.all([
    supabase
      .from("credentials")
      .select("professional_id, verification_status, expiration_date")
      .in("professional_id", professionalIds.length ? professionalIds : ["none"]),
    supabase
      .from("insurance_policies")
      .select("professional_id, status, expiration_date")
      .in("professional_id", professionalIds.length ? professionalIds : ["none"]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Professionals</h1>
        <p className="mt-1 text-sm text-muted">
          {rows.length} submitted application{rows.length === 1 ? "" : "s"}. Drafts are
          not shown until the professional submits them.
        </p>
      </div>

      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState>No submitted applications yet.</EmptyState>
          </div>
        ) : (
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Profession</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Credentials</th>
                <th className="px-5 py-3 font-semibold">Insurance</th>
                <th className="px-5 py-3 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const profile = row.professional_profiles;
                const professionalCredentials = (credentials ?? []).filter(
                  (c) => c.professional_id === profile?.id,
                );
                const verified = professionalCredentials.filter(
                  (c) => c.verification_status === "VERIFIED",
                ).length;
                const expiredCredential = professionalCredentials.some((c) =>
                  isExpired(c.expiration_date),
                );
                const professionalPolicies = (policies ?? []).filter(
                  (p) => p.professional_id === profile?.id,
                );
                const currentPolicy = professionalPolicies.some(
                  (p) => !isExpired(p.expiration_date) && p.status !== "REJECTED",
                );

                return (
                  <tr key={row.id} className="border-b border-line last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/professionals/${row.id}`}
                        className="font-semibold text-ink underline-offset-2 hover:underline"
                      >
                        {profile?.display_name ||
                          `${profile?.legal_first_name ?? ""} ${profile?.legal_last_name ?? ""}`.trim() ||
                          "Unnamed applicant"}
                      </Link>
                      {row.manual_review_required ? (
                        <div className="mt-1">
                          <Badge tone="warning">Manual review</Badge>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {profile?.profession_type
                        ? PROFESSION_LABELS[profile.profession_type]
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          row.status === "APPROVED"
                            ? "success"
                            : row.status === "REJECTED" || row.status === "SUSPENDED"
                              ? "danger"
                              : row.status === "DRAFT"
                                ? "neutral"
                                : "info"
                        }
                      >
                        {row.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {verified}/{professionalCredentials.length} verified
                      {expiredCredential ? (
                        <span className="ml-2">
                          <Badge tone="danger">Expired</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      {professionalPolicies.length === 0 ? (
                        <Badge tone="warning">None</Badge>
                      ) : currentPolicy ? (
                        <Badge tone="success">Current</Badge>
                      ) : (
                        <Badge tone="danger">Expired</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {row.submitted_at
                        ? new Date(row.submitted_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
