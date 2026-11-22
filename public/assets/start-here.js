/* START HERE (owner milestone 2026-11-22 §3) — the portal tour video (captions + chapters + transcript) and the guided
   walkthroughs. Loaded on demand by index.html (shLoad); the page hands in its own navigation through HCPSStart.init(ctx).
   Nothing here changes data: the walkthroughs only open screens the dealer could open and point at the control to use.
   Everything shown is built with textContent / DOM nodes (no HTML from data). */
(function () {
  "use strict";
  const V = "/start-here/";
  let CTX = null, TOUR = null, IDX = 0, POLL = null, LASTFOCUS = null, MEET = null;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, attrs, kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } (kids || []).forEach((c) => c && e.appendChild(c)); return e; };
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const firstVis = (sel) => { for (const e of document.querySelectorAll(sel)) if (vis(e)) return e; return null; };

  const css = `
  .sh-modal{position:fixed;inset:0;background:rgba(7,20,38,.72);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px}
  .sh-box{background:#fff;border-radius:14px;max-width:980px;width:100%;max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .sh-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e5e9f0}
  .sh-head h2{margin:0;font-size:18px;color:#0b1f33}
  .sh-x{min-width:44px;min-height:44px;border:0;background:#f1f4f8;border-radius:10px;font-size:20px;cursor:pointer}
  .sh-body{padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:14px}
  .sh-body video{width:100%;border-radius:10px;background:#0b1f33;aspect-ratio:16/9}
  .sh-ch{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
  .sh-ch button{width:100%;text-align:left;min-height:44px;border:1px solid #d7dee8;background:#fff;border-radius:10px;padding:8px 10px;cursor:pointer;font:inherit;font-size:13.5px;color:#0b1f33}
  .sh-ch button[aria-current="true"]{border-color:#1681c2;background:#eef6fc}
  .sh-ch small{display:block;color:#64748b}
  .sh-tr{grid-column:1/-1}
  .sh-tr summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600;color:#0b1f33}
  .sh-tr h4{margin:12px 0 4px;font-size:14px;color:#0b1f33}
  .sh-tr p{margin:0 0 6px;font-size:13.5px;line-height:1.5;color:#334155}
  .sh-nbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.sh-nar{min-height:44px}.sh-nnote{font-size:12.5px;color:#64748b}
  .mv-stage{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;padding:10px 6px}.mv-orb{width:120px;height:120px;border-radius:50%;object-fit:cover;box-shadow:0 0 30px rgba(22,129,194,.45)}
  .mv-orb.talk{animation:mvp 1.2s ease-in-out infinite}@keyframes mvp{50%{transform:scale(1.06);box-shadow:0 0 44px rgba(22,129,194,.7)}}@media (prefers-reduced-motion:reduce){.mv-orb.talk{animation:none}}
  .mv-cap{font-size:18px;line-height:1.45;color:#0b1f33;max-width:640px;min-height:3.2em}.mv-prog{font-size:12.5px;color:#64748b}.mv-b{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.mv-b button,.mv-b a{min-height:44px}
  .sh-links{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}
  .sh-links a{min-height:44px;display:inline-flex;align-items:center}
  @media (max-width:760px){ .sh-body{grid-template-columns:1fr} .sh-modal{padding:0} .sh-box{max-height:100vh;height:100vh;border-radius:0} }
  .wt-hl{outline:3px solid #ef6325 !important;outline-offset:3px;border-radius:8px;box-shadow:0 0 0 8px rgba(239,99,37,.18) !important;transition:outline-color .2s}
  #wtCoach{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:10040;width:min(460px,calc(100vw - 24px));background:#0b1f33;color:#fff;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.35);padding:14px 16px}
  #wtCoach .k{font-size:12px;color:#fcb21e;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
  #wtCoach h3{margin:4px 0 6px;font-size:16px;color:#fff}
  #wtCoach p{margin:0 0 10px;font-size:13.5px;line-height:1.5;color:#dbe6f3}
  #wtCoach .st{font-size:12.5px;color:#fcb21e;margin:-4px 0 8px;min-height:1em}
  #wtCoach .b{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  #wtCoach button{min-height:44px;padding:0 14px;border-radius:10px;border:0;font:inherit;font-size:14px;cursor:pointer}
  #wtCoach .pri{background:#ef6325;color:#fff;font-weight:700}
  #wtCoach .gh{background:rgba(255,255,255,.12);color:#fff}
  #wtCoach .end{margin-right:auto;background:transparent;color:#dbe6f3;text-decoration:underline}
  @media (max-width:600px){ #wtCoach{bottom:0;border-radius:14px 14px 0 0;width:100vw} }
  @media (prefers-reduced-motion:reduce){ .wt-hl{transition:none} }`;
  function style() { if (!document.getElementById("shCss")) document.head.appendChild(el("style", { id: "shCss", text: css })); }

  /* ---------- the tour video ---------- */
  function parseVtt(txt) {
    const out = []; const blocks = String(txt || "").replace(/\r/g, "").split(/\n\n+/);
    const sec = (s) => { const m = s.trim().match(/(?:(\d+):)?(\d+):(\d+)\.(\d+)/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000 : 0; };
    for (const b of blocks) { const L = b.split("\n").filter(Boolean); const i = L.findIndex((x) => x.includes("-->")); if (i < 0) continue;
      const [a, z] = L[i].split("-->"); out.push({ start: sec(a), end: sec(z), text: L.slice(i + 1).join(" ") }); }
    return out;
  }
  const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  /* ---------- Victoria's narration (owner 2026-11-22: her configured Deepgram voice for portal presentations) ----------
     Each caption cue of the tour (and each part of "Meet Victoria") is a fixed text the server knows; it answers with the
     stored audio in the owner's Command Center voice. The tour video itself has no sound: the narrator plays the cue under
     the playhead, follows play / pause / seek / chapter jumps, the video's volume and mute, and never starts mid-sentence
     (a jump lands on a cue's start). Without Victoria (switched off, no voice) the captioned video plays as before. */
  const NAR = { cache: new Map(), log: [] };
  function cueAudio(set, i) {
    const k = set + ":" + i; if (NAR.cache.has(k)) return NAR.cache.get(k);
    const p = (CTX && CTX.narration ? CTX.narration(set, i) : Promise.resolve(null)).then((j) => (j && j.ok && j.audio ? "data:" + (j.mime || "audio/mpeg") + ";base64," + j.audio : null)).catch(() => null);
    NAR.cache.set(k, p); p.then((u) => { if (!u) NAR.cache.delete(k); }); return p;
  }
  function narrator(vid, caps, toggle, note) {
    const A = new Audio(); A.preload = "auto"; A.setAttribute("playsinline", ""); let cur = -1, on = true, gen = 0;
    const st = { get cue() { return cur; }, get playing() { return !A.paused && !A.ended; }, get on() { return on; }, audio: A };
    const idx = (t) => caps.findIndex((c) => t >= c.start - 0.05 && t < c.end);
    const vol = () => { A.volume = vid.volume; A.muted = vid.muted; };
    async function startCue(k) {
      const my = ++gen; A.pause(); cur = k; if (k < 0 || !on) return;
      const t = vid.currentTime; if (t - caps[k].start > 1.5) return;             // never start mid-sentence
      const url = await cueAudio("tour", k); if (my !== gen) return;
      if (!url) { note.textContent = "Victoria's narration isn't available just now — captions are on."; return; }
      note.textContent = ""; A.src = url; vol();
      A.onloadedmetadata = () => { const win = Math.max(1, caps[k].end - Math.max(vid.currentTime, caps[k].start)); A.playbackRate = Math.min(1.2, Math.max(1, (A.duration || 0) / win)); };
      if (!vid.paused) A.play().catch(() => { note.textContent = "Tap play again to hear Victoria."; });
      if (k + 1 < caps.length) cueAudio("tour", k + 1);                              // the next cue is ready before it is needed
    }
    const tick = () => { if (!on) return; const k = idx(vid.currentTime); if (k !== cur) startCue(k); else if (!vid.paused && A.paused && A.src && A.currentTime > 0 && !A.ended) A.play().catch(() => {}); };
    vid.addEventListener("timeupdate", tick); vid.addEventListener("play", () => { cur = -1; tick(); }); vid.addEventListener("pause", () => A.pause());
    vid.addEventListener("seeking", () => { gen++; A.pause(); cur = -1; }); vid.addEventListener("seeked", tick); vid.addEventListener("volumechange", vol);
    vid.addEventListener("ended", () => A.pause());
    toggle.addEventListener("click", () => { on = !on; toggle.setAttribute("aria-pressed", String(on)); toggle.textContent = on ? "🔊 Victoria narrates — on" : "🔇 Victoria narrates — off"; if (!on) { gen++; A.pause(); } else { cur = -1; tick(); } });
    if (caps.length) cueAudio("tour", 0);
    return st;
  }
  async function video() {
    style(); close(); LASTFOCUS = document.activeElement;
    let chapters = [], caps = [];
    try { const [c, k] = await Promise.all([fetch(V + "tour-chapters.vtt").then((r) => r.ok ? r.text() : ""), fetch(V + "tour.en.vtt").then((r) => r.ok ? r.text() : "")]); chapters = parseVtt(c); caps = parseVtt(k); } catch (e) {}
    const vid = el("video", { controls: "", preload: "metadata", playsinline: "", poster: V + "tour-poster.jpg", "aria-label": "360 Dealer Portal tour, four minutes, captioned" }, [
      el("source", { src: V + "tour.mp4", type: "video/mp4" }),
      el("track", { kind: "captions", src: V + "tour.en.vtt", srclang: "en", label: "English", default: "" }),
      el("track", { kind: "chapters", src: V + "tour-chapters.vtt", srclang: "en", label: "Chapters" })]);
    vid.addEventListener("error", () => { const n = vid.parentNode; if (n) n.replaceChild(el("div", { class: "msg", text: "The video could not be played here. The transcript below covers everything it shows." }), vid); }, true);
    const ntog = el("button", { class: "btn gh sh-nar", type: "button", "aria-pressed": "true", text: "🔊 Victoria narrates — on" });
    const nnote = el("div", { class: "sh-nnote", role: "status" });
    const NARR = CTX && CTX.narration ? narrator(vid, caps, ntog, nnote) : null; if (!NARR) ntog.hidden = true; window.__shTourNarr = NARR;
    const list = el("ol", { class: "sh-ch", "aria-label": "Chapters" });
    chapters.forEach((c, i) => list.appendChild(el("li", {}, [el("button", { type: "button", "data-ch": String(i), onclick: () => { vid.currentTime = c.start + 0.05; vid.play().catch(() => {}); } }, [document.createTextNode(c.text), el("small", { text: fmt(c.start) })])])));
    vid.addEventListener("timeupdate", () => { const t = vid.currentTime; list.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", String(t >= chapters[i].start && t < chapters[i].end))); });
    const tr = el("details", { class: "sh-tr" }, [el("summary", { text: "Transcript" })]);
    chapters.forEach((c) => { tr.appendChild(el("h4", { text: c.text + " (" + fmt(c.start) + ")" }));
      tr.appendChild(el("p", { text: caps.filter((x) => x.start >= c.start && x.start < c.end).map((x) => x.text).join(" ") })); });
    const links = el("div", { class: "sh-links" }, [
      el("a", { class: "btn gh", href: V + "guide.html", target: "_blank", rel: "noopener", text: "Open the one-page guide" }),
      el("a", { class: "btn gh", href: "#", onclick: (e) => { e.preventDefault(); close(); tour("quote"); }, text: "Walk me through: product → customer quote" })]);
    const box = el("div", { class: "sh-box", role: "dialog", "aria-modal": "true", "aria-labelledby": "shTitle" }, [
      el("div", { class: "sh-head" }, [el("h2", { id: "shTitle", text: "360 Dealer Portal tour — 4 minutes" }), el("button", { class: "sh-x", type: "button", "aria-label": "Close the tour video", text: "×", onclick: close })]),
      el("div", { class: "sh-body" }, [el("div", {}, [vid, el("div", { class: "sh-nbar" }, [ntog, nnote])]), list, tr, links])]);
    const m = el("div", { class: "sh-modal", id: "shModal", onclick: (e) => { if (e.target === m) close(); } }, [box]);
    m.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    document.body.appendChild(m); $(".sh-x", m).focus();
    return { ok: true, video: vid, narration: NARR };
  }
  /* ---------- Meet Victoria — the one-minute guide, narrated by Victoria (owner 2026-11-22) ----------
     Six short parts; each shows its words (the captions) while Victoria says them. Play / Pause / Replay; a part can be chosen;
     the full transcript is underneath. Ends with "Ask Victoria" (opens her exactly like a tap on the globe). */
  const MEET_TEXT = ["Hi, I am Victoria, your assistant in the 360 Dealer Portal. Tap my blue globe at the bottom right whenever you need me.",
    "Ask me in your own words, by typing or by talking. I answer from your own account, never from another dealer's.",
    "I can find products and open their pages, tell you your dealer price on the lines you carry, and show what Medicare and Medicaid allow for a coded product.",
    "I can check where an order is, open its tracking, and start a draft customer quote for you to review.",
    "I can also draft social media ads and brochures, and take you to reports, local referral sources and training.",
    "I never place orders, send emails or publish anything on my own. You always make the final choice. Tap Ask Victoria to try me."];
  function meet() {
    style(); close(); LASTFOCUS = document.activeElement;
    const A = new Audio(); A.preload = "auto"; A.setAttribute("playsinline", "");
    let i = 0, playing = false, gen = 0;
    const orb = el("img", { class: "mv-orb", src: "/assets/victoria/orb-still.webp", alt: "" });
    const cap = el("div", { class: "mv-cap", "aria-live": "polite" }); const prog = el("div", { class: "mv-prog" }); const note = el("div", { class: "sh-nnote", role: "status" });
    const play = el("button", { class: "btn pri", type: "button", text: "▶ Play" });
    const parts = el("ol", { class: "sh-ch", "aria-label": "Parts" });
    MEET_TEXT.forEach((t, k) => parts.appendChild(el("li", {}, [el("button", { type: "button", "data-mv": String(k), onclick: () => go(k, true) }, [document.createTextNode((k + 1) + ". " + t.split(/[.,]/)[0])])])));
    const tr = el("details", { class: "sh-tr" }, [el("summary", { text: "Transcript" })]); MEET_TEXT.forEach((t) => tr.appendChild(el("p", { text: t })));
    const ask = el("button", { class: "btn gh", type: "button", text: "Ask Victoria", onclick: () => { close(); if (window.__dvOpen) window.__dvOpen(); } });
    function show(k) { i = k; cap.textContent = MEET_TEXT[k]; prog.textContent = "Part " + (k + 1) + " of " + MEET_TEXT.length + " · about one minute";
      parts.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-current", String(j === k))); }
    async function go(k, start) {
      const my = ++gen; A.pause(); show(k); if (!start) return;
      playing = true; play.textContent = "❚❚ Pause"; orb.classList.add("talk");
      const url = await cueAudio("meet", k); if (my !== gen) return;
      if (k + 1 < MEET_TEXT.length) cueAudio("meet", k + 1);
      if (!url) { note.textContent = "Victoria's voice isn't available just now — the words are shown above."; orb.classList.remove("talk"); setTimeout(() => { if (my === gen && playing) next(); }, 4500); return; }
      note.textContent = ""; A.src = url; A.play().catch(() => { playing = false; play.textContent = "▶ Play"; orb.classList.remove("talk"); note.textContent = "Tap Play to hear Victoria."; });
    }
    function next() { if (i + 1 < MEET_TEXT.length) go(i + 1, true); else { playing = false; play.textContent = "↺ Replay"; orb.classList.remove("talk"); try { ask.focus(); } catch (e) {} } }
    A.addEventListener("ended", () => { if (playing) next(); });
    play.addEventListener("click", () => { if (playing) { gen++; A.pause(); playing = false; play.textContent = "▶ Play"; orb.classList.remove("talk"); return; }
      if (play.textContent.indexOf("Replay") >= 0) go(0, true); else if (A.src && A.currentTime > 0 && !A.ended) { playing = true; play.textContent = "❚❚ Pause"; orb.classList.add("talk"); A.play().catch(() => {}); } else go(i, true); });
    show(0); cueAudio("meet", 0);
    MEET = { stop: () => { gen++; A.pause(); playing = false; }, audio: A, get part() { return i; }, get playing() { return playing; } };
    const box = el("div", { class: "sh-box", role: "dialog", "aria-modal": "true", "aria-labelledby": "shTitle" }, [
      el("div", { class: "sh-head" }, [el("h2", { id: "shTitle", text: "Meet Victoria — one minute" }), el("button", { class: "sh-x", type: "button", "aria-label": "Close Meet Victoria", text: "×", onclick: close })]),
      el("div", { class: "sh-body" }, [el("div", { class: "mv-stage" }, [orb, cap, prog, el("div", { class: "mv-b" }, [play, ask, el("a", { class: "btn gh", href: V + "guide.html#victoria", target: "_blank", rel: "noopener", text: "Written guide" })]), note]), parts, tr])]);
    const m = el("div", { class: "sh-modal", id: "shModal", onclick: (e) => { if (e.target === m) close(); } }, [box]);
    m.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    document.body.appendChild(m); play.focus();
    return { ok: true, meet: MEET };
  }
  function close() { const m = document.getElementById("shModal"); if (m) { const v = $("video", m); if (v) v.pause(); m.querySelectorAll("audio").forEach((a) => a.pause()); if (MEET) { MEET.stop(); MEET = null; } m.remove(); if (LASTFOCUS && LASTFOCUS.focus) LASTFOCUS.focus(); } }

  /* ---------- guided walkthroughs ---------- */
  const TOURS = {
    quote: { title: "Find a product and make a customer quote", steps: [
      { t: "Open a line you can order", d: "Shop Products lists every manufacturer on your account. Open one — or type a product name, model or part number in the search box at the top.",
        sel: "#content [data-open], .sl-grid .sl-tile:not([hidden]), #gsearch", show: () => CTX.openFirstLine(), done: () => !!firstVis("#content [data-open]") },
      { t: "Open a product", d: "Tap a product name (or Choose options) to open its page with photos, your price and the details.",
        sel: "#content [data-open]", show: () => { const a = firstVis("#content [data-open]"); if (a) a.click(); }, done: () => !!firstVis("#content .pd[data-pd-code]") },
      { t: "Your price and the product details", d: "The price shown is your own dealer price. Below the photos, Provider Reimbursement shows the published Medicare and Medicaid allowance for coded products.",
        sel: "#content .pd .pd-info, #content .pd", done: () => true },
      { t: "Add it to a customer quote", d: "Press Add to a quote. The product goes onto your current customer quote draft with its exact model and options (Show me adds it for you — nothing is saved or sent; remove it any time).",
        sel: "#content .pd [onclick^='pdAddQuote'], #content .pd [data-gquote], #content .pd [data-gb-quote]", show: () => { const b = firstVis("#content .pd [onclick^='pdAddQuote'], #content .pd [data-gquote], #content .pd [data-gb-quote]"); if (b) b.click(); },
        done: () => !!firstVis("#view-quotes .qacts") },
      { t: "Choose the customer's price, then print or email", d: "For each line pick the price your customer sees — the manufacturer's MSRP, your saved retail price or a one-time price. Save the quote, then Print / PDF or Email it. Your dealer cost never appears on the customer's copy.",
        sel: "#view-quotes .qacts, #view-quotes select", done: () => true } ] },
    referrals: { title: "Find local referral sources", needs: "referrals", steps: [
      { t: "Open Resources & Support", d: "Find local referral sources is under Resources & Support (and in Reports, Growth & Ideas).",
        sel: "#rsRef a, #view-resources .rs-nav", show: () => CTX.showP360("resources"), done: () => !!firstVis("#rsRef a") },
      { t: "Open Find local referral sources", d: "It lists clinicians near you who ordered a product code from Original Medicare, from CMS's published data.",
        sel: "#rsRef a", show: () => { const a = firstVis("#rsRef a"); if (a) a.click(); }, done: () => !!firstVis("#view-referrals .rf") },
      { t: "Pick the product code", d: "Type a HCPCS code or product words — for example E0260 or a hospital bed — and choose the code. Show me types E0260 (semi-electric hospital bed) and chooses it. The published allowance for that code shows at the top.",
        sel: "#view-referrals #rfQ, #view-referrals #rfCodes", show: async () => {
          const q = firstVis("#view-referrals #rfQ"); if (!q) return; q.focus(); q.value = "E0260"; q.dispatchEvent(new Event("input", { bubbles: true }));
          q.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          for (let i = 0; i < 40 && !firstVis('#view-referrals [data-code][aria-pressed="true"]'); i++) {
            const b = firstVis('#view-referrals [data-code="E0260"]'); if (b) { b.click(); break; } await new Promise((r) => setTimeout(r, 250)); } },
        done: () => !!firstVis('#view-referrals [data-code][aria-pressed="true"]') },
      { t: "Set the search area", d: "By default it looks within 25 miles (straight line) of your branch ZIP. You can change the center ZIP or search exact office ZIPs.",
        sel: "#view-referrals #rfMode, #view-referrals #rfCenter", done: () => true },
      { t: "Find referral sources", d: "Press Find referral sources. The clinicians appear below, nearest first.",
        sel: '#view-referrals [data-a="search"]', show: () => { const b = firstVis('#view-referrals [data-a="search"]'); if (b) b.click(); },
        done: () => { const o = $("#view-referrals #rfOut"); return !!(o && (o.querySelector(".rfl tbody tr") || o.querySelector(".msg"))); } },
      { t: "Read the results", d: "Each row is one clinician's office and how often they ordered this code. \"Withheld by CMS\" means fewer than 11 — never zero. Copy office details to plan your visits.",
        sel: "#view-referrals #rfOut", done: () => true },
      { t: "Go back", d: "← Back returns you to where you started — here, Resources & Support.",
        sel: '#view-referrals [data-a="back"]', show: () => { const b = firstVis('#view-referrals [data-a="back"]'); if (b) b.click(); },
        done: () => !!firstVis("#view-resources .rs-nav") } ] },
  };
  function clearHl() { document.querySelectorAll(".wt-hl").forEach((e) => e.classList.remove("wt-hl")); }
  function endTour() { clearInterval(POLL); POLL = null; clearHl(); const c = document.getElementById("wtCoach"); if (c) c.remove(); TOUR = null; }
  async function tour(key) {
    const T = TOURS[key]; if (!T) return { ok: false, reason: "unknown" };
    if (T.needs === "referrals" && !(await CTX.refEnabled())) return { ok: false, reason: "not_available" };
    style(); endTour(); TOUR = key; IDX = 0; render(); return { ok: true, tour: key, title: T.title };
  }
  function render() {
    const T = TOURS[TOUR]; if (!T) return; const s = T.steps[IDX];
    let c = document.getElementById("wtCoach");
    if (!c) { c = el("div", { id: "wtCoach", role: "dialog", "aria-live": "polite", "aria-label": "Guided walkthrough" }); document.body.appendChild(c); }
    c.textContent = "";
    c.appendChild(el("div", { class: "k", text: T.title + " · step " + (IDX + 1) + " of " + T.steps.length }));
    c.appendChild(el("h3", { text: s.t })); c.appendChild(el("p", { text: s.d }));
    const st = el("div", { class: "st" }); c.appendChild(st);
    const last = IDX === T.steps.length - 1;
    const bar = el("div", { class: "b" }, [
      el("button", { class: "end", type: "button", text: "End walkthrough", onclick: endTour }),
      IDX > 0 ? el("button", { class: "gh", type: "button", text: "Back", onclick: () => { IDX--; render(); } }) : null,
      s.show ? el("button", { class: "gh", type: "button", text: "Show me", onclick: async () => { st.textContent = "Opening…"; try { await s.show(); } catch (e) {} } }) : null,
      el("button", { class: "pri", type: "button", text: last ? "Finish" : "Next", onclick: () => { if (!s.done()) { st.textContent = s.show ? "Do this step first — or press Show me." : "Do this step first."; return; } if (last) endTour(); else { IDX++; render(); } } })]);
    c.appendChild(bar);
    clearInterval(POLL); let lastT = null;
    const hl = () => { const t = firstVis(s.sel); if (t !== lastT) { clearHl(); if (t) { t.classList.add("wt-hl"); t.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } lastT = t; }
      if (s.done() && st.textContent && !/✓/.test(st.textContent)) st.textContent = "✓ Done — press " + (last ? "Finish." : "Next."); };
    hl(); POLL = setInterval(() => { if (!document.getElementById("wtCoach")) { clearInterval(POLL); return; } hl(); }, 500);
    const b = $("button.pri", c); if (b) b.focus({ preventScroll: true });
  }

  window.HCPSStart = { init(ctx) { CTX = ctx; }, video, meet, close, tour, endTour, TOURS, MEET_TEXT, _parseVtt: parseVtt, _narration: NAR };
})();
