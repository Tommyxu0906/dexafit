import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrCreateProfessional } from "@/lib/data/professional";
import { ONBOARDING_STEPS } from "@/lib/domain/steps";
import { StepNav } from "./step-nav";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const { application } = await getOrCreateProfessional(user.id);

  const completed = new Set(application.completed_steps);
  const completedCount = ONBOARDING_STEPS.filter((s) => completed.has(s.slug)).length;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-sm font-black text-white">
              D
            </span>
            <span className="text-sm font-bold tracking-tight text-ink">
              DexaFit Professional Marketplace
            </span>
          </Link>
          <span className="text-xs text-muted">{user.email}</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:flex-row">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>Application progress</span>
              <span>
                {completedCount}/{ONBOARDING_STEPS.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{
                  width: `${(completedCount / ONBOARDING_STEPS.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <StepNav completedSteps={application.completed_steps} />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
