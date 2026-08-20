/**
 * Botlar — Mini App statistikasi.
 *
 * Mini App'ning <head> qismiga qo'ying:
 *   <script src="https://SIZNING-PANEL/track.js" data-key="wa_xxx"></script>
 *
 * Maxsus hodisa yuborish:
 *   Botlar.track("checkout", { summa: 250000 });
 */
(function () {
  var script = document.currentScript;
  var key = script && script.getAttribute("data-key");
  var endpoint =
    (script && script.getAttribute("data-endpoint")) ||
    (script ? new URL(script.src).origin + "/api/track" : "/api/track");

  if (!key) {
    console.warn("[Botlar] data-key ko'rsatilmagan");
    return;
  }

  var tg = window.Telegram && window.Telegram.WebApp;
  var initData = tg ? tg.initData : "";
  var platform = tg ? tg.platform : "web";
  var sessionId = null;
  var startedAt = Date.now();
  var queue = [];

  function post(body) {
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function open() {
    if (!initData) {
      // Mini App Telegram ichida ochilmagan — imzo yo'q, statistika yozilmaydi.
      return;
    }
    post({ key: key, initData: initData, type: "open", platform: platform }).then(
      function (res) {
        if (!res || !res.sessionId) return;
        sessionId = res.sessionId;
        queue.forEach(function (e) {
          send(e.name, e.payload);
        });
        queue = [];
      }
    );
  }

  function send(name, payload) {
    if (!sessionId) {
      queue.push({ name: name, payload: payload });
      return;
    }
    post({
      key: key,
      initData: initData,
      type: "event",
      sessionId: sessionId,
      name: String(name),
      payload: payload || {},
    });
  }

  function heartbeat(type) {
    if (!sessionId) return;
    post({
      key: key,
      type: type,
      sessionId: sessionId,
      durationMs: Date.now() - startedAt,
    });
  }

  window.Botlar = {
    track: send,
    get sessionId() {
      return sessionId;
    },
  };

  open();
  setInterval(function () {
    if (!document.hidden) heartbeat("ping");
  }, 30000);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) heartbeat("close");
  });
  window.addEventListener("pagehide", function () {
    heartbeat("close");
  });
})();
