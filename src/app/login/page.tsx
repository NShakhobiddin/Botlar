import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./form";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="eyebrow mb-2">Boshqaruv paneli</div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Botlar
          </h1>
          <p className="mt-2 text-sm text-muted">
            Telegram botlaringiz, obunachilaringiz va xabarlaringiz — bitta joyda.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
