import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { inviteUser, toggleUserActive } from "./actions";
import { ActionForm, ConfirmButton, FormNotice, SubmitButton } from "@/components/forms";
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  Field,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Egasi",
  ADMIN: "Administrator",
  VIEWER: "Ko'ruvchi",
};

export default async function TeamPage() {
  const me = await requireUser();
  const isOwner = me.role === "OWNER";

  const [users, logs] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Kirish huquqlari"
        title="Jamoa"
        description="Egasi hammasini boshqaradi, administrator o'z botlarini, ko'ruvchi faqat kuzatadi."
      />

      <div className="space-y-5">
        <Card>
          <CardHeader eyebrow={`${users.length} ta`} title="Panel foydalanuvchilari" />
          <Table>
            <thead>
              <tr>
                <Th>Foydalanuvchi</Th>
                <Th>Rol</Th>
                <Th>Holat</Th>
                <Th>Oxirgi kirish</Th>
                {isOwner && <Th />}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <div className="font-medium">{u.name}</div>
                    <div className="font-mono text-xs text-faint">{u.email}</div>
                  </Td>
                  <Td className="text-xs text-muted">{ROLE_LABEL[u.role]}</Td>
                  <Td>
                    {u.isActive ? (
                      <Badge tone="live">Faol</Badge>
                    ) : (
                      <Badge tone="danger">O&apos;chirilgan</Badge>
                    )}
                  </Td>
                  <Td className="text-xs text-faint">
                    {u.lastLoginAt
                      ? u.lastLoginAt.toLocaleString("uz-UZ", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "hech qachon"}
                  </Td>
                  {isOwner && (
                    <Td className="text-right">
                      {u.id !== me.id && (
                        <ConfirmButton
                          action={toggleUserActive.bind(null, u.id)}
                          confirm={
                            u.isActive
                              ? `${u.name} panelga kira olmay qolsinmi?`
                              : `${u.name} uchun kirish qayta ochilsinmi?`
                          }
                          tone="quiet"
                        >
                          {u.isActive ? "O'chirish" : "Yoqish"}
                        </ConfirmButton>
                      )}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader eyebrow="Yangi" title="Foydalanuvchi qo'shish" />
            <ActionForm action={inviteUser} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ism">
                  <input name="name" required placeholder="Aziz Karimov" />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" required placeholder="aziz@example.uz" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Boshlang'ich parol" hint="Kamida 10 belgi.">
                  <input name="password" required minLength={10} className="font-mono" />
                </Field>
                <Field label="Rol">
                  <select name="role" defaultValue="ADMIN">
                    <option value="ADMIN">Administrator</option>
                    <option value="VIEWER">Ko&apos;ruvchi</option>
                    <option value="OWNER">Egasi</option>
                  </select>
                </Field>
              </div>
              <FormNotice />
              <SubmitButton pendingLabel="Qo'shilmoqda…">Qo&apos;shish</SubmitButton>
            </ActionForm>
          </Card>
        )}

        <Card>
          <CardHeader eyebrow="Oxirgi 25 ta" title="Amallar tarixi" />
          {logs.length === 0 ? (
            <Empty title="Hali amal qilinmagan" />
          ) : (
            <div className="divide-y divide-ink-800">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                  <span className="tabular w-28 shrink-0 text-faint">
                    {log.createdAt.toLocaleString("uz-UZ", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="w-32 shrink-0 truncate text-muted">
                    {log.user?.name ?? "tizim"}
                  </span>
                  <span className="font-mono text-amber-400">{log.action}</span>
                  <span className="truncate text-faint">{log.entity}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
