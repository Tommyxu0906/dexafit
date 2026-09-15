import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-20">
      <p className="text-xs font-bold uppercase tracking-widest text-accent-ink">
        DexaFit Professional Marketplace
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
        Join the network DexaFit sends its scanned customers to.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Trainers, dietitians, physical therapists, mental-health clinicians and physicians
        apply once. We verify credentials and insurance, then match you to customers whose
        DEXA results fit what you do.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={user ? "/professionals/onboarding" : "/login"}
          className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {user ? "Continue my application" : "Start an application"}
        </Link>
        {user?.role === "ADMIN" ? (
          <Link
            href="/admin/professionals"
            className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            Credentialing queue
          </Link>
        ) : null}
      </div>
    </main>
  );
}
