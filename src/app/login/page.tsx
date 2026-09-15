import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-accent-ink">
          DexaFit Professional Marketplace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll email you a secure sign-in link. Use the same address each time so
          your application picks up where you left off.
        </p>
      </div>
      <LoginForm next={next ?? "/professionals/onboarding"} />
    </main>
  );
}
