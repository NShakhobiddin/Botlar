"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireBot } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import type { ActionState } from "@/components/forms";

export async function createWebApp(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireBot(botId);

  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!name) return { error: "Nom kiriting" };
  if (!/^https:\/\/.+/.test(url)) {
    return { error: "Telegram faqat HTTPS havolalarni qabul qiladi" };
  }

  const app = await prisma.webApp.create({
    data: { botId, name, url, trackKey: `wa_${randomToken(12)}` },
  });

  await audit(user.id, "webapp.create", "WebApp", app.id, { url });
  revalidatePath(`/bots/${botId}/webapps`);
  return { ok: `"${name}" qo'shildi. Endi statistika kodini Mini App'ga joylang.` };
}

export async function deleteWebApp(botId: string, webAppId: string) {
  const { user } = await requireBot(botId);
  await prisma.webApp.deleteMany({ where: { id: webAppId, botId } });
  await audit(user.id, "webapp.delete", "WebApp", webAppId);
  revalidatePath(`/bots/${botId}/webapps`);
}
