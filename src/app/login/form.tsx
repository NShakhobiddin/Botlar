"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";
import { Button, Card, Field } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button tone="primary" type="submit" disabled={pending} className="w-full">
      {pending ? "Tekshirilmoqda…" : "Kirish"}
    </Button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(login, {});

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <Field label="Email">
          <input
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="siz@example.com"
          />
        </Field>
        <Field label="Parol">
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </Field>
        {state.error && (
          <p className="rounded-[6px] border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
            {state.error}
          </p>
        )}
        <Submit />
      </form>
    </Card>
  );
}
