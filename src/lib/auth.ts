import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import type { Role, User } from "@prisma/client";

export async function currentUser(): Promise<User | null> {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  return user?.isActive ? user : null;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

const RANK: Record<Role, number> = { VIEWER: 0, ADMIN: 1, OWNER: 2 };

export function can(user: User, min: Role): boolean {
  return RANK[user.role] >= RANK[min];
}

export async function requireRole(min: Role): Promise<User> {
  const user = await requireUser();
  if (!can(user, min)) throw new Error("Bu amal uchun ruxsatingiz yo'q");
  return user;
}

/** Bot foydalanuvchiga tegishliligini tekshiradi (OWNER hammasini ko'radi). */
export async function requireBot(botId: string) {
  const user = await requireUser();
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) redirect("/bots");
  if (bot.ownerId !== user.id && user.role !== "OWNER") redirect("/bots");
  return { bot, user };
}

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, meta: meta as never },
  });
}
