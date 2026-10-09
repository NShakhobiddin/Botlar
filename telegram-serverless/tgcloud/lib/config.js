// Sozlamalar. O'zgartirgach: npx tgcloud push

// Panel va /broadcast ishlata oladiganlar — Telegram ID'lar.
// O'z ID'ingizni @userinfobot dan bilib oling. Masalan: [584013219]
export const ADMIN_IDS = [];

// Bir chaqiruvda nechta xabar yuboriladi.
export const BATCH_SIZE = 25;

// Sekundiga nechta xabar. Telegram chegarasi ~30 — undan pastroq turamiz.
export const RATE_PER_SEC = 25;

// `npx tgcloud push` chiqargan Mini App manzili (https://app….tgcloud.ai/).
// /panel buyrug'i adminlarga shu manzilni tugma qilib beradi.
export const MINI_APP_URL = '';

export const DEFAULT_WELCOME =
  "Assalomu alaykum! 👋\n\nObuna bo'lganingiz uchun rahmat — yangiliklar shu yerga keladi.";
