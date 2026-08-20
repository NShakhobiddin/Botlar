"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type BotItem = {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
};

const MAIN = [
  { href: "/", label: "Umumiy ko'rinish" },
  { href: "/bots", label: "Botlar" },
  { href: "/team", label: "Jamoa" },
  { href: "/profile", label: "Profil" },
];

export function NavLinks({ bots }: { bots: BotItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2.5 py-3">
      {MAIN.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "block rounded-[6px] px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-ink-700 text-text"
                : "text-muted hover:bg-ink-800 hover:text-text"
            )}
          >
            {item.label}
          </Link>
        );
      })}

      {bots.length > 0 && (
        <>
          <div className="eyebrow mt-5 mb-1.5 px-2.5">Botlarim</div>
          {bots.map((bot) => {
            const active = pathname.startsWith(`/bots/${bot.id}`);
            return (
              <Link
                key={bot.id}
                href={`/bots/${bot.id}`}
                className={clsx(
                  "flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-ink-700 text-text"
                    : "text-muted hover:bg-ink-800 hover:text-text"
                )}
              >
                <span
                  className={clsx(
                    "size-1.5 shrink-0 rounded-full",
                    bot.isActive ? "bg-signal" : "bg-faint"
                  )}
                />
                <span className="truncate">{bot.name}</span>
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );
}

export function Tabs({
  items,
}: {
  items: { href: string; label: string; exact?: boolean }[];
}) {
  const pathname = usePathname();
  return (
    <div className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-amber-500 text-text"
                : "border-transparent text-muted hover:text-text"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}


/** Kichik ekranlarda yon menyuni ochadigan tortma panel. */
export function MobileNav({
  bots,
  userName,
  userEmail,
  logoutAction,
}: {
  bots: BotItem[];
  userName: string;
  userEmail: string;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Sahifa almashganda menyu o'zi yopilsin.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menyuni ochish"
        aria-expanded={open}
        className="rounded-[6px] border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-sm"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Menyuni yopish"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-950/70"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-ink-600 bg-ink-900">
            <div className="flex items-center justify-between border-b border-ink-600 px-5 py-4">
              <div>
                <div className="font-display text-lg font-bold tracking-tight">Botlar</div>
                <div className="eyebrow mt-0.5">Boshqaruv paneli</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Yopish"
                className="text-muted transition-colors hover:text-text"
              >
                ✕
              </button>
            </div>

            <NavLinks bots={bots} />

            <div className="mt-auto border-t border-ink-600 px-4 py-3">
              <div className="truncate text-xs text-muted">{userName}</div>
              <div className="truncate font-mono text-[11px] text-faint">{userEmail}</div>
              <form action={logoutAction} className="mt-2">
                <button
                  type="submit"
                  className="text-xs text-faint transition-colors hover:text-rose"
                >
                  Chiqish
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
