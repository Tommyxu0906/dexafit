import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrCreateProfessional } from "@/lib/data/professional";
import { ONBOARDING_STEPS } from "@/lib/domain/steps";

/** Resumes at the first incomplete step, so a refresh never loses the thread. */
export default async function OnboardingIndex() {
  const user = await requireUser();
  const { application } = await getOrCreateProfessional(user.id);

  if (application.status !== "DRAFT") {
    redirect("/professionals/onboarding/status");
  }

  const completed = new Set(application.completed_steps);
  const next = ONBOARDING_STEPS.find((s) => !completed.has(s.slug)) ?? ONBOARDING_STEPS[0];
  redirect(`/professionals/onboarding/${next.slug}`);
}
