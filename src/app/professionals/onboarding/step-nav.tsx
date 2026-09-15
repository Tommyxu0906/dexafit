"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ONBOARDING_STEPS } from "@/lib/domain/steps";

export function StepNav({ completedSteps }: { completedSteps: string[] }) {
  const pathname = usePathname();
  const completed = new Set(completedSteps);

  return (
    <nav aria-label="Onboarding steps">
      <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ONBOARDING_STEPS.map((step) => {
          const href = `/professionals/onboarding/${step.slug}`;
          const isCurrent = pathname === href;
          const isDone = completed.has(step.slug);

          return (
            <li key={step.slug} className="shrink-0">
              <Link
                href={href}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                  isCurrent
                    ? "bg-ink font-semibold text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? "bg-white/20 text-white"
                      : isDone
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isDone && !isCurrent ? "✓" : step.index}
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">
                  {step.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
