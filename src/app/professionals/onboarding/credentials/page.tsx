import Link from "next/link";
import { Callout, Card, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getApplicationBundle,
  getOrCreateProfessional,
  primaryJurisdiction,
} from "@/lib/data/professional";
import { DEFAULT_STATE } from "@/lib/domain/enums";
import { getRequirements } from "@/lib/domain/requirements";
import { CredentialsStep } from "./credentials-step";

export default async function CredentialsStepPage() {
  const user = await requireUser();
  const { profile } = await getOrCreateProfessional(user.id);
  const bundle = await getApplicationBundle(profile.id);

  if (!profile.profession_type || !bundle) {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title="Credentials" />
        <Card>
          <Callout tone="warning" title="Select your profession first">
            Your credential requirements depend on your profession.{" "}
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

  const jurisdiction = primaryJurisdiction(bundle) || DEFAULT_STATE;
  const requirements = getRequirements(profile.profession_type, jurisdiction);

  return (
    <CredentialsStep
      profile={profile}
      jurisdiction={jurisdiction}
      requirements={requirements}
      credentials={bundle.credentials}
      documents={bundle.documents}
    />
  );
}
