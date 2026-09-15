import Link from "next/link";
import { Callout, Card, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getApplicationBundle, getOrCreateProfessional } from "@/lib/data/professional";
import { CapabilitiesForm } from "./capabilities-form";

export default async function WhoYouHelpStep() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  if (!profile.profession_type) {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title="Who you help" />
        <Card>
          <Callout tone="warning" title="Select your profession first">
            The options here are limited to your scope of practice.{" "}
            <Link
              href="/professionals/onboarding/about"
              className="font-semibold underline underline-offset-2"
            >
              Go back to step 1
            </Link>
            .
          </Callout>
        </Card>
      </div>
    );
  }

  return (
    <CapabilitiesForm
      professionType={profile.profession_type}
      selected={(bundle?.capabilities ?? []).map((c) => c.capability_code)}
    />
  );
}
