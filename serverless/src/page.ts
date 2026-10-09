/**
 * Admin sahifalari. Panel bilan bir xil ko'rinish: siyoh-ko'k fon, amber urg'u.
 * Tashqi kutubxona yo'q — bitta HTML, ozgina JS.
 */

const HEAD = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Botlar · Xabar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root {
    --bg: #0b0f17; --panel: #10151f; --raised: #161d2b; --hover: #1e2739; --line: #2a3448;
    --text: #e6ebf4; --muted: #8797b0; --faint: #5c6b83;
    --amber: #f0a03c; --amber-hi: #f5b45c; --signal: #5ac8a8; --rose: #ef6a72; --sky: #5aa9e6;
    --display: "Space Grotesk", "Segoe UI", sans-serif;
    --sans: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14.5px/1.55 var(--sans); -webkit-font-smoothing: antialiased; }
  h1, h2 { font-family: var(--display); letter-spacing: -.015em; margin: 0; }
  h1 { font-size: 1.55rem; } h2 { font-size: 1rem; }
  .eyebrow { font: 10px var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--faint); }
  .tab { font-family: var(--mono); font-variant-numeric: tabular-nums; }
  a { color: var(--amber); }
  input, textarea, select {
    width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 6px;
    padding: .55rem .7rem; color: var(--text); font: inherit; font-size: .9rem; outline: none;
  }
  textarea { resize: vertical; font-family: var(--mono); font-size: .82rem; line-height: 1.6; }
  input:focus, textarea:focus { border-color: var(--amber); box-shadow: 0 0 0 3px #f0a03c2e; }
  input::placeholder, textarea::placeholder { color: var(--faint); }
  label { display: block; font-size: .8rem; color: var(--muted); margin-bottom: .35rem; font-weight: 500; }
  .hint { font-size: .74rem; color: var(--faint); margin-top: .35rem; }
  button {
    font: 500 .85rem var(--sans); border-radius: 6px; padding: .5rem .9rem; cursor: pointer;
    border: 1px solid var(--line); background: var(--raised); color: var(--text); transition: background .15s, border-color .15s;
  }
  button:hover { background: var(--hover); }
  button.primary { background: var(--amber); border-color: var(--amber); color: #0b0f17; font-weight: 600; }
  button.primary:hover { background: var(--amber-hi); }
  button.danger { background: transparent; color: var(--rose); border-color: #ef6a7266; }
  button.quiet { background: transparent; border-color: transparent; color: var(--muted); }
  button:disabled { opacity: .5; pointer-events: none; }
  :focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
  .card-head { padding: .9rem 1.1rem; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .card-body { padding: 1.1rem; display: flex; flex-direction: column; gap: .95rem; }
  .notice { font-size: .78rem; border-radius: 6px; padding: .5rem .7rem; border: 1px solid; }
  .notice.ok { color: var(--signal); background: #5ac8a81a; border-color: #5ac8a84d; }
  .notice.err { color: var(--rose); background: #ef6a721a; border-color: #ef6a724d; }
  .notice:empty { display: none; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>
</head>
<body>`;

export function loginPage(error = ""): string {
  const safe = error.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `${HEAD}
<main style="min-height:100dvh;display:grid;place-items:center;padding:1.5rem">
  <div style="width:100%;max-width:360px">
    <div class="eyebrow" style="margin-bottom:.5rem">Serverless</div>
    <h1 style="font-size:1.9rem">Botlar · Xabar</h1>
    <p style="color:var(--muted);font-size:.88rem;margin:.5rem 0 1.6rem">
      Obunachilarga ommaviy xabar yuborish. Kirish uchun parolni kiriting.
    </p>
    <form method="post" action="/login" class="card card-body">
      <div>
        <label for="pw">Parol</label>
        <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
      </div>
      <div class="notice err">${safe}</div>
      <button class="primary" type="submit">Kirish</button>
    </form>
  </div>
</main>
</body></html>`;
}

export function appPage(): string {
  return `${HEAD}
<style>
  .wrap { max-width: 1060px; margin: 0 auto; padding: 1.4rem 1rem 4rem; display: flex; flex-direction: column; gap: 1.1rem; }
  .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-bottom: .4rem; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); }
  .stat { padding: .95rem 1.1rem; border-left: 1px solid var(--line); }
  .stat:first-child { border-left: 0; }
  .stat .v { font-size: 1.6rem; font-weight: 600; margin-top: .25rem; }
  .grid { display: grid; grid-template-columns: 1fr 300px; gap: 1.1rem; align-items: start; }
  .grid.two { grid-template-columns: 1fr 1fr; }
  .grid > * { min-width: 0; }
  .bot-name { font: 12px var(--mono); color: var(--muted); margin-bottom: .25rem; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }
  .actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
  .bubble { background: var(--hover); border-radius: 12px 12px 12px 4px; padding: .6rem .8rem; font-size: .84rem; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
  .bubble img { display: block; max-width: 100%; border-radius: 8px; margin: -.2rem -.3rem .5rem; }
  .kb { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
  .kb div { background: #1e273999; border-radius: 8px; text-align: center; font-size: .78rem; padding: .4rem; color: var(--sky); }
  .bar { height: 6px; border-radius: 99px; background: var(--hover); overflow: hidden; }
  .bar > div { height: 100%; background: var(--amber); border-radius: 99px; transition: width .5s; }
  table { width: 100%; border-collapse: collapse; font-size: .82rem; }
  th { font: 10px var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--faint); text-align: left; font-weight: 400; padding: .55rem 1.1rem; border-bottom: 1px solid var(--line); }
  td { padding: .6rem 1.1rem; border-bottom: 1px solid #161d2b; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  .pill { font: 11px var(--mono); border-radius: 99px; padding: .1rem .5rem; white-space: nowrap; }
  .pill.done { background: #5ac8a81f; color: var(--signal); }
  .pill.running { background: #f0a03c1f; color: var(--amber-hi); }
  .pill.cancelled { background: var(--hover); color: var(--muted); }
  .num { text-align: right; }
  .scroll { overflow-x: auto; }
  [hidden] { display: none !important; }
  @media (max-width: 800px) {
    .grid, .grid.two { grid-template-columns: 1fr; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    .stat:nth-child(3) { border-left: 0; }
    .stat:nth-child(n+3) { border-top: 1px solid var(--line); }
    .row { grid-template-columns: 1fr; }
  }
</style>

<div class="wrap">
  <div class="top">
    <div>
      <div class="bot-name" id="botName">yuklanmoqda…</div>
      <h1>Ommaviy xabar</h1>
    </div>
    <form method="post" action="/logout"><button class="quiet" type="submit">Chiqish</button></form>
  </div>

  <div class="card stats">
    <div class="stat"><div class="eyebrow">Jami obunachi</div><div class="v tab" id="sTotal">—</div></div>
    <div class="stat"><div class="eyebrow">Xabar oladiganlar</div><div class="v tab" id="sActive" style="color:var(--signal)">—</div></div>
    <div class="stat"><div class="eyebrow">Bloklagan</div><div class="v tab" id="sBlocked" style="color:var(--rose)">—</div></div>
    <div class="stat"><div class="eyebrow">Import qilingan</div><div class="v tab" id="sImported">—</div></div>
  </div>

  <!-- Yuborilayotgan xabar -->
  <div class="card" id="progress" hidden>
    <div class="card-head">
      <div><div class="eyebrow">Hozir</div><h2>Xabar yuborilmoqda</h2></div>
      <button class="danger" id="cancelBtn" type="button">To'xtatish</button>
    </div>
    <div class="card-body">
      <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--muted)">
        <span class="tab" id="pCount">0 / 0</span><span class="tab" id="pPct">0%</span>
      </div>
      <div class="bar"><div id="pBar" style="width:0%"></div></div>
      <div style="display:flex;gap:1.4rem;font-size:.8rem;flex-wrap:wrap">
        <span>Yetdi: <b class="tab" id="pSent" style="color:var(--signal)">0</b></span>
        <span>Bloklagan: <b class="tab" id="pBlocked" style="color:var(--rose)">0</b></span>
        <span>Xato: <b class="tab" id="pFailed">0</b></span>
      </div>
      <div class="hint" id="pNote">Sahifa ochiq turganda tezroq ketadi. Yopsangiz ham har daqiqada davom etadi.</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-head"><div><div class="eyebrow">Mazmuni</div><h2>Yangi xabar</h2></div></div>
      <div class="card-body">
        <div>
          <label for="text">Matn</label>
          <textarea id="text" rows="8" placeholder="Assalomu alaykum! Bugun…"></textarea>
          <div class="hint">HTML ishlaydi: &lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;kursiv&lt;/i&gt;, &lt;a href="…"&gt;havola&lt;/a&gt;</div>
        </div>
        <div>
          <label for="photo">Rasm havolasi <span style="color:var(--faint);font-weight:400">— ixtiyoriy</span></label>
          <input id="photo" placeholder="https://… yoki Telegram file_id">
        </div>
        <div>
          <label for="buttons">Tugmalar <span style="color:var(--faint);font-weight:400">— ixtiyoriy</span></label>
          <textarea id="buttons" rows="2" placeholder="Batafsil | https://example.uz"></textarea>
          <div class="hint">Har qatorda bittadan: Matn | https://havola</div>
        </div>
        <div class="row" style="align-items:end">
          <div>
            <label for="chatId">Sinov uchun Telegram ID'ingiz</label>
            <input id="chatId" class="tab" placeholder="584013219" inputmode="numeric">
          </div>
          <button type="button" id="testBtn">Menga sinov yuborish</button>
        </div>
        <div class="notice" id="composeMsg"></div>
        <div class="actions">
          <button class="primary" type="button" id="sendBtn">Hammaga yuborish</button>
          <span class="hint" id="eta" style="margin:0"></span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="eyebrow">Ko'rinishi</div><h2>Telegramda</h2></div></div>
      <div class="card-body" style="background:var(--bg);border-radius:0 0 10px 10px">
        <div>
          <div class="bubble" id="preview"><span style="color:var(--faint)">— matn kiritilmagan —</span></div>
          <div class="kb" id="previewKb"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid two">
    <div class="card">
      <div class="card-head"><div><div class="eyebrow">Mavjud obunachilar</div><h2>Ro'yxatni import qilish</h2></div></div>
      <div class="card-body">
        <p style="margin:0;font-size:.84rem;color:var(--muted)">
          Telegram botning obunachilar ro'yxatini bermaydi — u faqat botning o'z bazasida bo'ladi.
          Eski bazadan foydalanuvchi ID'larini chiqarib shu yerga qo'ying: har qatorda bitta ID
          yoki CSV (birinchi raqamli ustun olinadi).
        </p>
        <textarea id="importText" rows="5" placeholder="584013219&#10;771234567&#10;…"></textarea>
        <div class="actions">
          <label style="margin:0;min-width:0;max-width:100%"><input type="file" id="importFile" accept=".txt,.csv" style="width:100%;max-width:260px;padding:.35rem;font-size:.78rem"></label>
          <button type="button" id="importBtn">Import qilish</button>
        </div>
        <div class="notice" id="importMsg"></div>
        <div class="hint" style="margin:0">Bepul tarifda kuniga ~100 000 ta yozuv. Takroriy ID'lar o'tkazib yuboriladi.</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="eyebrow">Ixtiyoriy</div><h2>Bot rejimi</h2></div></div>
      <div class="card-body">
        <p style="margin:0;font-size:.84rem;color:var(--muted)">
          Yoqilsa, botga yozgan har bir odam o'zi ro'yxatga tushadi, <span class="tab">/start</span> ga quyidagi
          matn bilan javob beriladi, adminlar esa Telegram ichidan istalgan xabarga
          <span class="tab">/broadcast</span> deb javob berib yubora oladi.
        </p>
        <div class="notice err" id="whWarn" hidden></div>
        <div>
          <label for="welcome">/start javobi</label>
          <textarea id="welcome" rows="3" style="font-family:var(--sans);font-size:.86rem"></textarea>
        </div>
        <div class="actions">
          <button type="button" id="welcomeBtn">Matnni saqlash</button>
          <button type="button" id="whBtn">Bot rejimini yoqish</button>
          <span class="pill" id="whState"></span>
        </div>
        <div class="notice" id="whMsg"></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><div><div class="eyebrow">Oxirgi 10 ta</div><h2>Tarix</h2></div></div>
    <div class="scroll">
      <table>
        <thead><tr><th>Sana</th><th>Xabar</th><th>Holat</th><th class="num">Yetdi</th><th class="num">Bloklagan</th><th class="num">Xato</th></tr></thead>
        <tbody id="history"><tr><td colspan="6" style="color:var(--faint)">Hali xabar yuborilmagan</td></tr></tbody>
      </table>
    </div>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString("uz-UZ");
let state = null;
let ticking = false;

async function api(path, body = {}) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 401) { location.reload(); throw new Error("401"); }
  return res.json();
}
function note(el, r) {
  el.className = "notice " + (r.error ? "err" : "ok");
  el.textContent = r.error || r.ok || "";
}

function render() {
  const s = state.stats;
  $("botName").textContent = state.bot ? "@" + state.bot.username : "bot ma'lumoti olinmadi — tokenni tekshiring";
  $("sTotal").textContent = fmt(s.total);
  $("sActive").textContent = fmt(s.active);
  $("sBlocked").textContent = fmt(s.blocked);
  $("sImported").textContent = fmt(s.imported);
  const perMin = state.batchSize;
  const min = Math.ceil((s.active || 0) / perMin);
  $("eta").textContent = s.active ? fmt(s.active) + " ta obunachiga · sahifa yopiq bo'lsa ~" + fmt(min) + " daqiqa" : "";

  if (!$("welcome").dataset.touched) $("welcome").value = state.welcome;
  const wh = state.webhook;
  $("whState").textContent = wh && wh.active ? "yoqilgan" : "o'chirilgan";
  $("whState").className = "pill " + (wh && wh.active ? "done" : "cancelled");
  $("whBtn").textContent = wh && wh.active ? "Bot rejimini o'chirish" : "Bot rejimini yoqish";
  const warn = $("whWarn");
  if (wh && wh.otherUrl) {
    warn.hidden = false;
    warn.textContent = "Bu botni hozir boshqa server boshqaryapti (" + wh.otherUrl + "). Bot rejimini yoqsangiz, o'sha serverdagi bot javob bermay qoladi. Faqat xabar yuborish uchun yoqish shart emas.";
  } else warn.hidden = true;

  const rows = state.history.map((h) => {
    const d = new Date(h.created_at * 1000);
    const label = h.kind === "copy" ? "Telegram'dan nusxa" : (h.text || "rasm").replace(/<[^>]+>/g, "").slice(0, 60);
    const st = { done: "yuborildi", running: "yuborilmoqda", cancelled: "to'xtatilgan" }[h.status];
    const tr = document.createElement("tr");
    [d.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), label].forEach((t) => {
      const td = document.createElement("td"); td.textContent = t; tr.appendChild(td);
    });
    const tdS = document.createElement("td");
    const p = document.createElement("span"); p.className = "pill " + h.status; p.textContent = st; tdS.appendChild(p); tr.appendChild(tdS);
    [h.sent, h.blocked, h.failed].forEach((n) => { const td = document.createElement("td"); td.className = "num tab"; td.textContent = fmt(n); tr.appendChild(td); });
    return tr;
  });
  if (rows.length) $("history").replaceChildren(...rows);

  showJob(state.current);
}

function showJob(job) {
  const running = job && job.status === "running";
  $("progress").hidden = !running;
  $("sendBtn").disabled = !!running;
  if (!running) return;
  const done = job.sent + job.blocked + job.failed;
  const pct = job.total ? Math.min(100, (done / job.total) * 100) : 0;
  $("pCount").textContent = fmt(done) + " / " + fmt(job.total);
  $("pPct").textContent = pct.toFixed(1) + "%";
  $("pBar").style.width = pct + "%";
  $("pSent").textContent = fmt(job.sent);
  $("pBlocked").textContent = fmt(job.blocked);
  $("pFailed").textContent = fmt(job.failed);
  if (!ticking) tickLoop();
}

// Sahifa ochiq bo'lsa har bir necha soniyada navbatdagi bo'lakni yuboradi.
async function tickLoop() {
  ticking = true;
  try {
    while (true) {
      const r = await api("/api/tick");
      if (r.note) $("pNote").textContent = r.note;
      if (!r.job || r.job.status !== "running") break;
      showJob(r.job);
      await new Promise((ok) => setTimeout(ok, 2500));
    }
  } finally {
    ticking = false;
    $("composeMsg").textContent = "";
    await load(true);
  }
}

async function load(fresh = false) {
  state = await api("/api/state", { fresh });
  render();
}

// --- ko'rinish
function esc(s) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }
function telegramHtml(s) {
  // Faqat Telegram qo'llaydigan teglar ko'rinishda qoladi
  return esc(s).replace(/&lt;(\\/?)(b|i|u|s|code|pre|strong|em)&gt;/g, "<$1$2>");
}
function preview() {
  const text = $("text").value, photo = $("photo").value.trim();
  const box = $("preview");
  box.innerHTML = "";
  if (/^https?:\\/\\//.test(photo)) { const img = document.createElement("img"); img.src = photo; img.alt = ""; img.onerror = () => img.remove(); box.appendChild(img); }
  const span = document.createElement("span");
  if (text.trim()) span.innerHTML = telegramHtml(text);
  else { span.textContent = photo ? "" : "— matn kiritilmagan —"; span.style.color = "var(--faint)"; }
  box.appendChild(span);
  const kb = $("previewKb"); kb.innerHTML = "";
  $("buttons").value.split("\\n").forEach((line) => {
    const [t, u] = line.split("|").map((x) => (x || "").trim());
    if (t && u) { const d = document.createElement("div"); d.textContent = t; kb.appendChild(d); }
  });
}
["text", "photo", "buttons"].forEach((id) => $(id).addEventListener("input", preview));

// --- amallar
try { $("chatId").value = localStorage.getItem("bx_chat") || ""; } catch {}
$("chatId").addEventListener("change", () => { try { localStorage.setItem("bx_chat", $("chatId").value.trim()); } catch {} });

const payload = () => ({ text: $("text").value, photo: $("photo").value, buttons: $("buttons").value });

$("testBtn").onclick = async () => {
  $("testBtn").disabled = true;
  note($("composeMsg"), await api("/api/test", { ...payload(), chatId: $("chatId").value.trim() }));
  $("testBtn").disabled = false;
};

$("sendBtn").onclick = async () => {
  const n = state.stats.active;
  if (!confirm(fmt(n) + " ta obunachiga yuboriladi. Bu amalni qaytarib bo'lmaydi. Avval o'zingizga sinov yubordingizmi?")) return;
  $("sendBtn").disabled = true;
  const r = await api("/api/broadcast", payload());
  note($("composeMsg"), r.error ? r : { ok: "Yuborish boshlandi" });
  if (r.job) showJob(r.job); else $("sendBtn").disabled = false;
};

$("cancelBtn").onclick = async () => {
  if (!confirm("Yuborish to'xtatilsinmi? Qolganlarga xabar bormaydi.")) return;
  await api("/api/cancel");
  await load(true);
};

$("importFile").onchange = async (e) => {
  const f = e.target.files[0];
  if (f) $("importText").value = await f.text();
};

$("importBtn").onclick = async () => {
  const ids = [];
  for (const line of $("importText").value.split(/\\r?\\n/)) {
    const m = line.match(/-?\\d{5,15}/);
    if (m && !m[0].startsWith("-")) ids.push(m[0]);
  }
  const unique = [...new Set(ids)];
  if (!unique.length) return note($("importMsg"), { error: "Ro'yxatda ID topilmadi" });
  $("importBtn").disabled = true;
  let added = 0;
  for (let i = 0; i < unique.length; i += 2000) {
    const r = await api("/api/import", { ids: unique.slice(i, i + 2000) });
    if (r.error) { note($("importMsg"), r); $("importBtn").disabled = false; return; }
    added += r.added;
    note($("importMsg"), { ok: "Yuklanmoqda… " + fmt(Math.min(i + 2000, unique.length)) + " / " + fmt(unique.length) });
  }
  note($("importMsg"), { ok: fmt(added) + " ta yangi obunachi qo'shildi" + (unique.length - added ? ", " + fmt(unique.length - added) + " tasi avval bor edi" : "") });
  $("importText").value = "";
  $("importBtn").disabled = false;
  await load(true);
};

$("welcome").addEventListener("input", () => { $("welcome").dataset.touched = "1"; });
$("welcomeBtn").onclick = async () => note($("whMsg"), await api("/api/welcome", { text: $("welcome").value }));

$("whBtn").onclick = async () => {
  const enable = !(state.webhook && state.webhook.active);
  if (enable && state.webhook && state.webhook.otherUrl &&
      !confirm("Bot hozir boshqa serverda ishlayapti. Bot rejimi yoqilsa, o'sha server endi xabar olmaydi. Davom etamizmi?")) return;
  note($("whMsg"), await api("/api/webhook", { enable }));
  await load();
};

load();
</script>
</body></html>`;
}
