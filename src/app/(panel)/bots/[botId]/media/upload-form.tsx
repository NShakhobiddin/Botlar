"use client";

import { useRef, useState } from "react";
import { ActionForm, FormNotice, SubmitButton, type ActionState } from "@/components/forms";

export function UploadForm({
  action,
  allowed,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  allowed: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  function pick(files: FileList | null) {
    setNames(files ? [...files].map((f) => f.name) : []);
  }

  return (
    <ActionForm action={action} className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (inputRef.current && e.dataTransfer.files.length) {
            inputRef.current.files = e.dataTransfer.files;
            pick(e.dataTransfer.files);
          }
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-[10px] border border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-amber-500 bg-amber-500/5" : "border-ink-600 hover:border-faint"
        }`}
      >
        <div className="font-display text-sm">
          Fayllarni shu yerga tashlang yoki bosib tanlang
        </div>
        <p className="mt-1.5 text-xs text-faint">
          {allowed} · bitta fayl 20 MB gacha
        </p>
        {names.length > 0 && (
          <p className="mt-3 font-mono text-xs text-amber-400">{names.join(", ")}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        name="files"
        multiple
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />

      <FormNotice />
      <SubmitButton pendingLabel="Yuklanmoqda…">Yuklash</SubmitButton>
    </ActionForm>
  );
}
