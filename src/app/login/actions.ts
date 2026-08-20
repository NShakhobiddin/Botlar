"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email va parolni kiriting" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Foydalanuvchi topilmasa ham bcrypt chaqiramiz — javob vaqti bir xil qolsin.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok || !user.isActive) {
    return { error: "Email yoki parol noto'g'ri" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession({ sub: user.id, email: user.email, role: user.role });
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
