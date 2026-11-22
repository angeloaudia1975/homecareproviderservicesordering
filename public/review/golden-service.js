/* Design review only (owner 2026-11-22): renders the PR build's own Golden Service & Support module (gsv.css / gsv.html /
   gsv.js) with the Dealer 360 skin (d360-theme.css) and clearly labelled SAMPLE parts. It never calls golden-proxy or any
   other API, sends nothing (the send hook refuses), shows no price, and runs only on a Partner 360 deploy preview or
   localhost. NOT part of a release: production builds are made from named files and never include public/review/. */
(function () {
  "use strict";
  var app = document.getElementById("rvApp");
  var okHost = /^deploy-preview-\d+--hcpsonlineordering\.netlify\.app$/.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (!okHost) { app.innerHTML = '<div class="rv-off">This design review page is available only on a protected preview.</div>'; return; }
  /* belt and braces: this page may only READ its own files — any other request method is refused before it leaves */
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (u, o) { var m = String((o && o.method) || "GET").toUpperCase(); if (m !== "GET") return Promise.reject(new Error("Design review — nothing is sent")); return nativeFetch(u, o); };
  function get(u) { return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.text(); }); }
  function script(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error(src)); }; document.head.appendChild(s); }); }
  var S = function (n) { return "SAMPLE-" + String(n).padStart(3, "0"); };
  var lift = [
    ["Hand control", "Sample hand control, 2-button (design review)"], ["Hand control", "Sample hand control, 5-button (design review)"],
    ["Transformer", "Sample transformer (design review)"], ["Motor", "Sample lift motor (design review)"],
    ["Cables", "Sample motor extension cable (design review)"], ["Hardware", "Sample bolt kit (design review)"],
    ["Battery", "Sample backup battery pack (design review)"], ["Upholstery", "Sample seat cushion (design review)"]
  ].map(function (x, i) { return { cat: x[0], item: S(i + 1), desc: x[1], price: 0, n: i + 1 }; });
  var model = function (from, names) { return names.map(function (d, i) { return { part: S(from + i), desc: d, price: 0 }; }); };
  var PARTS = {
    lift_chair: lift,
    scooter: { "Sample scooter model A": model(20, ["Sample controller (design review)", "Sample tiller key (design review)", "Sample charger (design review)"]),
               "Sample scooter model B": model(30, ["Sample drive motor (design review)", "Sample seat post (design review)"]) },
    power_chair: { "Sample power chair model A": model(40, ["Sample joystick (design review)", "Sample battery harness (design review)", "Sample caster wheel (design review)"]) }
  };
  function prefill(root) {
    var set = function (name, v, ro) { root.querySelectorAll('[name="' + name + '"]').forEach(function (el) { if (v && !el.value) el.value = v; if (ro) { el.readOnly = true; el.classList.add("gsv-ro"); } }); };
    set("dealer_name", "SAMPLE — James Medical Equipment Bowling Green", true);
    set("account_number", "Verified by Golden on your account", true);
    set("ship_city", "Bowling Green"); set("ship_zip", "42101");
    root.querySelectorAll('[name="ship_state"]').forEach(function (el) { if (!el.value) el.value = "KY"; });
  }
  Promise.all([get("/golden-support/gsv.css"), get("/golden-support/gsv.html"), get("/golden-support/d360-theme.css"), script("/golden-support/gsv.js")]).then(function (a) {
    var css = a[0], html = a[1], theme = a[2];
    app.innerHTML = '<div class="rv-ph"><div><h1>Golden Service &amp; Support</h1><div class="sub">Golden shows parts prices only to authorized Golden dealers with a verified account. Requests: use Golden\'s support site or call Golden Tech Support until sending from Dealer 360 is switched on.</div></div>' +
      '<div class="rv-tog" role="group" aria-label="Design"><button type="button" data-v="after" aria-pressed="true">Dealer 360 design (new)</button><button type="button" data-v="before" aria-pressed="false">Golden original (today)</button></div></div>' +
      '<div class="rv-note"><b>Design review.</b> Every part number, description and dealer name here is SAMPLE data. Prices show as "Call" because no Golden data is loaded. Submitting a form is refused — nothing leaves this page.</div><div id="gsvHost"></div>';
    var root = document.getElementById("gsvHost").attachShadow({ mode: "open" });
    root.innerHTML = "<style>" + css + "</style><style data-d360-theme>" + theme + "</style>" + html;
    window.GSV_MOUNT(root, { parts: PARTS }, { send: function () { return Promise.resolve({ ok: false, error: "Design review — sample data only, nothing is sent" }); } });
    prefill(root);
    var themeEl = root.querySelector("style[data-d360-theme]");
    app.querySelectorAll(".rv-tog button").forEach(function (b) { b.addEventListener("click", function () {
      var after = b.getAttribute("data-v") === "after"; themeEl.textContent = after ? theme : "";
      app.querySelectorAll(".rv-tog button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    }); });
    if (/[?&]tab=/.test(location.search)) { var t = location.search.match(/[?&]tab=([a-z]+)/)[1]; var btn = [].slice.call(root.querySelectorAll(".tab-btn")).find(function (x) { return (x.getAttribute("onclick") || "").indexOf("'" + t + "'") >= 0; }); if (btn) btn.click(); }
    if (/[?&]design=before/.test(location.search)) { var bb = app.querySelector('.rv-tog [data-v="before"]'); if (bb) bb.click(); }
  }).catch(function (e) { app.innerHTML = '<div class="rv-off">The design review could not load: ' + String(e.message || e).replace(/[<>&]/g, "") + "</div>"; });
})();
