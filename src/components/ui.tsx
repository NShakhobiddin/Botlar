import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "rounded-[10px] border border-ink-600 bg-ink-900",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  eyebrow,
  action,
}: {
  title: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-600 px-5 py-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

type ButtonTone = "primary" | "ghost" | "danger" | "quiet";

const TONE: Record<ButtonTone, string> = {
  primary:
    "bg-amber-500 text-ink-950 hover:bg-amber-400 border-amber-500 font-semibold",
  ghost: "bg-ink-800 text-text hover:bg-ink-700 border-ink-600",
  quiet: "bg-transparent text-muted hover:text-text hover:bg-ink-800 border-transparent",
  danger: "bg-transparent text-rose hover:bg-rose/10 border-rose/40",
};

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[6px] border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  tone = "ghost",
  className,
  ...props
}: ComponentProps<"button"> & { tone?: ButtonTone }) {
  return <button className={clsx(BTN_BASE, TONE[tone], className)} {...props} />;
}

export function LinkButton({
  tone = "ghost",
  className,
  ...props
}: ComponentProps<typeof Link> & { tone?: ButtonTone }) {
  return <Link className={clsx(BTN_BASE, TONE[tone], className)} {...props} />;
}

const BADGE_TONE = {
  neutral: "bg-ink-700 text-muted",
  live: "bg-signal/12 text-signal",
  warn: "bg-amber-500/12 text-amber-400",
  danger: "bg-rose/12 text-rose",
  info: "bg-sky/12 text-sky",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONE;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] tracking-wide",
        BADGE_TONE[tone]
      )}
    >
      {children}
    </span>
  );
}

/** Katta raqam + kichik yorliq — o'lchov ko'rsatkichi. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "signal" | "rose" | "amber" | "violet";
}) {
  const color =
    tone === "signal"
      ? "text-signal"
      : tone === "rose"
        ? "text-rose"
        : tone === "amber"
          ? "text-amber-400"
          : tone === "violet"
            ? "text-violet"
            : "text-text";
  return (
    <div className="px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className={clsx("tabular mt-1.5 text-2xl font-semibold", color)}>
        {typeof value === "number" ? value.toLocaleString("uz-UZ") : value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  );
}

/**
 * Signal chizig'i — oxirgi 24 soatdagi faollik.
 * Panelning imzoviy elementi: har ustun bir soatlik hodisalar soni.
 */
export function SignalStrip({
  buckets,
  className,
}: {
  buckets: number[];
  className?: string;
}) {
  const max = Math.max(1, ...buckets);
  return (
    <div className={clsx("signal-strip", className)} aria-hidden>
      {buckets.map((v, i) => (
        <div
          key={i}
          className="signal-tick"
          data-empty={v === 0}
          style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
          title={`${v}`}
        />
      ))}
    </div>
  );
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="font-display text-sm text-muted">{title}</div>
      {hint && <p className="max-w-sm text-xs text-faint">{hint}</p>}
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={clsx(
        "eyebrow border-b border-ink-600 px-5 py-2.5 text-left font-normal",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={clsx("border-b border-ink-800 px-5 py-3 align-middle", className)}>
      {children}
    </td>
  );
}
