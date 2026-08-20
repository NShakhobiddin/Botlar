# Botlar

Bir nechta Telegram botni bitta joydan boshqarish paneli: bot kontentini kod
yozmasdan tahrirlash, obunachilarga xabar yuborish, statistika va Mini App
analitikasi.

Bot mantiqi kodda emas, **bazada** saqlanadi. Ekranlar, tugmalar va tarjimalarni
saytdan o'zgartirasiz — bot darhol yangi kontent bilan javob bera boshlaydi,
qayta deploy qilish shart emas.

---

## Nimalar bor

**Botlar**
Token kiritilganda bot tekshiriladi, webhook avtomatik o'rnatiladi va ishlaydigan
`/start` ekrani yaratiladi. Tokenlar bazada AES-256-GCM bilan shifrlangan holda
yotadi va panelda hech qachon to'liq ko'rsatilmaydi.

**Kontent**
Ekranlar (matn + media + tugmalar), inline va reply klaviaturalar, ko'p tillilik,
`{{name}}` kabi o'rinbosarlar, `/buyruq` → ekran bog'lanishi, majburiy obuna
kanallari, oddiy forma oqimi (foydalanuvchidan javob kutish). Tahrirlash paytida
yonida Telegramda qanday ko'rinishi turadi.

**Xabar yuborish**
Segment bo'yicha (til, faollik, qo'shilgan sana, Mini App ochganlar, telefon
raqami bor) auditoriyani tanlaysiz — nechta odamga borishi darhol ko'rinadi.
Yuborishdan oldin o'zingizga sinov jo'natasiz. Yuborish alohida worker'da,
sekundiga 25 xabar tezligida ketadi; to'xtatish va davom ettirish mumkin.
Botni bloklaganlar avtomatik belgilanadi va keyingi yuborishlardan chiqadi.

**Statistika**
Obunachilar o'sishi, DAU/MAU, bloklaganlar dinamikasi, eng ko'p ishlatilgan
buyruqlar va ekranlar, tillar bo'yicha taqsimot. Har bot sahifasida oxirgi 24
soatlik faollik chizig'i.

**Web App (Mini App)**
Mini App'ga bitta `<script>` qatorini qo'shasiz — ochilishlar, noyob
foydalanuvchilar, sessiya davomiyligi va o'zingiz yozgan hodisalar
(`Botlar.track("checkout", { summa: 250000 })`) panelda ko'rinadi. Har bir yozuv
Telegram `initData` imzosi bilan tekshiriladi.

