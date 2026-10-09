# Botlar · Xabar — serversiz ommaviy xabar

Bot obunachilariga ommaviy xabar yuboradigan kichik panel. **Cloudflare Workers**
bepul tarifida ishlaydi: server sotib olish, domen, sertifikat va kompyuterni
yoqiq qoldirish kerak emas. Cloudflare sizga `https://…workers.dev` manzilini
bepul beradi.

Bu katta paneldan (`../`) alohida va mustaqil. Kontent konstruktori, statistika
grafiklari yo'q — faqat bitta ish: **obunachilar ro'yxati va ularga xabar yuborish**.

## Avval bitta muhim narsa

**Telegram bot obunachilarining ro'yxatini bermaydi.** Bunday so'rov Bot API'da
yo'q. Bot faqat ID'si ma'lum odamga yoza oladi, ID'lar esa botning o'z
bazasida bo'ladi. Shuning uchun ro'yxat ikki yo'l bilan to'ldiriladi:

| Yo'l | Qachon |
|---|---|
| **Import** — eski bazadan ID'lar ro'yxatini panelga qo'yish | Bot boshqa kodda ishlab kelgan va uning bazasiga kira olasiz |
| **Bot rejimi** — botga yozgan har bir odam o'zi ro'yxatga tushadi | Yangi bot, yoki eski kod endi kerak emas |

Ikkalasini birga ishlatsa ham bo'ladi.

## Nima qila oladi

- Matn (HTML), rasm va tugmalar bilan xabar; yonida Telegramdagi ko'rinishi
- Avval o'zingizga sinov, keyin hammaga
- Yuborish bo'laklab ketadi: panel ochiq bo'lsa har bir necha soniyada, yopiq
  bo'lsa har daqiqada — sahifani yopib qo'yish mumkin
- Telegram "kuting" desa (429) — kutadi va o'sha odamdan davom etadi
- Botni bloklaganlar avtomatik belgilanadi va keyingi safar yuborilmaydi
- To'xtatish tugmasi, oxirgi 10 ta yuborish tarixi
- **Bot rejimida** qo'shimcha: `/start` ga javob matni, adminlar Telegram
  ichidan istalgan xabarga (matn, rasm, video) `/broadcast` deb javob berib
  hammaga yuboradi, `/stats`, `/cancel`, tugaganda hisobot keladi

## O'rnatish

Kerak: kompyuterda **Node.js 20+** va bepul **Cloudflare** akkaunti
(dash.cloudflare.com — email bilan ro'yxatdan o'tiladi, karta so'ralmaydi).

```bash
cd serverless
npm install
npx wrangler login                 # brauzer ochiladi — ruxsat bering
npx wrangler d1 create botlar      # baza yaratiladi
```

Oxirgi buyruq `database_id = "…"` qatorini chiqaradi. Uni `wrangler.toml`
dagi shu qatorga qo'ying:

```toml
database_id = "00000000-0000-0000-0000-000000000000"   # ← o'zingiznikini qo'ying
```

Jadvallarni yaratib, ishga tushiring:

```bash
npm run db:init
npm run deploy
```

Ikki maxfiy qiymatni kiriting (buyruq so'raganda yozasiz — fayllarga hech
qayerga yozilmaydi):

```bash
npx wrangler secret put BOT_TOKEN        # @BotFather bergan token
npx wrangler secret put ADMIN_PASSWORD   # panelga kirish paroli, kamida 12 belgi
```

`deploy` chiqargan manzilni oching — `https://botlar-xabar.<siz>.workers.dev`.
Parol bilan kiring.

### Telegram ichidan boshqarish (ixtiyoriy)

`wrangler.toml` da o'z Telegram ID'ingizni yozing (@userinfobot dan bilib
olasiz) va qayta deploy qiling:

```toml
ADMIN_IDS = "584013219"
```

So'ng panelda **Bot rejimini yoqish**. Endi botga istalgan xabar yozasiz,
unga javob tariqasida `/broadcast` — xabar aynan shu ko'rinishda hammaga
ketadi.

## Ogohlantirishlar

**Bot rejimi botning hozirgi kodini o'chiradi.** Telegram bitta botning
yangiliklarini faqat bitta manzilga yuboradi. Agar bot boshqa serverda
ishlayotgan bo'lsa (masalan aiogram'da yozilgan do'kon boti), bot rejimi
yoqilgach o'sha kod xabar olmay qoladi. Panel buni aniqlab ogohlantiradi.
**Faqat xabar yuborish uchun bot rejimi kerak emas** — import yetarli.

**Manba xabarni o'chirmang.** Telegram ichidan `/broadcast` qilinganda xabar
sizning chatingizdan nusxalanadi. Yuborish tugaguncha uni o'chirsangiz,
qolganlarga yetib bormaydi.

## Bepul tarif chegaralari

Yozish paytidagi Cloudflare bepul tarifi (o'zgarishi mumkin — joriy holatini
Cloudflare hujjatlaridan tekshiring):

| Chegara | Qiymat | Bu panelga ta'siri |
|---|---|---|
| Bir chaqiruvda tashqi so'rovlar | 50 | Bir bo'lakda 40 ta xabar (`BATCH_SIZE`) |
| Cron | daqiqada 1 marta | Panel yopiq bo'lsa: daqiqasiga ~40 xabar |
| So'rovlar | kuniga 100 000 | Odatda yetarli |
| D1 yozuvlari | kuniga 100 000 | Import ham shunga kiradi |
| D1 o'qishlari | kuniga 5 mln | Statistika 2 daqiqaga keshlanadi |

Amalda: **panel ochiq turganda daqiqasiga bir necha yuz** xabar, yopiq
bo'lsa daqiqasiga ~40. 5 000 obunachi — panel ochiq bo'lsa 10–15 daqiqa.

Ko'proq kerak bo'lsa — Cloudflare'ning pullik tarifi (oyiga 5$): `BATCH_SIZE`
ni 1000 gacha oshirasiz va panel yopiq bo'lsa ham daqiqasiga ~1000 ketadi.

## Mahalliy sinash

```bash
cp .dev.vars.example .dev.vars    # sinov qiymatlarini yozing
npm run db:init:local
npm run dev                        # http://localhost:8787
```

`.dev.vars` da `TELEGRAM_API` ni soxta serverga yo'naltirib, haqiqiy
Telegram'ga tegmasdan sinash mumkin. Cron'ni qo'lda ishga tushirish:
`curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`.

## Xavfsizlik

- Token va parol Cloudflare'da shifrlangan maxfiy qiymat sifatida turadi
- Panel imzolangan cookie bilan himoyalangan, 10 ta noto'g'ri parol — 15 daqiqa bloklash
- Webhook faqat tokendan hosil qilingan sirli kalit bilan qabul qilinadi
- Boshqa saytlardan yuborilgan so'rovlar rad etiladi
