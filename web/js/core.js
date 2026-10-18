/* FraudLens core - shared state, helpers, tabs, tooltip, threshold sync */
window.FL = window.FL || {};

FL.$ = (s, r) => (r || document).querySelector(s);
FL.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

FL.state = { threshold: 0.5, currency: "$", tx: null };

/* ---- tiny event bus ---- */
FL.bus = (function () {
  const h = {};
  return {
    on(e, f) { (h[e] = h[e] || []).push(f); },
    emit(e, d) { (h[e] || []).forEach((f) => f(d)); },
  };
})();

/* ---- formatting ---- */
FL.fmt = {
  pct: (x, d) => (x * 100).toFixed(d === undefined ? 1 : d) + "%",
  num: (n) => Math.round(n).toLocaleString("en-US"),
  money: (n, d) => FL.state.currency + Number(n).toLocaleString("en-US", { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }),
  clock: (t) => {
    const day = Math.floor(t / 86400) + 1;
    const h = Math.floor((t % 86400) / 3600);
    const m = Math.floor((t % 3600) / 60);
    return "Day " + day + ", " + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  },
  hour: (t) => Math.floor(((t % 86400) / 3600)),
  sig: (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)),
};

FL.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
FL.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
FL.tipAttr = (s) => FL.esc(s).replace(/\n/g, "&#10;");

/* ---- toast ---- */
FL.toast = (function () {
  let t;
  return (msg) => {
    const el = FL.$("#toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(t);
    t = setTimeout(() => el.classList.remove("on"), 2600);
  };
})();

/* ---- tooltip: anything with data-tip ---- */
(function () {
  const tip = () => FL.$("#tip");
  function place(e) {
    const el = tip();
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 16;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    el.style.left = x + "px";
    el.style.top = y + "px";
  }
  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) return;
    const el = tip();
    el.textContent = t.getAttribute("data-tip");
    el.style.whiteSpace = "pre-line";
    el.classList.add("on");
    place(e);
  });
  document.addEventListener("mousemove", (e) => {
    if (tip().classList.contains("on")) {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (!t) tip().classList.remove("on");
      else { if (tip().textContent !== t.getAttribute("data-tip")) tip().textContent = t.getAttribute("data-tip"); place(e); }
    }
  });
  document.addEventListener("mouseout", (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) tip().classList.remove("on");
  });
})();

/* ---- count-up numbers ---- */
FL.countUp = function (el, to, opt) {
  opt = opt || {};
  const dec = opt.decimals || 0, dur = opt.dur || 1100, suf = opt.suffix || "", pre = opt.prefix || "";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const t0 = performance.now();
  const fmt = (v) => pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US")) + suf;
  if (reduce) { el.textContent = fmt(to); return; }
  function f(now) {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
};

/* ---- slider fill (the coloured part left of the thumb) ---- */
FL.fillRange = function (r) {
  const p = ((r.value - r.min) / (r.max - r.min)) * 100;
  r.style.setProperty("--p", p + "%");
};
document.addEventListener("input", (e) => {
  if (e.target.matches && e.target.matches("input[type=range]")) FL.fillRange(e.target);
});

/* ---- one alert threshold shared by every tab that shows one ---- */
FL.setThreshold = function (v, from) {
  v = FL.clamp(Math.round(v * 100) / 100, 0.05, 0.95);
  FL.state.threshold = v;
  FL.$$(".thr-range").forEach((r) => { if (r !== from) r.value = Math.round(v * 100); FL.fillRange(r); });
  FL.$$(".thr-val").forEach((s) => (s.textContent = Math.round(v * 100) + "%"));
  FL.bus.emit("threshold", v);
};
FL.bindThreshold = function () {
  FL.$$(".thr-range").forEach((r) => {
    r.addEventListener("input", () => FL.setThreshold(r.value / 100, r));
  });
  FL.setThreshold(FL.state.threshold);
};

/* ---- tabs (hash router) ---- */
FL.tabs = (function () {
  const names = FL.$$("[data-panel]").map((p) => p.dataset.panel);
  let current = null;
  const seen = {};
  function show(name) {
    if (!names.includes(name)) name = "overview";
    const prev = current;
    current = name;
    FL.$$("[data-panel]").forEach((p) => p.classList.toggle("on", p.dataset.panel === name));
    FL.$$("#tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === name));
    if (prev !== name) window.scrollTo({ top: 0, behavior: "auto" });
    if (prev) FL.bus.emit("hide:" + prev);
    if (!seen[name]) { seen[name] = true; FL.bus.emit("first:" + name); }
    FL.bus.emit("show:" + name);
    const a = FL.$('#tabs a[data-tab="' + name + '"]');
    if (a && a.scrollIntoView) a.scrollIntoView({ block: "nearest", inline: "center" });
  }
  function fromHash() { show((location.hash || "#overview").slice(1)); }
  addEventListener("hashchange", fromHash);
  return { start: fromHash, go: (n) => { if (location.hash === "#" + n) show(n); else location.hash = n; }, get current() { return current; } };
})();
