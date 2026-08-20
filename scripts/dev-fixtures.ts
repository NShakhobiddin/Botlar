/**
 * Lokal sinov uchun namunaviy ma'lumot yaratadi.
 * Ishlatish:  npx tsx scripts/dev-fixtures.ts
 * DIQQAT: faqat rivojlantirish muhitida ishlating.
 */
import { PrismaClient } from "@prisma/client";
import { randomToken, seal } from "../src/lib/crypto";

try {
  process.loadEnvFile(".env");
} catch {}

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (!owner) throw new Error("Avval `npm run seed` ni ishga tushiring");

  const sealed = seal("123456789:FAKE-TOKEN-ONLY-FOR-LOCAL-TESTING-000");
  const bot = await prisma.bot.upsert({
    where: { username: "namuna_bot" },
    update: {},
    create: {
      name: "Namuna do'kon boti",
      username: "namuna_bot",
      telegramId: BigInt(123456789),
      tokenCipher: sealed.cipher,
      tokenIv: sealed.iv,
      tokenTag: sealed.tag,
      webhookSecret: randomToken(24),
      ownerId: owner.id,
      defaultLocale: "uz",
      locales: ["uz", "ru"],
      webhookSetAt: new Date(),
    },
  });

  const start = await prisma.screen.upsert({
    where: { botId_key: { botId: bot.id, key: "start" } },
    update: {},
    create: {
      botId: bot.id,
      key: "start",
      name: "Boshlang'ich ekran",
      isSystem: true,
      translations: {
        create: [
          { locale: "uz", text: "Assalomu alaykum, {{name}}! 👋\n\n<b>Namuna do'kon</b>ga xush kelibsiz." },
          { locale: "ru", text: "Здравствуйте, {{name}}! 👋" },
        ],
      },
    },
  });

  const katalog = await prisma.screen.upsert({
    where: { botId_key: { botId: bot.id, key: "katalog" } },
    update: {},
    create: {
      botId: bot.id,
      key: "katalog",
      name: "Katalog",
      translations: { create: [{ locale: "uz", text: "Mahsulotlar ro'yxati:" }] },
    },
  });

  const existing = await prisma.button.count({ where: { screenId: start.id } });
  if (existing === 0) {
    await prisma.button.createMany({
      data: [
        { screenId: start.id, labels: { uz: "🛍 Katalog", ru: "🛍 Каталог" }, action: "SCREEN", targetScreenId: katalog.id, row: 0, col: 0 },
        { screenId: start.id, labels: { uz: "📞 Aloqa", ru: "📞 Контакты" }, action: "URL", url: "https://t.me/namuna", row: 0, col: 1 },
        { screenId: start.id, labels: { uz: "ℹ️ Biz haqimizda" }, action: "SCREEN", targetScreenId: katalog.id, row: 1, col: 0 },
      ],
    });
  }

  await prisma.botCommand.upsert({
    where: { botId_command: { botId: bot.id, command: "start" } },
    update: {},
    create: { botId: bot.id, command: "start", description: "Botni ishga tushirish", screenId: start.id },
  });

  const app = await prisma.webApp.upsert({
    where: { trackKey: "wa_namuna_test_key" },
    update: {},
    create: { botId: bot.id, name: "Do'kon Mini App", url: "https://shop.example.uz", trackKey: "wa_namuna_test_key" },
  });

  // 300 ta obunachi, 60 kunga taqsimlangan
  const users = await prisma.botUser.count({ where: { botId: bot.id } });
  if (users === 0) {
    const now = Date.now();
    for (let i = 0; i < 300; i++) {
      const ageDays = Math.floor(Math.random() * 60);
      const createdAt = new Date(now - ageDays * 86_400_000);
      const blocked = Math.random() < 0.07;
      const u = await prisma.botUser.create({
        data: {
          botId: bot.id,
          telegramId: BigInt(500_000_000 + i),
          firstName: ["Aziz", "Dilnoza", "Sardor", "Kamola", "Jasur"][i % 5],
          username: `user${i}`,
          locale: Math.random() < 0.7 ? "uz" : "ru",
          isBlocked: blocked,
          blockedAt: blocked ? new Date(now - Math.random() * 20 * 86_400_000) : null,
          createdAt,
          lastSeenAt: new Date(now - Math.random() * ageDays * 86_400_000),
          messageCount: Math.floor(Math.random() * 40),
          phone: Math.random() < 0.3 ? `+9989${Math.floor(Math.random() * 10 ** 8)}` : null,
        },
      });

      const events = Math.floor(Math.random() * 6);
      for (let e = 0; e < events; e++) {
        await prisma.event.create({
          data: {
            botId: bot.id,
            botUserId: u.id,
            type: e === 0 ? "START" : Math.random() < 0.5 ? "SCREEN_VIEW" : "CALLBACK",
            name: e === 0 ? "start" : ["start", "katalog", "aloqa"][e % 3],
            createdAt: new Date(now - Math.random() * ageDays * 86_400_000),
          },
        });
      }

      if (Math.random() < 0.25) {
        await prisma.webAppSession.create({
          data: {
            webAppId: app.id,
            botUserId: u.id,
            telegramId: u.telegramId,
            platform: ["ios", "android", "tdesktop"][i % 3],
            startedAt: new Date(now - Math.random() * 30 * 86_400_000),
            durationMs: Math.floor(Math.random() * 300_000),
            eventCount: Math.floor(Math.random() * 5),
          },
        });
        await prisma.event.create({
          data: { botId: bot.id, botUserId: u.id, webAppId: app.id, type: "WEBAPP_OPEN", name: app.name },
        });
        await prisma.event.create({
          data: {
            botId: bot.id,
            botUserId: u.id,
            webAppId: app.id,
            type: "WEBAPP_EVENT",
            name: ["checkout", "add_to_cart", "search"][i % 3],
          },
        });
      }
    }
  }

  console.log(`Tayyor: ${bot.name} (${bot.id}) — 300 obunachi, 2 ekran, 1 Mini App`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
