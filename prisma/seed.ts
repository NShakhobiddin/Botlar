import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Node .env faylini o'zi o'qimaydi — Docker'da env_file, lokalda .env ishlaydi.
try {
  process.loadEnvFile(".env");
} catch {
  // .env yo'q — muhit o'zgaruvchilari tashqaridan berilgan deb hisoblaymiz.
}

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME ?? "Egasi";

  if (!email || !password) {
    console.error(
      "ADMIN_EMAIL va ADMIN_PASSWORD o'rnatilmagan. .env fayliga yozing va qayta ishga tushiring."
    );
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("ADMIN_PASSWORD kamida 10 belgi bo'lishi kerak.");
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: "OWNER",
      passwordHash: await bcrypt.hash(password, 12),
    },
    update: { role: "OWNER", isActive: true },
  });

  console.log(`Egasi tayyor: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
