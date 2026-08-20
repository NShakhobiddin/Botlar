import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { changeOwnPassword, updateProfile } from "./actions";
import { ActionForm, FormNotice, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Field, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Egasi",
  ADMIN: "Administrator",
  VIEWER: "Ko'ruvchi",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const botCount = await prisma.bot.count({ where: { ownerId: user.id } });

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Hisob" title="Profil" />

      <div className="space-y-5">
        <Card className="grid grid-cols-3 divide-x divide-ink-600">
          <Stat label="Rol" value={ROLE_LABEL[user.role]} />
          <Stat label="Botlarim" value={botCount} />
          <Stat
            label="Ro'yxatdan o'tgan"
            value={user.createdAt.toLocaleDateString("uz-UZ")}
          />
        </Card>

        <Card>
          <CardHeader eyebrow="Ma'lumot" title="Asosiy" />
          <ActionForm action={updateProfile} className="space-y-4 p-5">
            <Field label="Ism">
              <input name="name" defaultValue={user.name} required />
            </Field>
            <Field label="Email" hint="Emailni faqat egasi jamoa bo'limidan o'zgartira oladi.">
              <input defaultValue={user.email} disabled className="opacity-60" />
            </Field>
            <FormNotice />
            <SubmitButton>Saqlash</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader eyebrow="Xavfsizlik" title="Parolni o'zgartirish" />
          <ActionForm action={changeOwnPassword} className="space-y-4 p-5">
            <Field label="Joriy parol">
              <input name="current" type="password" required autoComplete="current-password" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Yangi parol" hint="Kamida 10 belgi.">
                <input name="next" type="password" required minLength={10} autoComplete="new-password" />
              </Field>
              <Field label="Yangi parolni takrorlang">
                <input name="repeat" type="password" required minLength={10} autoComplete="new-password" />
              </Field>
            </div>
            <p className="text-xs text-faint">
              Parol o&apos;zgargandan so&apos;ng qaytadan kirishingiz kerak bo&apos;ladi.
            </p>
            <FormNotice />
            <SubmitButton pendingLabel="O'zgartirilmoqda…">Parolni o&apos;zgartirish</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
