/* About the Data tab */
(function () {
  const S = window.FL_STATS;
  const share = S.fraud / S.total;
  const COLS = 100, CELLS = COLS * COLS;
  const nFraud = Math.max(1, Math.round(share * CELLS));
  let fraudSet = new Set(), revealed = false, raf = 0, shades = [];

  /* ---------- the basket ---------- */
  function pickFraud() {
    fraudSet = new Set();
    while (fraudSet.size < nFraud) fraudSet.add(Math.floor(Math.random() * CELLS));
  }
  function draw(t) {
    const c = FL.$("#basket"), g = c.getContext("2d");
    const s = c.width / COLS;
    g.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < CELLS; i++) {
      const x = (i % COLS) * s + s / 2, y = Math.floor(i / COLS) * s + s / 2;
      const isF = fraudSet.has(i);
      if (isF && revealed) continue;
      g.beginPath();
      g.arc(x, y, s * 0.34, 0, 7);
      g.fillStyle = isF ? "#7fa48e" : shades[i];
      g.fill();
    }
    if (revealed) {
      fraudSet.forEach((i) => {
        const x = (i % COLS) * s + s / 2, y = Math.floor(i / COLS) * s + s / 2;
        const k = ((t || 0) / 900 + i) % 1;
        g.beginPath(); g.arc(x, y, s * (0.9 + k * 2.2), 0, 7);
        g.strokeStyle = "rgba(196,65,42," + (0.55 * (1 - k)).toFixed(2) + ")"; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(x, y, s * 0.55, 0, 7);
        g.fillStyle = "#c4412a"; g.fill();
      });
    }
  }
  function loop(t) { draw(t); if (revealed) raf = requestAnimationFrame(loop); }

  function basket() {
    const palette = ["#86a994", "#7fa48e", "#8db09b", "#79a088", "#90b39f"];
    shades = Array.from({ length: CELLS }, () => palette[Math.floor(Math.random() * palette.length)]);
    pickFraud();
    draw();
    const c = FL.$("#basket");
    FL.$("#basketNote").innerHTML = "<b>" + nFraud + "</b> of these 10,000 dots are fraud, matching the real fraud rate of " + (share * 100).toFixed(2) + "% (about 1 in " + Math.round(1 / share) + "). Can you spot them?";
    FL.$("#btnReveal").addEventListener("click", () => {
      revealed = !revealed;
      FL.$("#btnReveal").textContent = revealed ? "Hide them again" : "Reveal the bad apples";
      cancelAnimationFrame(raf);
      if (revealed) raf = requestAnimationFrame(loop); else draw();
    });
    FL.$("#btnShake").addEventListener("click", () => {
      c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
      pickFraud();
      if (!revealed) draw();
    });
    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect();
      const col = Math.floor(((e.clientX - r.left) / r.width) * COLS), row = Math.floor(((e.clientY - r.top) / r.height) * COLS);
      const i = row * COLS + col;
      c.setAttribute("data-tip", fraudSet.has(i) && revealed ? "Fraud!" : revealed ? "Normal transaction" : "A transaction. Normal or fraud? Can't tell by looking.");
    });
  }

  /* ---------- lazy model ---------- */
  function lazy() {
    FL.$("#btnLazy").addEventListener("click", () => {
      FL.$("#lazyOut").classList.remove("hide");
      FL.countUp(FL.$("#lzAcc"), (1 - share) * 100, { decimals: 2, suffix: "%", dur: 1300 });
      FL.countUp(FL.$("#lzCaught"), 0, { dur: 300, suffix: " of " + FL.fmt.num(S.fraud) });
      FL.$("#lzCaught").textContent = "0 of " + FL.fmt.num(S.fraud);
    });
  }

  /* ---------- charts ---------- */
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  function amount() {
    const e = S.amountEdges;
    const lab = [];
    for (let i = 0; i < e.length - 1; i++) {
      const lo = e[i], hi = e[i + 1];
      const f = (v) => (v >= 1000 ? v / 1000 + "k" : v);
      lab.push(hi === null || hi === undefined ? f(lo) + "+" : f(lo) + "-" + f(hi));
    }
    const sn = sum(S.amountNormal), sf = sum(S.amountFraud);
    FL.charts.bars(FL.$("#amtChart"), {
      fmt: (v) => Math.round(v * 100) + "%",
      groups: lab.map((l, i) => ({
        label: l,
        vals: [
          { v: S.amountNormal[i] / sn, color: "#1b6a65", tip: "Normal: " + FL.fmt.pct(S.amountNormal[i] / sn) + " of normal transactions were " + l },
          { v: S.amountFraud[i] / sf, color: "#c4412a", tip: "Fraud: " + FL.fmt.pct(S.amountFraud[i] / sf) + " of frauds were " + l },
        ],
      })),
    });
  }
  function hours() {
    const sn = sum(S.hourNormal), sf = sum(S.hourFraud);
    FL.charts.bars(FL.$("#hourChart"), {
      fmt: (v) => Math.round(v * 100) + "%", hideLabels: 3,
      groups: S.hourNormal.map((c, h) => ({
        label: String(h).padStart(2, "0"),
        vals: [
          { v: c / sn, color: "#1b6a65", tip: "Normal, hour " + h + ": " + FL.fmt.pct(c / sn) },
          { v: S.hourFraud[h] / sf, color: "#c4412a", tip: "Fraud, hour " + h + ": " + FL.fmt.pct(S.hourFraud[h] / sf) },
        ],
      })),
    });
  }
  function importance() {
    const top = S.importance.slice(0, 12), mx = top[0][1];
    FL.charts.hbars(FL.$("#impChart"), top.map(([n, v]) => ({
      n, w: v / mx, p: (v * 100).toFixed(1) + "%",
      tip: n + ": " + (v * 100).toFixed(1) + "% of the forest's decision-making weight",
    })));
  }
  const fv = (n, v) => (n === "Time" ? FL.fmt.clock(v) : n === "Amount" ? FL.fmt.money(v, 0) : FL.fmt.sig(v));
  function explorer() {
    const sel = FL.$("#featSelect");
    sel.innerHTML = S.importance.map(([n], i) => "<option value=\"" + n + "\">" + n + (i === 0 ? "  (most important)" : "") + "</option>").join("");
    const go = () => {
      const n = sel.value, f = S.feat[n];
      FL.charts.areas(FL.$("#featChart"), { a: f.dn, b: f.df, colors: ["#1b6a65", "#c4412a"], xLo: fv(n, f.hlo), xHi: fv(n, f.hhi) });
      FL.$("#featNote").innerHTML = "Average for normal: <b>" + fv(n, f.mean_n) + "</b>. Average for fraud: <b>" + fv(n, f.mean_f) + "</b>. The more the two shapes pull apart, the more that column helps the model.";
    };
    sel.addEventListener("change", go);
    go();
  }

  FL.bus.on("first:data", () => {
    FL.$("#dataLede").innerHTML = FL.fmt.num(S.total) + " card transactions, and only <b>" + FL.fmt.num(S.fraud) + "</b> of them (" + (share * 100).toFixed(2) + "%) were fraud. Each row has a time, an amount and 28 scrambled columns, plus a label: 0 for normal, 1 for fraud.";
    basket(); lazy(); amount(); hours(); importance(); explorer();
  });
  FL.bus.on("hide:data", () => { cancelAnimationFrame(raf); });
  FL.bus.on("show:data", () => { if (revealed && FL.$("#basket")) raf = requestAnimationFrame(loop); });
})();
