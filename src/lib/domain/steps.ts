export const ONBOARDING_STEPS = [
  { slug: "about", title: "About you", index: 1 },
  { slug: "practice", title: "Practice", index: 2 },
  { slug: "credentials", title: "Credentials", index: 3 },
  { slug: "insurance", title: "Insurance & compliance", index: 4 },
  { slug: "who-you-help", title: "Who you help", index: 5 },
  { slug: "services", title: "Services & pricing", index: 6 },
  { slug: "locations", title: "Where you practice", index: 7 },
  { slug: "attestations", title: "Privacy & attestations", index: 8 },
  { slug: "review", title: "Review & submit", index: 9 },
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
