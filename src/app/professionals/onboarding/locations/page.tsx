import { requireUser } from "@/lib/auth";
import { getApplicationBundle, getOrCreateProfessional } from "@/lib/data/professional";
import { LocationsStep } from "./locations-step";

export default async function LocationsStepPage() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  return (
    <LocationsStep
      professionTypes={profile.profession_types}
      locations={bundle?.locations ?? []}
      jurisdictions={bundle?.jurisdictions ?? []}
      credentials={bundle?.credentials ?? []}
    />
  );
}
