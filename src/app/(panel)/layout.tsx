import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MobileNav, NavLinks } from "@/components/nav";
import { logout } from "@/app/login/actions";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const bots = await prisma.bot.findMany({
    where: user.role === "OWNER" ? {} : { ownerId: user.id },
    select: { id: true, name: true, username: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-ink-600 bg-ink-900 md:flex">
        <div className="border-b border-ink-600 px-5 py-4">
          <Link href="/" className="font-display text-lg font-bold tracking-tight">
            Botlar
          </Link>
          <div className="eyebrow mt-0.5">Boshqaruv paneli</div>
        </div>

        <NavLinks bots={bots} />

        <div className="mt-auto border-t border-ink-600 px-4 py-3">
          <div className="truncate text-xs text-muted">{user.name}</div>
          <div className="truncate font-mono text-[11px] text-faint">{user.email}</div>
          <form action={logout} className="mt-2">
            <button
              type="submit"
              className="text-xs text-faint transition-colors hover:text-rose"
            >
              Chiqish
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-ink-600 bg-ink-900 px-4 py-3 md:hidden">
          <MobileNav
            bots={bots}
            userName={user.name}
            userEmail={user.email}
            logoutAction={logout}
          />
          <Link href="/" className="font-display font-bold">
            Botlar
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-7 md:px-8 md:py-9">{children}</main>
      </div>
    </div>
  );
}
