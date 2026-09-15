import { requireUser } from "@/lib/auth";
import { getApplicationBundle, getOrCreateProfessional } from "@/lib/data/professional";
import { AttestationsForm } from "./attestations-form";

export default async function AttestationsStepPage() {
  const user = await requireUser();
  const { profile, application } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  return (
    <AttestationsForm
      acceptedTypes={(bundle?.attestations ?? [])
        .filter((a) => a.accepted)
        .map((a) => a.attestation_type)}
      signature={application.electronic_signature}
      signatureDate={application.signature_date}
      legalName={[profile.legal_first_name, profile.legal_last_name]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
