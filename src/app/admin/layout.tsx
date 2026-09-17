import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/admin/professionals" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sm font-black text-ink">
              D
            </span>
            <span className="text-sm font-bold tracking-tight">
              DexaFit Credentialing
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/admin/professionals"
              className="text-xs font-semibold text-white/80 hover:text-white"
            >
              Queue
            </Link>
            <Link
              href="/admin/notifications"
              className="text-xs font-semibold text-white/80 hover:text-white"
            >
              Notifications
            </Link>
            <span className="text-xs text-white/70">{admin.email}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
