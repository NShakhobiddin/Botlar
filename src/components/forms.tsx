"use client";

import { createContext, useActionState, useContext } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";

export type ActionState = { error?: string; ok?: string };
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  pendingLabel,
  tone = "primary",
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  tone?: "primary" | "ghost" | "danger" | "quiet";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button tone={tone} type="submit" disabled={pending} className={className}>
      {pending ? (pendingLabel ?? "Saqlanmoqda…") : children}
    </Button>
  );
}

export function Notice({ state }: { state: ActionState }) {
  if (!state.error && !state.ok) return null;
  return (
    <p
      className={clsx(
        "rounded-[6px] border px-3 py-2 text-xs",
        state.error
          ? "border-rose/30 bg-rose/10 text-rose"
          : "border-signal/30 bg-signal/10 text-signal"
      )}
    >
      {state.error ?? state.ok}
    </p>
  );
}

const FormStateContext = createContext<ActionState>({});

/**
 * Server action'ni useActionState bilan bog'laydi.
 * Natijani ko'rsatish uchun forma ichiga <FormNotice /> qo'ying.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <FormStateContext.Provider value={state}>
      <form action={formAction} className={className}>
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

/** Eng yaqin ActionForm natijasini ko'rsatadi. */
export function FormNotice() {
  return <Notice state={useContext(FormStateContext)} />;
}

/** Tasdiqlash so'raydigan tugma — o'chirish kabi qaytarib bo'lmaydigan amallar uchun. */
export function ConfirmButton({
  action,
  confirm,
  children,
  tone = "danger",
  className,
}: {
  action: () => Promise<void>;
  confirm: string;
  children: ReactNode;
  tone?: "primary" | "ghost" | "danger" | "quiet";
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className="inline"
    >
      <SubmitButton tone={tone} pendingLabel="Bajarilmoqda…" className={className}>
        {children}
      </SubmitButton>
    </form>
  );
}

/** Tasdiqsiz, bir bosishli amal (masalan tugmani siljitish). */
export function InlineAction({
  action,
  children,
  title,
}: {
  action: () => Promise<void>;
  children: ReactNode;
  title?: string;
}) {
  return (
    <form action={action} className="inline">
      <button
        type="submit"
        title={title}
        className="rounded-[4px] px-1.5 py-0.5 text-xs text-faint transition-colors hover:bg-ink-700 hover:text-text"
      >
        {children}
      </button>
    </form>
  );
}
