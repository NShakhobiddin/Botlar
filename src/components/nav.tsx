"use client";

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
