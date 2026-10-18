/* Overview tab - hero slip and headline numbers */
(function () {
  const R = window.FL_RESULTS, S = window.FL_STATS, P = window.FL_POOL, E = FL.engine;
  const forest = R.models.find((m) => m.key === "forest") || R.models[R.models.length - 1];

  function slip() {
    // show a fraud from the held-back pool that the forest does catch
    const pick = (P.samples.find((s) => s.tag === "obvious") || P.samples[0]).i;
    const row = P.rows[pick];
    const score = E.score(row);
    const votes = E.votes(row);
    const flagged = score >= 0.5;
    FL.$("#hsId").textContent = "TX-" + String(pick + 1001);
    FL.$("#hsAmt").textContent = FL.fmt.money(row[E.idx.Amount]);
    FL.$("#hsTime").textContent = FL.fmt.clock(row[E.idx.Time]);
    FL.$("#hsVotes").textContent = votes + " of " + E.nTrees;
    FL.$("#hsScore").textContent = (score * 100).toFixed(0) + "%";
    const st = FL.$("#hsStamp");
    st.textContent = flagged ? "Flagged" : "Approved";
    st.className = "stamp " + (flagged ? "red" : "green");
  }

  function strip() {
    const t = FL.$("#stTotal"), f = FL.$("#stFraud");
    FL.countUp(t, S.total, { dur: 1400 });
    FL.countUp(f, S.fraud, { dur: 1200 });
    FL.$("#stRecall").textContent = "";
    FL.countUp(FL.$("#stRecall"), forest.recall * 100, { decimals: 0, suffix: "%", dur: 1200 });
    FL.countUp(FL.$("#stPrec"), forest.precision * 100, { decimals: 0, suffix: "%", dur: 1200 });
  }

  FL.bus.on("first:overview", slip);
  FL.bus.on("show:overview", strip);
})();
