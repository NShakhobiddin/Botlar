"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { rateLimit, resetLimit } from "@/lib/rate-limit";
import { createSession, destroySession } from "@/lib/session";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60_000;

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

  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || "local";
  const limit = rateLimit(`login:${ip}:${email}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfterSec / 60);
    return {
      error: `Juda ko'p urinish. ${minutes} daqiqadan so'ng qayta urining.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Foydalanuvchi topilmasa ham bcrypt chaqiramiz — javob vaqti bir xil qolsin.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok || !user.isActive) {
    return { error: "Email yoki parol noto'g'ri" };
  }

  resetLimit(`login:${ip}:${email}`);
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
