/* Check a Transaction tab */
FL.check = (function () {
  const P = window.FL_POOL, S = window.FL_STATS, E = FL.engine;
  const names = E.names;
  const nV = names.filter((n) => /^V\d+$/.test(n));
  const imp = S.importance.map((x) => x[0]);
  const LETTERS = "ABCDEFGHIJKLMNOP";
  const GW = { cx: 110, cy: 110, r: 90 };

  let base = null, cur = null, meta = null, revealed = false, shown = 0, rafId = 0, built = false;

  const label = (n) => (n === "Time" ? "Time" : n);
  const fmtVal = (n, v) => (n === "Time" ? FL.fmt.clock(v) : n === "Amount" ? FL.fmt.money(v) : FL.fmt.sig(v));

  /* ---------- picker ---------- */
  function buildPicker() {
    FL.$("#picker").innerHTML = P.samples.map((s, k) => {
      const row = P.rows[s.i];
      return '<button class="pick" data-i="' + s.i + '" data-k="' + k + '"><b>Sample ' + LETTERS[k] + "</b><span>" +
        FL.fmt.money(row[E.idx.Amount]) + " &middot; " + FL.fmt.clock(row[E.idx.Time]).replace("Day ", "D") + "</span></button>";
    }).join("");
    FL.$("#picker").addEventListener("click", (e) => {
      const b = e.target.closest(".pick");
      if (!b) return;
      const i = +b.dataset.i;
      open(P.rows[i], { id: "Sample " + LETTERS[+b.dataset.k], label: P.y[i], pick: b });
    });
    FL.$("#btnRandom").addEventListener("click", () => {
      const i = Math.floor(Math.random() * P.rows.length);
      open(P.rows[i], { id: "Random #" + (i + 1), label: P.y[i] });
    });
    FL.$("#btnReset").addEventListener("click", () => { cur = base.slice(); syncWhatIf(); renderResult(); FL.toast("Back to the original transaction"); });
  }

  /* ---------- opening a transaction ---------- */
  function open(row, m) {
    base = Array.from(row);
    cur = base.slice();
    meta = m || { id: "Transaction", label: null };
    revealed = false;
    lastFlag = null;
    FL.$$(".pick").forEach((p) => p.classList.remove("on"));
    if (meta.pick) meta.pick.classList.add("on");
    else if (meta.id.startsWith("Sample")) { const b = FL.$$(".pick").find((p) => p.textContent.indexOf(meta.id) === 0); if (b) b.classList.add("on"); }
    renderSlip();
    buildWhatIf();
    renderResult();
  }

  /* ---------- slip + fingerprint ---------- */
  function renderSlip() {
    FL.$("#slipKv").innerHTML =
      "<dt>Transaction</dt><dd>" + FL.esc(meta.id) + "</dd>" +
      "<dt>Amount</dt><dd>" + FL.fmt.money(base[E.idx.Amount]) + "</dd>" +
      "<dt>When</dt><dd>" + FL.fmt.clock(base[E.idx.Time]) + "</dd>" +
      "<dt>Hidden columns</dt><dd>V1 &hellip; V28</dd>";
    FL.$("#fprint").innerHTML = nV.map((n) => {
      const v = base[E.idx[n]], f = S.feat[n];
      const span = Math.max((f.hi - f.lo) / 4.65, 1e-6);
      const z = FL.clamp((v - f.median) / span, -3, 3) / 3;
      return '<i style="background:' + ramp(z) + '" data-tip="' + FL.tipAttr(n + " = " + FL.fmt.sig(v) + "\ntypical " + FL.fmt.sig(f.median)) + '"></i>';
    }).join("");
  }
  function mix(a, b, t) { return a.map((c, i) => Math.round(c + (b[i] - c) * t)); }
  function ramp(z) {
    const mid = [233, 227, 211], lo = [62, 127, 166], hi = [196, 65, 42];
    const c = z < 0 ? mix(mid, lo, -z) : mix(mid, hi, z);
    return "rgb(" + c.join(",") + ")";
  }

  /* ---------- what-if sliders ---------- */
  const topCols = () => imp.slice(0, 6);
  function buildWhatIf() {
    FL.$("#whatif").innerHTML = topCols().map((n) => {
      const f = S.feat[n], i = E.idx[n];
      let lo = Math.min(f.lo, base[i]), hi = Math.max(f.hi, base[i]);
      return '<div class="wi"><span class="nm">' + label(n) + '</span><input type="range" data-n="' + n + '" min="' + lo + '" max="' + hi + '" step="' + (hi - lo) / 300 + '" value="' + cur[i] + '" aria-label="' + n + '"><span class="val" data-v="' + n + '">' + fmtVal(n, cur[i]) + "</span></div>";
    }).join("");
    FL.$$("#whatif input").forEach((r) => {
      FL.fillRange(r);
      r.addEventListener("input", () => {
        cur[E.idx[r.dataset.n]] = +r.value;
        FL.$('[data-v="' + r.dataset.n + '"]').textContent = fmtVal(r.dataset.n, +r.value);
        renderResult(true);
      });
    });
  }
  function syncWhatIf() {
    FL.$$("#whatif input").forEach((r) => {
      r.value = cur[E.idx[r.dataset.n]];
      FL.fillRange(r);
      FL.$('[data-v="' + r.dataset.n + '"]').textContent = fmtVal(r.dataset.n, +r.value);
    });
  }

  /* ---------- verdict ---------- */
  function setGauge(score, flagged) {
    const fill = FL.$("#gFill");
    fill.style.strokeDashoffset = 283 * (1 - score);
    fill.style.stroke = flagged ? "#c4412a" : "#3b8758";
    const num = FL.$("#gNum");
    cancelAnimationFrame(rafId);
    const from = shown, to = score * 100, t0 = performance.now();
    (function step(now) {
      const k = Math.min(1, (now - t0) / 700);
      shown = from + (to - from) * (1 - Math.pow(1 - k, 3));
      num.textContent = shown.toFixed(shown < 10 ? 1 : 0) + "%";
      if (k < 1) rafId = requestAnimationFrame(step);
    })(t0);
  }
  function setTick() {
    const th = FL.state.threshold, ang = Math.PI * (1 - th);
    const x1 = GW.cx + (GW.r - 14) * Math.cos(ang), y1 = GW.cy - (GW.r - 14) * Math.sin(ang);
    const x2 = GW.cx + (GW.r + 14) * Math.cos(ang), y2 = GW.cy - (GW.r + 14) * Math.sin(ang);
    const l = FL.$("#gTick line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
  }

  let lastFlag = null;
  function renderResult(quiet) {
    if (!cur) return;
    const score = E.score(cur), th = FL.state.threshold, flagged = score >= th;
    setGauge(score, flagged);
    setTick();
    const st = FL.$("#stamp");
    st.textContent = flagged ? "Flagged" : "Approved";
    st.className = "stamp " + (flagged ? "red" : "green") + (lastFlag !== flagged ? " pop" : "");
    lastFlag = flagged;
    FL.$("#verdictText").innerHTML = flagged
      ? "The model puts the chance of fraud at <b>" + FL.fmt.pct(score) + "</b>, above your <b>" + Math.round(th * 100) + "%</b> threshold, so this one goes to a human for review."
      : "The model puts the chance of fraud at <b>" + FL.fmt.pct(score) + "</b>, under your <b>" + Math.round(th * 100) + "%</b> threshold, so this payment goes through.";

    // trees
    const tp = E.treeProbs(cur);
    const lean = Array.from(tp).filter((p) => p >= 0.5).length;
    const dots = FL.$("#votes");
    if (dots.children.length !== tp.length) {
      dots.innerHTML = Array.from(tp).map(() => "<i></i>").join("");
      dots.style.gridTemplateColumns = "repeat(" + (tp.length > 60 ? 25 : 20) + ", 1fr)";
    }
    Array.from(dots.children).forEach((d, i) => {
      d.style.transition = "background .5s " + (i * 6) + "ms, transform .15s";
      d.style.background = voteColor(tp[i]);
      d.setAttribute("data-tip", "Tree " + (i + 1) + ": " + Math.round(tp[i] * 100) + "% fraud");
    });
    FL.$("#voteText").innerHTML = "<b>" + lean + " of " + tp.length + "</b> trees lean towards fraud. Each dot is one tree's opinion (darker means more suspicious) and FraudLens averages them all into the score above.";

    // why
    const ex = E.explain(cur);
    const top = ex.parts.slice(0, 7);
    const mx = Math.max(0.04, Math.abs(top[0].delta));
    if (Math.abs(top[0].delta) < 0.01) {
      FL.$("#why").innerHTML = '<div class="callout small">No single column stands out. This transaction looks ordinary on every column the forest watches.</div>';
    } else {
      FL.$("#why").innerHTML = top.map((p) => {
        const k = Math.min(1, Math.abs(p.delta) / mx) * 50;
        const up = p.delta > 0;
        const tip = label(p.name) + " = " + fmtVal(p.name, p.value) + "\n" + (up ? "Pushes the score up by " : "Pulls the score down by ") + Math.abs(p.delta * 100).toFixed(1) + " points";
        return '<div class="why-row" data-tip="' + FL.tipAttr(tip) + '"><span class="nm">' + label(p.name) + '</span><span class="track"><span class="b" style="' +
          (up ? "left:50%;width:" + k + "%;background:#c4412a" : "left:" + (50 - k) + "%;width:" + k + "%;background:#3b8758") + '"></span></span><span class="v">' + (up ? "+" : "-") + Math.abs(p.delta * 100).toFixed(1) + "</span></div>";
      }).join("");
    }
    renderTruth(flagged);
  }
  function voteColor(p) {
    const k = Math.pow(p, 0.7);
    const c = mix([228, 221, 204], [196, 65, 42], k);
    return "rgb(" + c.join(",") + ")";
  }

  /* ---------- the "what was it really?" box ---------- */
  function renderTruth(flagged) {
    const box = FL.$("#truthBox");
    const edited = cur.some((v, i) => v !== base[i]);
    if (meta.label === null || meta.label === undefined) { box.innerHTML = ""; return; }
    if (edited) { box.innerHTML = '<span class="chip">edited, so the original label no longer applies</span>'; return; }
    if (!revealed) {
      box.innerHTML = '<button class="btn sm ghost" id="btnReveal2">Reveal the actual label</button>';
      FL.$("#btnReveal2").onclick = () => { revealed = true; renderTruth(flagged); };
      return;
    }
    const fraud = meta.label === 1;
    let msg, cls;
    if (fraud && flagged) { msg = "Caught. This was a real fraud and it was flagged."; cls = "green"; }
    else if (fraud) { msg = "Missed. This was a real fraud but the score stayed under your threshold. Try sliding it lower."; cls = "red"; }
    else if (flagged) { msg = "False alarm. This was a normal transaction. Try sliding the threshold higher."; cls = "red"; }
    else { msg = "Correct. A normal transaction, approved."; cls = "green"; }
    box.innerHTML = '<span class="chip ' + (fraud ? "red" : "green") + '">actual: ' + (fraud ? "fraud" : "normal") + '</span> <p style="margin-top:8px"><b>' + msg + "</b></p>";
  }

  /* ---------- wiring ---------- */
  FL.bus.on("first:check", () => {
    buildPicker();
    built = true;
    if (!cur) FL.$(".pick").click();
  });
  FL.bus.on("threshold", () => { if (built && cur) renderResult(true); });

  return {
    open: (row, m) => {
      FL.tabs.go("check");
      const go = () => open(row, m);
      if (built) go(); else FL.bus.on("first:check", () => setTimeout(go, 0));
    },
  };
})();
