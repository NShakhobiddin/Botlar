export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy>
      <div className="h-8 w-56 rounded-[6px] bg-ink-800" />
      <div className="h-24 rounded-[10px] border border-ink-600 bg-ink-900" />
      <div className="h-64 rounded-[10px] border border-ink-600 bg-ink-900" />
    </div>
  );
}
