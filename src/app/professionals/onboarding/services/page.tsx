import { requireUser } from "@/lib/auth";
import { getApplicationBundle, getOrCreateProfessional } from "@/lib/data/professional";
import { ServicesStep } from "./services-step";

export default async function ServicesStepPage() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  return <ServicesStep services={bundle?.services ?? []} />;
}
