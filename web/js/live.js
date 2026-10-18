/* Live Monitor tab - replays held-back transactions through the model */
(function () {
  const E = FL.engine, P = window.FL_POOL;
  const fraudIdx = [], normIdx = [];
  P.y.forEach((y, i) => (y ? fraudIdx : normIdx).push(i));
  const FRAUD_SHARE = 0.125;

  let timer = null, running = false, n = 0, ids = 1000;
  const st = { seen: 0, flag: 0, stop: 0, falseA: 0, miss: 0 };
  const hist = [];
  const feed = () => FL.$("#liveFeed");

  const pick = () => {
    const pool = Math.random() < FRAUD_SHARE ? fraudIdx : normIdx;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  function tick() {
    const i = pick(), row = P.rows[i], y = P.y[i];
    const score = E.score(row), th = FL.state.threshold, flagged = score >= th;
    const amount = row[E.idx.Amount];
    st.seen++;
    if (flagged) { st.flag++; if (y) st.stop += amount; else st.falseA++; }
    else if (y) st.miss++;
    hist.push({ s: score, y });
    if (hist.length > 60) hist.shift();

    if (feed().querySelector(".callout")) feed().innerHTML = "";
    const el = document.createElement("div");
    el.className = "tx" + (flagged ? " fl" : "");
    el.title = "Click to inspect this transaction";
    el.innerHTML = '<span class="id">TX-' + ++ids + '</span><span class="amt">' + FL.fmt.money(amount) + " <span class='muted small'>&middot; " + FL.fmt.clock(row[E.idx.Time]).replace("Day ", "D") +
      '</span></span><span class="bar-col"><span class="scorebar" style="width:100px"><i style="width:' + Math.max(2, score * 100) + "%;background:" + (flagged ? "#c4412a" : "#3b8758") + '"></i></span><span class="mono small">' + (score * 100).toFixed(0) + "%</span></span>" +
      '<span class="st"><span class="chip ' + (flagged ? "red" : "green") + '">' + (flagged ? "flagged" : "approved") + "</span></span>";
    el.addEventListener("click", () => FL.check.open(row, { id: "TX-" + ids, label: y }));
    feed().prepend(el);
    while (feed().children.length > 9) feed().lastChild.remove();
    renderStats();
    sparkline();
  }

  function renderStats() {
    FL.$("#lvSeen").textContent = FL.fmt.num(st.seen);
    FL.$("#lvFlag").textContent = FL.fmt.num(st.flag);
    FL.$("#lvStop").textContent = FL.fmt.money(st.stop, 0);
    FL.$("#lvFalse").textContent = FL.fmt.num(st.falseA);
    FL.$("#lvMiss").textContent = FL.fmt.num(st.miss);
  }

  function sparkline() {
    const svg = FL.$("#liveSpark");
    const W = 400, H = 170, l = 34, r = 8, t = 10, b = 14, iw = W - l - r, ih = H - t - b;
    const Y = (v) => t + ih - v * ih;
    let h = "";
    [0, 0.5, 1].forEach((v) => (h += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#ddd5c3"/><text x="' + (l - 6) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + v * 100 + "%</text>"));
    const th = FL.state.threshold;
    h += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(th) + '" y2="' + Y(th) + '" stroke="#c4412a" stroke-dasharray="5 4" stroke-width="1.6"/>';
    const step = iw / 59;
    hist.forEach((p, i) => {
      const x = l + (59 - (hist.length - 1 - i)) * step;
      const f = p.s >= th;
      h += '<circle cx="' + x + '" cy="' + Y(p.s) + '" r="' + (f ? 4.2 : 2.8) + '" fill="' + (f ? "#c4412a" : "#1b6a65") + '" opacity="' + (f ? 1 : 0.75) + '" data-tip="' + (p.s * 100).toFixed(0) + '% fraud chance' + (p.y ? " (actually fraud)" : "") + '"' + (p.y ? ' stroke="#1b2a2e" stroke-width="1.6"' : "") + "/>";
    });
    svg.innerHTML = h + '<text x="' + (W - r) + '" y="' + (H - 1) + '" text-anchor="end" style="font-size:9.5px">newest &rarr;   dark ring = really fraud</text>';
  }

  function setRunning(on) {
    running = on;
    clearInterval(timer);
    FL.$("#liveLabel").textContent = on ? "Pause" : st.seen ? "Resume" : "Start";
    FL.$(".pulse").classList.toggle("on", on);
    if (on) {
      const ms = 1000 / (+FL.$("#liveSpeed").value * 0.9);
      timer = setInterval(tick, ms);
    }
  }

  FL.bus.on("first:live", () => {
    FL.$("#liveToggle").addEventListener("click", () => setRunning(!running));
    FL.$("#liveSpeed").addEventListener("input", () => { if (running) setRunning(true); });
    FL.$("#liveClear").addEventListener("click", () => {
      Object.keys(st).forEach((k) => (st[k] = 0));
      hist.length = 0;
      feed().innerHTML = '<div class="callout">Cleared. Press <b>Start</b> to begin screening payments.</div>';
      renderStats(); sparkline();
      if (running) setRunning(false);
    });
    sparkline();
  });
  FL.bus.on("hide:live", () => { if (running) { setRunning(false); FL.toast("Live Monitor paused while you're away"); } });
  FL.bus.on("threshold", () => { if (FL.$("#liveSpark").children.length) sparkline(); });
})();
