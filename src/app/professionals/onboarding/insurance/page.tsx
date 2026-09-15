import { requireUser } from "@/lib/auth";
import { getApplicationBundle, getOrCreateProfessional } from "@/lib/data/professional";
import { InsuranceStep } from "./insurance-step";

export default async function InsuranceStepPage() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  return (
    <InsuranceStep
      policies={bundle?.insurancePolicies ?? []}
      disclosures={bundle?.disclosures ?? []}
      documents={bundle?.documents ?? []}
    />
  );
}
