# Ommaviy xabar — Telegram Serverless

Bot obunachilariga ommaviy xabar yuborish vositasi. U **Telegram'ning o'z
Serverless platformasida** ishlaydi: kod Telegram serverlarida turadi,
shuning uchun server ijaraga olish, domen sotib olish va kompyuterni yoqiq
qoldirish kerak emas. Boshqaruv paneli Mini App ko'rinishida — Telegram
ichida ochiladi.

## Avval bilish kerak bo'lgan to'rt narsa

**1. Telegram obunachilar ro'yxatini bermaydi.** Bot API'da bunday so'rov
yo'q. Ro'yxat ikki yo'l bilan to'ladi:

- **Import:** eski botingiz bazasidagi foydalanuvchi ID'larini panelga qo'yasiz
- **O'z-o'zidan:** shundan keyin botga yozgan har bir odam ro'yxatga tushadi

**2. Serverless yoqilsa, botning hozirgi kodi ishlamay qoladi.** Telegram
botning xabarlarini faqat bitta joyga yuboradi va Serverless o'sha joyni
egallaydi. Botingiz hozir boshqa serverda ishlayotgan bo'lsa (masalan
aiogram'dagi do'kon boti), push qilingandan keyin u xabar olmay qoladi va
bu bot faqat `/start` va admin buyruqlariga javob beradi. Buni yangi bot
yoki tarqatish uchun ajratilgan bot uchun ishlating.

**3. Xabar panel ochiq turganda yuboriladi.** Platformada hozircha
rejalashtirilgan ishlar (cron) yo'q. Shuning uchun xabarlar panel ochiq
turganda bo'laklab ketadi: sekundiga 25 tagacha, ya'ni daqiqasiga taxminan 1000–1500 ta.
Panelni yopsangiz yuborish to'xtaydi, qayta ochsangiz o'sha joydan davom
etadi. Panelni yopmoqchi bo'lsangiz Telegram avval so'raydi. Panelsiz ham
bo'ladi: bot yuborgan xabardagi «▶️ Davom ettirish» tugmasini bosasiz.

**4. Platforma yangi.** Bu kod Telegram'ning rasmiy `@tgcloud/cli` 0.2.0
paketi bilan kelgan SDK hujjati asosida yozilgan. Ishlash vaqti va hajm
chegaralari o'sha hujjatda ko'rsatilmagan. To'liq hujjat:
[core.telegram.org/bots/serverless](https://core.telegram.org/bots/serverless).

## Nima qila oladi

**Mini App panel (`/panel`)**
- Obunachilar soni: jami, xabar oladiganlar, bloklaganlar, import qilinganlar
- Xabar yozish: matn (HTML), rasm havolasi, tugmalar, Telegramdagi ko'rinishi bilan
- «O'zimga sinov» — xabar paneldagi adminning o'ziga boradi, ID kiritish shart emas
- «Hammaga yuborish» — progress, to'xtatish, tugagach hisobot
- Eski obunachilarni import qilish: ID'lar ro'yxati yoki CSV
- `/start` javob matnini tahrirlash, oxirgi 10 ta yuborish tarixi

**Bot ichida (faqat adminlar)**
- `/broadcast` — istalgan xabarga (matn, rasm, video, tugmali) javob
  tariqasida yuborasiz, o'sha xabar hammaga aynan shu ko'rinishda ketadi
- `/stats`, `/cancel`, `/panel`, `/help`

**O'z-o'zidan**
- Botni bloklaganlar belgilanadi va ularga yuborilmaydi; qayta yozsa — tiklanadi
- Telegram «kuting» desa (429) — kutadi va o'sha odamdan davom etadi
- Ikkita panel yoki panel bilan tugma bir vaqtda ishlasa ham hech kim xabarni
  ikki marta olmaydi

## O'rnatish

Kerak: kompyuterda **Node.js 18+**.

**1. BotFather'da Serverless'ni yoqing.** @BotFather → botingiz →
**Serverless** → yoqing.

**2. CLI tokenini oling.** Shu bo'limda **CLI Access**. Bu bot tokenidan
boshqa token, lekin u ham botni to'liq boshqarish huquqini beradi —
hech kimga yubormang.

**3. Loyihani tayyorlang.**

```bash
cd telegram-serverless
npm install
```

**4. O'zingizni admin qiling.** `tgcloud/lib/config.js` ni oching va
Telegram ID'ingizni yozing (uni @userinfobot dan bilib olasiz):

```js
export const ADMIN_IDS = [584013219];
```

**5. Botga ulang va yuklang.**

```bash
npx tgcloud login      # 2-qadamdagi CLI tokenini so'raydi
npx tgcloud push       # kodni yuklaydi va Mini App manzilini chiqaradi
npx tgcloud migrate    # bazada jadvallarni yaratadi
```

**6. Panel manzilini qo'ying.** `push` chiqargan manzilni
(`https://app….tgcloud.ai/`) `config.js` ga yozing va qayta yuklang:

```js
export const MINI_APP_URL = 'https://app123.tgcloud.ai/';
```

```bash
npx tgcloud push
```

**7. Tekshiring.** Botga `/panel` yozing. Panel ochiladi, chatdagi menyuda
esa «Panel» tugmasi paydo bo'ladi — bu tugma faqat adminlarga ko'rinadi.
Panel ochilmasa va «faqat adminlar uchun» deb chiqsa, o'sha yerda ID'ingiz
ko'rsatiladi. Uni `ADMIN_IDS` ga qo'shing.

## Kundalik ishlar

```bash
npx tgcloud status     # nima o'zgardi
npx tgcloud push       # o'zgarishlarni yuklash
npx tgcloud webhook    # bot Serverless'ga to'g'ri ulanganmi
npx tgcloud run endpoints/state '{}' --ctx '{ initData: { user: { id: 584013219 } } }'
```

`tgcloud/schema.js` ni o'zgartirsangiz `push` dan keyin `migrate` ham kerak —
`push` bazaga tegmaydi.

## Tuzilishi

```
tgcloud/
  schema.js                 jadvallar: subscribers, broadcasts, settings
  lib/config.js             adminlar, tezlik, panel manzili
  lib/broadcast.js          bo'laklab yuborish, bloklash, statistika
  lib/guard.js              endpoint'lar faqat adminlarga
  handlers/message.js       /start, obunachini yozish, admin buyruqlari
  handlers/my_chat_member.js   bloklash / blokdan chiqish
  handlers/callback_query.js   «Davom ettirish» va «To'xtatish» tugmalari
  endpoints/                panel chaqiradigan funksiyalar
web/index.html              Mini App panel (build bosqichi yo'q)
tgcloud.jsonc               web/ ni Mini App sifatida tarqatish
```
