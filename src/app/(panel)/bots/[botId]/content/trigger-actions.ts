"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import type { ActionState } from "@/components/forms";

export async function createTrigger(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireBot(botId);

  const pattern = String(formData.get("pattern") ?? "").trim();
  const screenId = String(formData.get("screenId") ?? "");
  if (pattern.length < 2) return { error: "Kalit so'z kamida 2 belgi bo'lsin" };
  if (!screenId) return { error: "Qaysi ekran ochilishini tanlang" };

  const screen = await prisma.screen.findFirst({ where: { id: screenId, botId } });
  if (!screen) return { error: "Ekran topilmadi" };

  await prisma.trigger.create({
    data: {
      botId,
      pattern,
      screenId,
      matchType: String(formData.get("matchType") ?? "CONTAINS") as never,
      caseSensitive: formData.get("caseSensitive") === "on",
      priority: Number(formData.get("priority") ?? 0) || 0,
    },
  });

  revalidatePath(`/bots/${botId}/content`);
  return { ok: `"${pattern}" kalit so'zi qo'shildi` };
}

export async function toggleTrigger(botId: string, triggerId: string) {
  await requireBot(botId);
  const t = await prisma.trigger.findFirst({ where: { id: triggerId, botId } });
  if (!t) return;
  await prisma.trigger.update({
    where: { id: triggerId },
    data: { isActive: !t.isActive },
  });
  revalidatePath(`/bots/${botId}/content`);
}

export async function deleteTrigger(botId: string, triggerId: string) {
  await requireBot(botId);
  await prisma.trigger.deleteMany({ where: { id: triggerId, botId } });
  revalidatePath(`/bots/${botId}/content`);
}
