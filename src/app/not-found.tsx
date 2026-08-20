import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="eyebrow mb-2">404</div>
        <h1 className="font-display text-2xl font-semibold">Sahifa topilmadi</h1>
        <p className="mt-2 text-sm text-muted">
          Havola eskirgan bo&apos;lishi yoki bu yozuv o&apos;chirilgan bo&apos;lishi mumkin.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-[6px] border border-amber-500 bg-amber-500 px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-amber-400"
        >
          Bosh sahifaga
        </Link>
      </div>
    </main>
  );
}
