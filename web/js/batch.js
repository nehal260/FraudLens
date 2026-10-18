/* Check Many (CSV) tab - everything is parsed and scored in the browser */
(function () {
  const E = FL.engine, P = window.FL_POOL;
  const names = E.names;
  let rows = [], hasLabel = false, fileName = "";
  let sort = { k: "score", dir: -1 }, filter = "all", query = "";

  /* ---------- csv parsing ---------- */
  function parseCSV(text) {
    const out = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.length > 1 || row[0] !== "") out.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); out.push(row); }
    return out;
  }

  function fail(msg) {
    FL.$("#batchBusy").classList.add("hide");
    const el = FL.$("#batchErr");
    el.innerHTML = msg;
    el.classList.remove("hide");
  }

  /* ---------- run ---------- */
  function run(text, name) {
    fileName = name;
    FL.$("#batchErr").classList.add("hide");
    FL.$("#batchOut").classList.add("hide");
    FL.$("#batchBusy").classList.remove("hide");
    FL.$("#batchBar").style.width = "4%";
    FL.$("#batchMsg").textContent = "Reading " + name + "...";
    setTimeout(() => {
      const grid = parseCSV(text);
      if (grid.length < 2) return fail("That file looks empty. FraudLens needs a header row and at least one transaction.");
      const head = grid[0].map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const col = {};
      const missing = [];
      names.forEach((n) => { const i = head.indexOf(n.toLowerCase()); if (i < 0) missing.push(n); else col[n] = i; });
      if (missing.length) {
        return fail("This file is missing " + missing.length + " column" + (missing.length > 1 ? "s" : "") + ": <b class='mono'>" + FL.esc(missing.slice(0, 8).join(", ")) + (missing.length > 8 ? ", ..." : "") +
          "</b>. FraudLens expects <span class='mono'>Time, V1 ... V28, Amount</span>. Try the sample file to see the layout.");
      }
      const ci = head.indexOf("class");
      hasLabel = ci >= 0;
      rows = [];
      let bad = 0, i = 1;
      const total = grid.length - 1;
      const CH = 1500;
      (function chunk() {
        const end = Math.min(grid.length, i + CH);
        for (; i < end; i++) {
          const g = grid[i], x = new Array(names.length);
          let ok = true;
          for (let k = 0; k < names.length; k++) {
            const v = parseFloat(g[col[names[k]]]);
            if (!isFinite(v)) { ok = false; break; }
            x[k] = v;
          }
          if (!ok) { bad++; continue; }
          const y = hasLabel ? (parseFloat(g[ci]) >= 1 ? 1 : 0) : null;
          rows.push({ n: i, x, score: E.score(x), y, time: x[E.idx.Time], amount: x[E.idx.Amount] });
        }
        FL.$("#batchBar").style.width = Math.round(((i - 1) / total) * 100) + "%";
        FL.$("#batchMsg").textContent = "Scored " + FL.fmt.num(i - 1) + " of " + FL.fmt.num(total) + " rows...";
        if (i < grid.length) setTimeout(chunk, 0);
        else done(bad);
      })();
    }, 30);
  }

  function done(bad) {
    FL.$("#batchBusy").classList.add("hide");
    if (!rows.length) return fail("None of the rows had usable numbers in every column.");
    FL.$("#batchOut").classList.remove("hide");
    FL.$("#thTruth").style.display = hasLabel ? "" : "none";
    render();
    if (bad) FL.toast(bad + " row" + (bad > 1 ? "s" : "") + " skipped (missing numbers)");
    FL.$("#batchOut").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- render ---------- */
  function render() {
    if (!rows.length) return;
    const th = FL.state.threshold;
    const flagged = rows.filter((r) => r.score >= th);
    const top = rows.reduce((m, r) => Math.max(m, r.score), 0);
    FL.$("#batchTiles").innerHTML =
      '<div class="tile"><b>' + FL.fmt.num(rows.length) + "</b><span>rows scored</span></div>" +
      '<div class="tile red"><b>' + FL.fmt.num(flagged.length) + "</b><span>flagged at " + Math.round(th * 100) + "%</span></div>" +
      '<div class="tile"><b>' + FL.fmt.pct(flagged.length / rows.length) + "</b><span>of the file flagged</span></div>" +
      '<div class="tile"><b>' + FL.fmt.pct(top, 0) + "</b><span>highest fraud chance</span></div>";

    // histogram
    const bins = new Array(20).fill(0);
    rows.forEach((r) => bins[Math.min(19, Math.floor(r.score * 20))]++);
    FL.charts.bars(FL.$("#batchHist"), {
      log: true, hideLabels: 4,
      groups: bins.map((c, i) => ({
        label: i * 5 + "%",
        vals: [{ v: c, color: (i + 1) / 20 > th ? "#c4412a" : "#1b6a65", tip: c + " rows scored " + i * 5 + "% to " + (i + 1) * 5 + "%" }],
      })),
    });

    // truth card
    const tc = FL.$("#batchTruth");
    if (hasLabel) {
      let tp = 0, fp = 0, fn = 0, tn = 0;
      rows.forEach((r) => { const f = r.score >= th; if (r.y === 1) f ? tp++ : fn++; else f ? fp++ : tn++; });
      const prec = tp + fp ? tp / (tp + fp) : 0, rec = tp + fn ? tp / (tp + fn) : 0;
      tc.innerHTML = '<span class="card-label">Marking its own homework</span>' +
        '<p style="margin:0 0 12px">Your file has a <span class="mono">Class</span> column, so we can compare.</p>' +
        '<div class="readout" style="grid-template-columns:repeat(2,1fr);margin:0">' +
        '<div><b>' + tp + "/" + (tp + fn) + "</b><span>real frauds caught</span></div>" +
        '<div><b>' + fp + "</b><span>false alarms</span></div>" +
        '<div><b>' + FL.fmt.pct(prec, 0) + "</b><span>precision</span></div>" +
        '<div><b>' + FL.fmt.pct(rec, 0) + "</b><span>recall</span></div></div>";
    } else {
      tc.innerHTML = '<span class="card-label">No answer key</span><p style="margin:0" class="muted">This file has no <span class="mono">Class</span> column (0 = normal, 1 = fraud), so FraudLens can score every row but cannot check itself. Add one to see precision and recall.</p>';
    }
    renderTable();
  }

  function renderTable() {
    const th = FL.state.threshold;
    let list = rows.filter((r) => {
      const f = r.score >= th;
      if (filter === "flag" && !f) return false;
      if (filter === "ok" && f) return false;
      if (query && String(r.n).indexOf(query) !== 0) return false;
      return true;
    });
    const k = sort.k, d = sort.dir;
    list.sort((a, b) => {
      const va = k === "row" ? a.n : k === "time" ? a.time : k === "amount" ? a.amount : k === "flag" ? +(a.score >= th) : k === "truth" ? (a.y || 0) : a.score;
      const vb = k === "row" ? b.n : k === "time" ? b.time : k === "amount" ? b.amount : k === "flag" ? +(b.score >= th) : k === "truth" ? (b.y || 0) : b.score;
      return (va - vb) * d || a.n - b.n;
    });
    const shown = list.slice(0, 200);
    FL.$("#batchCount").textContent = "Showing " + shown.length + " of " + FL.fmt.num(list.length) + " matching rows";
    FL.$("#batchBody").innerHTML = shown.map((r) => {
      const f = r.score >= th;
      const col = f ? "#c4412a" : r.score > th * 0.6 ? "#c98a1b" : "#3b8758";
      return '<tr class="' + (f ? "fl" : "") + '" data-n="' + r.n + '"><td>' + r.n + "</td><td>" + FL.fmt.clock(r.time) + "</td><td>" + FL.fmt.money(r.amount) +
        '</td><td><span class="scorebar"><i style="width:' + Math.max(2, r.score * 100) + "%;background:" + col + '"></i></span>' + FL.fmt.pct(r.score) +
        '</td><td><span class="chip ' + (f ? "red" : "green") + '">' + (f ? "flagged" : "approved") + "</span></td>" +
        (hasLabel ? '<td><span class="chip ' + (r.y ? "red" : "") + '">' + (r.y ? "fraud" : "normal") + "</span></td>" : "") + "</tr>";
    }).join("");
  }

  /* ---------- wiring ---------- */
  FL.bus.on("first:batch", () => {
    const drop = FL.$("#drop"), input = FL.$("#fileInput");
    const read = (f) => {
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => run(String(rd.result), f.name);
      rd.onerror = () => fail("Could not read that file.");
      rd.readAsText(f);
    };
    input.addEventListener("change", () => { read(input.files[0]); input.value = ""; });
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => read(e.dataTransfer.files[0]));

    FL.$("#btnSampleCsv").addEventListener("click", () => {
      const head = names.join(",") + ",Class";
      const body = P.rows.map((r, i) => r.join(",") + "," + P.y[i]).join("\n");
      run(head + "\n" + body, "sample_transactions.csv");
    });

    FL.$("#batchFilter").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      FL.$$("#batchFilter button").forEach((x) => x.classList.toggle("on", x === b));
      filter = b.dataset.f;
      renderTable();
    });
    FL.$("#batchSearch").addEventListener("input", (e) => { query = e.target.value.trim(); renderTable(); });
    FL.$$("th[data-s]").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.s;
      sort = { k, dir: sort.k === k ? -sort.dir : -1 };
      renderTable();
    }));
    FL.$("#batchBody").addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const r = rows.find((x) => x.n === +tr.dataset.n);
      FL.check.open(r.x, { id: "Row " + r.n, label: r.y });
    });
    FL.$("#btnDownload").addEventListener("click", () => {
      const th = FL.state.threshold;
      const fl = rows.filter((r) => r.score >= th).sort((a, b) => b.score - a.score);
      if (!fl.length) { FL.toast("Nothing is flagged at this threshold"); return; }
      const head = ["row", "Time", "Amount", "fraud_chance"].concat(hasLabel ? ["Class"] : []).join(",");
      const csv = head + "\n" + fl.map((r) => [r.n, r.time, r.amount, r.score.toFixed(4)].concat(hasLabel ? [r.y] : []).join(",")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "fraudlens_flagged_" + Math.round(th * 100) + "pct.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      FL.toast("Downloaded " + fl.length + " flagged rows");
    });
  });
  FL.bus.on("threshold", () => { if (rows.length) render(); });
})();
