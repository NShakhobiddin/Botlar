"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireBot } from "@/lib/auth";

export async function toggleBan(botId: string, botUserId: string) {
  const { user } = await requireBot(botId);
  const target = await prisma.botUser.findFirst({ where: { id: botUserId, botId } });
  if (!target) return;

  await prisma.botUser.update({
    where: { id: botUserId },
    data: { isBanned: !target.isBanned },
  });
  await audit(user.id, target.isBanned ? "user.unban" : "user.ban", "BotUser", botUserId);
  revalidatePath(`/bots/${botId}/users`);
}
