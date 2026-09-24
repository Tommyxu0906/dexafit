/**
 * Onboarding asks what credentialing needs and nothing else.
 *
 * Two steps were removed rather than reordered:
 *
 *   Products & pricing  is not a credentialing question. A provider fills it in
 *                       on their own profile once they are approved, where they
 *                       can change prices without re-entering the wizard.
 *
 *   Where you practice  duplicated the Practice step, which already asks for a
 *                       business address. That address is now stored for every
 *                       provider rather than only for organisations, so nothing
 *                       is lost by dropping the second question.
 */
export const ONBOARDING_STEPS = [
  { slug: "about", title: "About you", index: 1 },
  { slug: "practice", title: "Practice", index: 2 },
  { slug: "credentials", title: "Credentials", index: 3 },
  { slug: "insurance", title: "Insurance & compliance", index: 4 },
  { slug: "who-you-help", title: "Who you help", index: 5 },
  { slug: "attestations", title: "Privacy & attestations", index: 6 },
  { slug: "review", title: "Review & submit", index: 7 },
] as const;

export type StepSlug = (typeof ONBOARDING_STEPS)[number]["slug"];

export const STEP_SLUGS = ONBOARDING_STEPS.map((s) => s.slug) as StepSlug[];

export function nextStep(slug: StepSlug): StepSlug | null {
  const i = STEP_SLUGS.indexOf(slug);
  return i >= 0 && i < STEP_SLUGS.length - 1 ? STEP_SLUGS[i + 1] : null;
}

export function previousStep(slug: StepSlug): StepSlug | null {
  const i = STEP_SLUGS.indexOf(slug);
  return i > 0 ? STEP_SLUGS[i - 1] : null;
}

export function isStepSlug(value: string): value is StepSlug {
  return (STEP_SLUGS as string[]).includes(value);
}
