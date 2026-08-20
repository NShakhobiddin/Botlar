"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { destroySession } from "@/lib/session";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/forms";

export async function updateProfile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Ism kamida 2 belgi bo'lsin" };

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}

export async function changeOwnPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return { error: "Joriy parol noto'g'ri" };
  }
  if (next.length < 10) return { error: "Yangi parol kamida 10 belgi bo'lsin" };
  if (next !== repeat) return { error: "Yangi parollar mos kelmadi" };
  if (next === current) return { error: "Yangi parol eskisidan farq qilsin" };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });
  await audit(user.id, "user.password.self", "User", user.id);

  // Parol o'zgargach qaytadan kirish talab qilinadi.
  await destroySession();
  redirect("/login");
}
