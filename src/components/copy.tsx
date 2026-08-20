"use client";

import { useState } from "react";

/** Kodni ko'rsatadi va bir bosishda nusxalaydi. */
export function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-[6px] border border-ink-600 bg-ink-950 px-3 py-2 font-mono text-[11px] whitespace-pre text-muted">
        {text}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-[6px] border border-ink-600 bg-ink-800 px-3 text-xs transition-colors hover:border-amber-500 hover:text-amber-400"
      >
        {copied ? "Nusxalandi" : "Nusxalash"}
      </button>
    </div>
  );
}
