"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <div className="eyebrow mb-2">Xatolik</div>
      <h1 className="font-display text-xl font-semibold">Sahifa yuklanmadi</h1>
      <p className="mt-2 text-sm text-muted">
        {error.message || "Kutilmagan xatolik yuz berdi."}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-[11px] text-faint">kod: {error.digest}</p>
      )}
      <div className="mt-5 flex justify-center gap-2">
        <Button tone="primary" onClick={reset}>
          Qayta urinish
        </Button>
        <Button tone="ghost" onClick={() => window.location.assign("/")}>
          Bosh sahifa
        </Button>
      </div>
    </Card>
  );
}
