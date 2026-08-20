"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireRole } from "@/lib/auth";
import type { ActionState } from "@/components/forms";

export async function inviteUser(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("OWNER");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "ADMIN");

  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Email noto'g'ri" };
  if (password.length < 10) return { error: "Parol kamida 10 belgi bo'lsin" };
  if (!name) return { error: "Ism kiriting" };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Bu email allaqachon ro'yxatda" };

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: role as never,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  await audit(admin.id, "user.invite", "User", user.id, { email, role });
  revalidatePath("/team");
  return { ok: `${name} qo'shildi. Parolni unga xavfsiz kanal orqali yetkazing.` };
}

export async function toggleUserActive(userId: string) {
  const admin = await requireRole("OWNER");
  if (admin.id === userId) return;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !target.isActive },
  });
  await audit(admin.id, target.isActive ? "user.disable" : "user.enable", "User", userId);
  revalidatePath("/team");
}

export async function changePassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("OWNER");
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { error: "Parol kamida 10 belgi bo'lsin" };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
  await audit(admin.id, "user.password", "User", userId);
  return { ok: "Parol yangilandi" };
}
