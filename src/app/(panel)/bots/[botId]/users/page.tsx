import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { toggleBan } from "./actions";
import { ConfirmButton } from "@/components/forms";
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  Table,
  Td,
  Th,
} from "@/components/ui";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  const { botId } = await params;
  const { q = "", page = "1", filter = "all" } = await searchParams;
  await requireBot(botId);

  const current = Math.max(1, Number(page) || 1);
  const where: Prisma.BotUserWhereInput = { botId };

  if (q.trim()) {
    const digits = /^\d+$/.test(q.trim());
    where.OR = [
      { username: { contains: q.trim(), mode: "insensitive" } },
      { firstName: { contains: q.trim(), mode: "insensitive" } },
      { phone: { contains: q.trim() } },
      ...(digits ? [{ telegramId: BigInt(q.trim()) }] : []),
    ];
  }
  if (filter === "blocked") where.isBlocked = true;
  if (filter === "banned") where.isBanned = true;
  if (filter === "active") {
    where.isBlocked = false;
    where.lastSeenAt = { gte: new Date(Date.now() - 7 * 86_400_000) };
  }

  const [users, total] = await Promise.all([
    prisma.botUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.botUser.count({ where }),
  ]);

  const pages = Math.ceil(total / PER_PAGE);
  const link = (p: number) =>
    `/bots/${botId}/users?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}${filter !== "all" ? `&filter=${filter}` : ""}`;

  const FILTERS = [
    { key: "all", label: "Hammasi" },
    { key: "active", label: "7 kunda faol" },
    { key: "blocked", label: "Bloklaganlar" },
    { key: "banned", label: "Ban qilinganlar" },
  ];

  return (
    <Card>
      <CardHeader
        eyebrow={`${total.toLocaleString("uz-UZ")} ta topildi`}
        title="Obunachilar"
        action={
          <div className="flex items-center gap-2">
            <form className="flex gap-2">
              <input type="hidden" name="filter" value={filter} />
              <input
                name="q"
                defaultValue={q}
                placeholder="Ism, @user, ID yoki raqam"
                className="w-56 text-xs"
              />
            </form>
            <a
              href={`/api/export?bot=${botId}&type=users`}
              className="shrink-0 rounded-[6px] border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm transition-colors hover:border-amber-500 hover:text-amber-400"
            >
              CSV
            </a>
          </div>
        }
      />

      <div className="flex gap-1 border-b border-ink-600 px-4 py-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/bots/${botId}/users?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={
              filter === f.key
                ? "rounded-[6px] bg-ink-700 px-2.5 py-1 text-xs"
                : "rounded-[6px] px-2.5 py-1 text-xs text-muted hover:text-text"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {users.length === 0 ? (
        <Empty title="Obunachi topilmadi" hint="Qidiruvni yoki filtrni o'zgartirib ko'ring." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Foydalanuvchi</Th>
                <Th>Telegram ID</Th>
                <Th>Til</Th>
                <Th>Holat</Th>
                <Th className="text-right">Xabar</Th>
                <Th>Oxirgi faollik</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-ink-800">
                  <Td>
                    <Link href={`/bots/${botId}/users/${u.id}`} className="block group/u">
                      <div className="font-medium transition-colors group-hover/u:text-amber-400">
                        {u.firstName} {u.lastName ?? ""}
                      </div>
                      <div className="font-mono text-xs text-faint">
                        {u.username ? `@${u.username}` : u.phone ? u.phone : "—"}
                      </div>
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs text-muted">{u.telegramId.toString()}</Td>
                  <Td className="font-mono text-xs uppercase text-muted">{u.locale}</Td>
                  <Td>
                    {u.isBanned ? (
                      <Badge tone="danger">Ban</Badge>
                    ) : u.isBlocked ? (
                      <Badge tone="warn">Bloklagan</Badge>
                    ) : (
                      <Badge tone="live">Faol</Badge>
                    )}
                  </Td>
                  <Td className="tabular text-right text-muted">{u.messageCount}</Td>
                  <Td className="text-xs text-faint">
                    {u.lastSeenAt.toLocaleString("uz-UZ", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Td>
                  <Td className="text-right">
                    <ConfirmButton
                      action={toggleBan.bind(null, botId, u.id)}
                      confirm={
                        u.isBanned
                          ? "Ban olib tashlansinmi?"
                          : "Bu foydalanuvchi ban qilinsinmi? Bot unga javob bermay qo'yadi."
                      }
                      tone="quiet"
                    >
                      {u.isBanned ? "Banni olish" : "Ban"}
                    </ConfirmButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 text-xs text-muted">
              <span className="tabular">
                {current} / {pages}
              </span>
              <div className="flex gap-2">
                {current > 1 && (
                  <Link href={link(current - 1)} className="hover:text-text">
                    ← Oldingi
                  </Link>
                )}
                {current < pages && (
                  <Link href={link(current + 1)} className="hover:text-text">
                    Keyingi →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
