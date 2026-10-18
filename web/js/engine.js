/* FraudLens engine - scores a transaction with the exported random forest.
   Nothing leaves the browser; the 100 "small decision-makers" live in data/forest.js. */
window.FL = window.FL || {};

FL.engine = (function () {
  const F = window.FL_FOREST;
  const feat = Int16Array.from(F.feat);
  const thr = Float64Array.from(F.thr);
  const left = Int32Array.from(F.left);
  const right = Int32Array.from(F.right);
  const val = Float32Array.from(F.val);
  const roots = Int32Array.from(F.roots);
  const names = F.features;
  const nTrees = roots.length;
  const idx = {};
  names.forEach((n, i) => (idx[n] = i));

  const buf = new Float32Array(names.length);

  /* probability of fraud, 0..1  (average of every tree's vote) */
  function score(x) {
    for (let i = 0; i < buf.length; i++) buf[i] = x[i]; // float32 like scikit-learn
    let s = 0;
    for (let t = 0; t < nTrees; t++) {
      let n = roots[t];
      while (left[n] !== -1) n = buf[feat[n]] <= thr[n] ? left[n] : right[n];
      s += val[n];
    }
    return s / nTrees;
  }

  /* each tree's own opinion (its leaf's fraud share), for the dot grid */
  function treeProbs(x) {
    for (let i = 0; i < buf.length; i++) buf[i] = x[i];
    const out = new Float32Array(nTrees);
    for (let t = 0; t < nTrees; t++) {
      let n = roots[t];
      while (left[n] !== -1) n = buf[feat[n]] <= thr[n] ? left[n] : right[n];
      out[t] = val[n];
    }
    return out;
  }

  /* how many of the trees vote "fraud" (leaf says more fraud than normal) */
  function votes(x) {
    for (let i = 0; i < buf.length; i++) buf[i] = x[i];
    let v = 0;
    for (let t = 0; t < nTrees; t++) {
      let n = roots[t];
      while (left[n] !== -1) n = buf[feat[n]] <= thr[n] ? left[n] : right[n];
      if (val[n] >= 0.5) v++;
    }
    return v;
  }

  /* "why this score?"  Put each column back to a typical normal value, one at a time,
     and see how much the fraud score falls. Big drop = that column was pushing it up. */
  function explain(x) {
    const base = score(x);
    const out = [];
    for (let i = 0; i < names.length; i++) {
      const keep = x[i];
      const typical = FL_STATS.feat[names[i]].median;
      const y = Array.from(x);
      y[i] = typical;
      out.push({ name: names[i], value: keep, delta: base - score(y) });
    }
    out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { base, parts: out };
  }

  return { score, votes, treeProbs, explain, names, idx, nTrees };
})();
