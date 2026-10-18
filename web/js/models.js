/* Model Results tab */
(function () {
  const R = window.FL_RESULTS;
  const M = R.models;
  const COLOR = { logreg: "#c98a1b", gboost: "#3e7fa6", forest: "#1b6a65" };
  const BLURB = {
    logreg: "Draws one straight dividing line between normal and fraud. Simple and fast, but a straight line is a blunt tool.",
    gboost: "Builds many small trees one after another, each one fixing the mistakes of the last.",
    forest: "Asks " + R.trees + " small decision-makers to vote. One tree can be wrong, the crowd rarely is.",
  };
  const P = M[0].tp + M[0].fn;               // frauds in the test set
  const N = R.test_rows - P;                 // normal ones
  const best = M.reduce((a, b) => (b.f1 > a.f1 ? b : a));
  const col = (m) => COLOR[m.key] || "#1b6a65";
  const row = (m, t) => m.sweep[Math.round(t * 100)];

  /* ---------- cards ---------- */
  function cards() {
    FL.$("#modelsLede").textContent =
      "Each model was trained on " + FL.fmt.num(R.train_rows) + " transactions and evaluated on " + FL.fmt.num(R.test_rows) + " it had never seen (" + P + " of them fraud). Fraud was weighted up during training.";
    FL.$("#modelCards").innerHTML = M.map((m) => {
      const win = m.key === best.key;
      return '<div class="card lift mcard' + (win ? " win" : "") + '">' + (win ? '<span class="ribbon">best balance</span>' : "") +
        "<h3>" + m.name + '</h3><p class="small muted" style="margin:4px 0 0">' + (BLURB[m.key] || "") + "</p>" +
        '<div class="cm"><span></span><span class="h">said normal</span><span class="h">said fraud</span>' +
        '<span class="v">normal</span><div class="c tn" data-tip="Normal transactions correctly approved"><b>' + FL.fmt.num(m.tn) + '</b>approved</div><div class="c fp" data-tip="False alarms: normal transactions that got flagged"><b>' + FL.fmt.num(m.fp) + '</b>false alarms</div>' +
        '<span class="v">fraud</span><div class="c fn" data-tip="Missed fraud: it got through"><b>' + FL.fmt.num(m.fn) + '</b>missed</div><div class="c tp" data-tip="Fraud caught"><b>' + FL.fmt.num(m.tp) + "</b>caught</div></div>" +
        '<p style="margin:12px 0 0"><b>Caught ' + m.tp + " of " + (m.tp + m.fn) + "</b> frauds, with <b>" + FL.fmt.num(m.fp) + "</b> false alarms.</p>" +
        meter("Precision", m.precision, "When it says fraud, how often is it right?") +
        meter("Recall", m.recall, "Of all real frauds, how many did it catch?") +
        meter("F1 (balance of the two)", m.f1, "One number that is only high when both precision and recall are high") + "</div>";
    }).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => FL.$$("#modelCards .meter i").forEach((i) => (i.style.width = i.dataset.w + "%"))));
  }
  function meter(name, v, tip) {
    return '<div class="meter" data-tip="' + FL.tipAttr(tip) + '"><div class="top"><span>' + name + "</span><b>" + FL.fmt.pct(v) + '</b></div><div class="tr"><i data-w="' + (v * 100).toFixed(1) + '"></i></div></div>';
  }

  /* ---------- head to head + accuracy ---------- */
  function compare() {
    FL.$("#cmpLegend").innerHTML = M.map((m) => '<span><i style="background:' + col(m) + '"></i>' + m.name + "</span>").join("");
    FL.charts.bars(FL.$("#cmpChart"), {
      max: 1, fmt: (v) => Math.round(v * 100) + "%",
      groups: [["Precision", "precision"], ["Recall", "recall"], ["F1", "f1"]].map(([lab, k]) => ({
        label: lab,
        vals: M.map((m) => ({ v: m[k], color: col(m), tip: m.name + "\n" + lab + ": " + FL.fmt.pct(m[k]) })),
      })),
    });
    const rows = M.map((m) => ({ n: m.name, acc: (m.tp + m.tn) / R.test_rows, caught: m.tp, c: col(m) }))
      .concat([{ n: "Lazy model (always \"normal\")", acc: N / R.test_rows, caught: 0, c: "#c4412a" }]);
    FL.$("#accBox").innerHTML = rows.map((r) =>
      '<div class="hb" style="grid-template-columns:150px 1fr 110px" data-tip="' + FL.tipAttr(r.n + "\nAccuracy " + FL.fmt.pct(r.acc, 2) + "\nFrauds caught: " + r.caught + " of " + P) + '"><span class="n" style="font-size:.76rem">' + r.n + '</span><span class="t"><i style="background:' + r.c + '" data-w="' + (r.acc * 100) + '"></i></span><span class="p">' + FL.fmt.pct(r.acc, 1) + " &middot; " + r.caught + "/" + P + "</span></div>").join("") +
      '<p class="small muted" style="margin:12px 0 0">Every bar is nearly full, even the model that catches <b>zero</b> fraud. Accuracy cannot tell them apart, which is why we judge on precision and recall.</p>';
    requestAnimationFrame(() => requestAnimationFrame(() => FL.$$("#accBox i[data-w]").forEach((i) => (i.style.width = i.dataset.w + "%"))));
  }

  /* ---------- threshold lab + PR curve ---------- */
  let labKey = best.key;
  const lab = () => M.find((m) => m.key === labKey);
  function labSeg() {
    FL.$("#labModel").innerHTML = M.map((m) => '<button data-k="' + m.key + '" class="' + (m.key === labKey ? "on" : "") + '">' + m.name + "</button>").join("");
    FL.$("#labModel").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      labKey = b.dataset.k;
      FL.$$("#labModel button").forEach((x) => x.classList.toggle("on", x === b));
      labUpdate();
      pr();
    };
  }
  function labUpdate() {
    const t = +FL.$("#labRange").value / 100, m = lab(), r = row(m, t);
    const tp = r[1], fp = r[2], fn = r[3];
    const prec = tp + fp ? tp / (tp + fp) : 0, rec = tp / (tp + fn);
    FL.$("#labVal").textContent = Math.round(t * 100) + "%";
    FL.$("#labReadout").innerHTML =
      '<div><b>' + tp + "/" + P + "</b><span>frauds caught</span></div>" +
      '<div><b>' + FL.fmt.num(fp) + "</b><span>false alarms</span></div>" +
      '<div><b>' + FL.fmt.pct(prec, 0) + "</b><span>precision</span></div>" +
      '<div><b>' + FL.fmt.pct(rec, 0) + "</b><span>recall</span></div>";
    const ratio = tp ? fp / tp : 0;
    FL.$("#labSay").innerHTML = tp === 0
      ? "At this setting nothing is flagged at all, so no fraud is caught. A very strict threshold is the lazy model in disguise."
      : "At <b>" + Math.round(t * 100) + "%</b>, " + m.name + " catches <b>" + tp + " of " + P + "</b> frauds and raises <b>" + FL.fmt.num(fp) + "</b> false alarms" + (ratio < 0.1 ? ", almost none for each fraud found. " : ", about <b>" + ratio.toFixed(ratio < 10 ? 1 : 0) + "</b> wrong alarm" + (ratio === 1 ? "" : "s") + " for every fraud found. ") +
        (fn ? fn + " frauds slip through." : "No fraud slips through.");
  }
  function pr() {
    FL.$("#prLegend").innerHTML = M.map((m) => '<span><i style="background:' + col(m) + '"></i>' + m.name + "</span>").join("");
    const series = M.map((m) => {
      const pts = m.sweep.filter((r) => r[1] + r[2] > 0 && r[1] > 0).map((r) => [r[1] / (r[1] + r[3]), r[1] / (r[1] + r[2]), r[0]]).sort((a, b) => a[0] - b[0]);
      const t = +FL.$("#labRange").value / 100;
      const marks = [];
      if (m.key === labKey) {
        const r = row(m, t);
        if (r[1] > 0) marks.push([r[1] / (r[1] + r[3]), r[1] / (r[1] + r[2]), m.name + " at " + Math.round(t * 100) + "% (your lab setting)", "#1b2a2e"]);
      }
      return { name: m.name, color: col(m), pts, marks };
    });
    FL.charts.lines(FL.$("#prChart"), {
      series, xDom: [0, 1], yDom: [0, 1], xFmt: (v) => Math.round(v * 100) + "%", yFmt: (v) => Math.round(v * 100) + "%",
      xLabel: "recall: share of real fraud caught",
      onHover: (x, near) => {
        FL.$("#prRead").innerHTML = near.map((p, i) => '<span style="color:' + series[i].color + '">&#9679;</span> ' + M[i].name + ": precision <b>" + FL.fmt.pct(p[1], 0) + "</b> at recall <b>" + FL.fmt.pct(p[0], 0) + "</b> (threshold " + Math.round(p[2] * 100) + "%)").join("<br>");
      },
      onLeave: () => (FL.$("#prRead").textContent = "Hover the chart to read the trade-off at each recall level."),
    });
  }

  /* ---------- cost simulator ---------- */
  let costKey = best.key;
  function costSeg() {
    FL.$("#costModel").innerHTML = M.map((m) => '<button data-k="' + m.key + '" class="' + (m.key === costKey ? "on" : "") + '">' + m.name + "</button>").join("");
    FL.$("#costModel").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      costKey = b.dataset.k;
      FL.$$("#costModel button").forEach((x) => x.classList.toggle("on", x === b));
      cost();
    };
  }
  function cost() {
    const miss = Math.max(0, +FL.$("#costMiss").value || 0), alert = Math.max(0, +FL.$("#costAlert").value || 0);
    const m = M.find((x) => x.key === costKey);
    const c = (r) => r[3] * miss + (r[1] + r[2]) * alert;
    const pts = [];
    let bestI = 1, bestC = Infinity;
    for (let i = 1; i <= 99; i++) {
      const v = c(m.sweep[i]);
      pts.push([i / 100, v]);
      if (v < bestC) { bestC = v; bestI = i; }
    }
    const doNothing = P * miss, at50 = c(m.sweep[50]);
    const top = FL.charts.nice(Math.max(doNothing, at50, bestC) * 1.05) || 1;
    const bR = m.sweep[bestI];
    FL.charts.lines(FL.$("#costChart"), {
      series: [{ name: "cost", color: col(m), pts, area: true, marks: [[0.5, at50, "Default 50% threshold\nTotal cost " + FL.fmt.money(at50, 0), "#7d8b8e"], [bestI / 100, bestC, "Cheapest at " + bestI + "%\nTotal cost " + FL.fmt.money(bestC, 0), "#1b2a2e"]] }],
      xDom: [0, 1], yDom: [0, top], yTicks: 4, xFmt: (v) => Math.round(v * 100) + "%", yFmt: (v) => FL.state.currency + FL.charts.short(v),
      vline: [{ x: bestI / 100, color: "#1b2a2e", label: "cheapest: " + bestI + "%" }],
      xLabel: "alert threshold",
      onHover: (x, near) => {},
    });
    const save = at50 - bestC;
    FL.$("#costReadout").innerHTML =
      '<div><b>' + FL.fmt.money(doNothing, 0) + "</b><span>cost if no alerts at all</span></div>" +
      '<div><b>' + FL.fmt.money(at50, 0) + "</b><span>cost at the default 50%</span></div>" +
      '<div><b>' + bestI + "%</b><span>cheapest threshold (" + bR[1] + " caught, " + FL.fmt.num(bR[2]) + " false alarms)</span></div>" +
      '<div><b>' + (save > 0.5 ? FL.fmt.money(save, 0) : FL.fmt.money(0, 0)) + "</b><span>" + (save > 0.5 ? "saved by moving the line" : "saved: 50% is already about as cheap as it gets") + "</span></div>";
  }

  /* ---------- score distribution ---------- */
  function scoreHist() {
    const h = R.scoreHist;
    FL.charts.bars(FL.$("#scoreHist"), {
      log: true, hideLabels: 2,
      groups: h.normal.map((c, i) => ({
        label: i * 5 + "%",
        vals: [
          { v: c, color: "#1b6a65", tip: c + " normal transactions scored " + i * 5 + "% to " + (i + 1) * 5 },
          { v: h.fraud[i], color: "#c4412a", tip: h.fraud[i] + " fraud transactions scored " + i * 5 + "% to " + (i + 1) * 5 },
        ],
      })),
    });
  }

  function modelCard() {
    const rows = [
      ["Task", "Binary classification (fraud = 1)"],
      ["Data", FL.fmt.num(R.rows) + " transactions, " + FL.fmt.num(R.frauds) + " fraud (" + (R.frauds / R.rows * 100).toFixed(2) + "%)"],
      ["Split", "80/20 stratified, seed 42"],
      ["Imbalance", "Class weights (balanced); sample weights for Gradient Boosting"],
      ["Final model", "Random Forest, " + R.trees + " trees, max depth 12, min leaf 4"],
      ["Compared with", "Logistic Regression, Gradient Boosting"],
      ["Selected on", "Precision / recall balance (F1) on held-out data"],
      ["Inference", "Runs in the browser; no data leaves the device"],
    ];
    FL.$("#mcSetup").innerHTML = rows.map((r) => "<dt>" + r[0] + "</dt><dd style=\"text-align:right;font-family:var(--sans)\">" + r[1] + "</dd>").join("");
  }

  FL.bus.on("first:models", () => {
    cards(); compare(); modelCard();
    labSeg();
    const lr = FL.$("#labRange");
    lr.value = Math.round(FL.state.threshold * 100); FL.fillRange(lr);
    lr.addEventListener("input", () => { labUpdate(); pr(); });
    labUpdate(); pr();
    costSeg();
    FL.$("#costMiss").addEventListener("input", cost);
    FL.$("#costAlert").addEventListener("input", cost);
    FL.$("#currency").addEventListener("change", (e) => { FL.state.currency = e.target.value; cost(); FL.bus.emit("currency"); });
    cost();
    scoreHist();
  });
})();
