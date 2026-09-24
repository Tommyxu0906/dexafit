import { requireUser } from "@/lib/auth";
import { getApplicationBundle, getOrCreateProfessional } from "@/lib/data/professional";
import { ProductsForm } from "./products-form";

/**
 * Products live outside onboarding.
 *
 * What a provider sells is not a credentialing question, and pinning it to a
 * wizard step meant they could not change a price later without walking back
 * through the application. This page stands alone; it will move onto the
 * provider's own profile once that exists.
 */
export default async function ProductsPage() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  return <ProductsForm services={bundle?.services ?? []} />;
}