**Jamoa**
Uch daraja: egasi (hammasi), administrator (o'z botlari), ko'ruvchi (faqat
kuzatish). Barcha muhim amallar tarixi yoziladi.

---

## Texnologiyalar

| Qism | Nima ishlatilgan |
|---|---|
| Sayt va API | Next.js 15 (App Router), TypeScript, Tailwind CSS 4 |
| Baza | PostgreSQL + Prisma |
| Navbat | Redis + BullMQ (broadcast worker alohida jarayon) |
| Grafiklar | Recharts |
| Kirish | Parol (bcrypt) + imzolangan cookie (jose) |

---

## Sizdan nima kerak

1. **VPS** — 2 vCPU / 4 GB RAM yetarli (Hetzner, Contabo, DigitalOcean).
2. **Domen** va unga yo'naltirilgan A-yozuv, masalan `panel.example.uz`.
3. **HTTPS sertifikat** — Telegram webhook faqat HTTPS bilan ishlaydi
   (Let's Encrypt bepul).
4. **Bot tokenlari** — @BotFather → `/mybots` → *API Token*.
   Tokenni panelning o'ziga kiritasiz, kodga yozmaysiz.
5. Mini App statistikasi kerak bo'lsa — Mini App kodiga bitta qator qo'sha olish
   imkoniyati.

---

## O'rnatish (VPS + Docker)

### 1. Kodni olish

```bash
git clone <repo-url> botlar && cd botlar
```

### 2. Sozlamalar

```bash
cp .env.example .env
openssl rand -hex 32   # ENCRYPTION_KEY uchun
openssl rand -hex 32   # SESSION_SECRET uchun
openssl rand -hex 16   # POSTGRES_PASSWORD uchun
```

`.env` faylini to'ldiring. Eng muhim qatorlar:

```env
APP_URL=https://panel.example.uz
ENCRYPTION_KEY=<64 belgili hex>
SESSION_SECRET=<64 belgili hex>
POSTGRES_PASSWORD=<parol>
ADMIN_EMAIL=siz@example.uz
ADMIN_PASSWORD=<kamida 10 belgi>
```

> **`ENCRYPTION_KEY` ni yo'qotmang.** Bot tokenlari shu kalit bilan shifrlangan —
> kalitsiz ularni ochib bo'lmaydi va har bir botni qaytadan ulashga to'g'ri keladi.
> `.env` faylini git'ga qo'shmang (u allaqachon `.gitignore` da).

### 3. Ishga tushirish

```bash
docker compose up -d --build
docker compose exec app npx prisma migrate deploy   # bazani tayyorlash
docker compose exec app npx tsx prisma/seed.ts      # egasini yaratish
```

### 4. Nginx va HTTPS

```nginx
server {
    server_name panel.example.uz;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 10m;
}
```

```bash
certbot --nginx -d panel.example.uz
```

Endi `https://panel.example.uz` ochiladi. `.env` dagi email va parol bilan kiring.

### 5. Birinchi botni ulash

**Botlar → Bot qo'shish** → @BotFather bergan tokenni qo'ying. Bot tekshiriladi,
webhook o'rnatiladi va `/start` ekrani tayyor holda yaratiladi. Telegramda botga
`/start` yozib ko'ring.

---

## Lokal ishlab chiqish

```bash
npm install
cp .env.example .env          # DATABASE_URL va REDIS_URL ni lokalga moslang
npx prisma migrate dev
npm run seed
npm run dev                   # sayt: http://localhost:3000
npm run worker:dev            # boshqa terminalda: broadcast worker
```

Namunaviy ma'lumot bilan ko'rish uchun (faqat lokalda):

```bash
npx tsx scripts/dev-fixtures.ts
```

Lokalda webhook ishlashi uchun tashqi tunnel kerak (`cloudflared tunnel` yoki
`ngrok http 3000`) — olingan HTTPS manzilni `APP_URL` ga yozing va bot
sozlamalaridan **Webhook → Qayta o'rnatish** ni bosing.

---

## Mini App statistikasi

Web App bo'limida ilovani qo'shgach, chiqqan qatorni Mini App'ning `<head>`
qismiga joylang:

```html
<script src="https://panel.example.uz/track.js" data-key="wa_xxxxxxxx"></script>
```

Ochilishlar, sessiya davomiyligi va platformalar avtomatik yoziladi. O'zingizning
hodisalaringizni yuborish uchun:

```js
Botlar.track("checkout", { summa: 250000, tovarlar: 3 });
```

Statistika faqat Mini App Telegram ichida ochilganda yoziladi — har bir so'rov
Telegram `initData` imzosi bilan tekshiriladi.

---

## Kundalik ishlar

**Yangilash**

```bash
git pull
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

**Zaxira nusxa** (kuniga bir marta cron'ga qo'ying)

```bash
docker compose exec -T db pg_dump -U botlar botlar | gzip > backup-$(date +%F).sql.gz
```

**Loglar**

```bash
docker compose logs -f app       # sayt va webhook
docker compose logs -f worker    # xabar yuborish
```

---

## Nosozliklar

| Belgi | Sababi va yechimi |
|---|---|
| Bot javob bermayapti | Sozlamalar → Webhook holatini tekshiring. «Ulanmagan» bo'lsa **Qayta o'rnatish**. `APP_URL` HTTPS ekaniga va tashqaridan ochilishiga ishonch hosil qiling. |
| «Webhook yo'q» belgisi | `APP_URL` noto'g'ri yoki sertifikat yaroqsiz. Telegram o'z-o'zidan imzolangan sertifikatni qabul qilmaydi. |
| Xabar yuborilmayapti | `docker compose logs worker` ga qarang. Worker konteyneri ishlayotganini va Redis'ga ulanishini tekshiring. |
| Xabar sekin ketyapti | Bu normal: Telegram limiti sekundiga ~30 xabar. 100 000 obunachi ≈ 70 daqiqa. `BROADCAST_RATE` ni oshirish bloklanishga olib kelishi mumkin. |
| Majburiy obuna ishlamayapti | Bot kanalda **administrator** bo'lishi shart, aks holda obunani tekshira olmaydi va foydalanuvchini to'smaydi. |
| Mini App statistikasi bo'sh | Ilova Telegram ichida ochilyaptimi? Brauzerda ochilganda `initData` bo'lmaydi va yozuv qilinmaydi. |

---

## Loyiha tuzilishi

```
prisma/schema.prisma        Ma'lumotlar modeli
src/app/(panel)/            Admin panel sahifalari
src/app/api/tg/[botId]/     Telegram webhook
src/app/api/track/          Mini App statistikasi
src/lib/engine/             Bot mantiqi: update qayta ishlash va ekran chizish
src/lib/telegram.ts         Telegram Bot API klienti
src/worker/index.ts         Broadcast worker (alohida jarayon)
public/track.js             Mini App'ga qo'yiladigan snippet
```
