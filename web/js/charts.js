/* FraudLens charts - small hand-rolled SVG helpers (no libraries, works offline) */
window.FL = window.FL || {};

FL.charts = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const M = { l: 46, r: 14, t: 12, b: 30 };

  function dims(svg) {
    const v = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    return { W: v[2], H: v[3], iw: v[2] - M.l - M.r, ih: v[3] - M.t - M.b };
  }
  function nice(max) {
    if (max <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function yGrid(d, top, fmt, log) {
    let out = "";
    const n = log ? Math.max(1, Math.round(top)) : 4;
    for (let i = 0; i <= n; i++) {
      const y = M.t + d.ih - (i / n) * d.ih;
      const label = log ? (i === 0 ? "0" : short(Math.pow(10, i))) : fmt((i / n) * top);
      out += '<line x1="' + M.l + '" x2="' + (M.l + d.iw) + '" y1="' + y + '" y2="' + y + '" stroke="' + (i ? "#ddd5c3" : "#cbc1aa") + '"/>' +
        '<text x="' + (M.l - 8) + '" y="' + (y + 3.5) + '" text-anchor="end">' + label + "</text>";
    }
    return out;
  }
  const short = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + "k" : String(Math.round(v * 10) / 10));

  /* grouped vertical bars. groups: [{label, vals:[{v, color, tip}]}] */
  function bars(svg, o) {
    const d = dims(svg);
    const log = o.log;
    const tr = (v) => (log ? Math.log10(v + 1) : v);
    let mx = 0;
    o.groups.forEach((g) => g.vals.forEach((b) => { mx = Math.max(mx, tr(b.v)); }));
    const top = o.max !== undefined ? tr(o.max) : log ? Math.ceil(mx) : nice(mx * 1.05);
    const fmt = o.fmt || short;
    let h = yGrid(d, top, fmt, log);
    const n = o.groups.length;
    const gw = d.iw / n;
    const k = o.groups[0].vals.length;
    const bw = Math.min(34, (gw * 0.74) / k);
    o.groups.forEach((g, gi) => {
      const cx = M.l + gw * gi + gw / 2;
      g.vals.forEach((b, bi) => {
        const bh = Math.max(b.v > 0 ? 2 : 0, (tr(b.v) / top) * d.ih);
        const x = cx - (bw * k) / 2 + bi * bw + (k > 1 ? 1 : 0);
        h += '<rect class="bar" x="' + x + '" y="' + (M.t + d.ih - bh) + '" width="' + (bw - (k > 1 ? 2 : 0)) + '" height="' + bh + '" rx="3" fill="' + b.color + '" data-tip="' + FL.tipAttr(b.tip || "") +
          '" style="transform-box:fill-box;transform-origin:bottom;animation:grow .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:' + (gi * 40 + bi * 60) + 'ms"/>';
      });
      if (!o.hideLabels || gi % o.hideLabels === 0)
        h += '<text x="' + cx + '" y="' + (M.t + d.ih + 17) + '" text-anchor="middle">' + g.label + "</text>";
    });
    svg.innerHTML = h;
  }

  /* line chart with hover crosshair.
     o.series: [{name,color,pts:[[x,y]],dash,marks:[[x,y,tip,color]]}] */
  function lines(svg, o) {
    const d = dims(svg);
    const [x0, x1] = o.xDom, [y0, y1] = o.yDom;
    const X = (v) => M.l + ((v - x0) / (x1 - x0)) * d.iw;
    const Y = (v) => M.t + d.ih - ((v - y0) / (y1 - y0)) * d.ih;
    let h = "";
    const yt = o.yTicks || 4, xt = o.xTicks || 5;
    for (let i = 0; i <= yt; i++) {
      const v = y0 + ((y1 - y0) * i) / yt;
      h += '<line x1="' + M.l + '" x2="' + (M.l + d.iw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (i ? "#ddd5c3" : "#cbc1aa") + '"/>' +
        '<text x="' + (M.l - 8) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + (o.yFmt ? o.yFmt(v) : v) + "</text>";
    }
    for (let i = 0; i <= xt; i++) {
      const v = x0 + ((x1 - x0) * i) / xt;
      h += '<text x="' + X(v) + '" y="' + (M.t + d.ih + 18) + '" text-anchor="middle">' + (o.xFmt ? o.xFmt(v) : v) + "</text>";
    }
    if (o.xLabel) h += '<text x="' + (M.l + d.iw / 2) + '" y="' + (d.H - 2) + '" text-anchor="middle">' + o.xLabel + "</text>";
    if (o.vline) o.vline.forEach((l) => {
      h += '<line x1="' + X(l.x) + '" x2="' + X(l.x) + '" y1="' + M.t + '" y2="' + (M.t + d.ih) + '" stroke="' + (l.color || "#7d8b8e") + '" stroke-dasharray="4 4" stroke-width="1.5"/>' +
        (l.label ? '<text x="' + (X(l.x) + 5) + '" y="' + (M.t + 11) + '" fill="' + (l.color || "#7d8b8e") + '" style="fill:' + (l.color || "#7d8b8e") + '">' + l.label + "</text>" : "");
    });
    o.series.forEach((s, i) => {
      const path = s.pts.map((p, j) => (j ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");
      if (s.area) h += '<path d="' + path + "L" + X(s.pts[s.pts.length - 1][0]) + " " + Y(y0) + "L" + X(s.pts[0][0]) + " " + Y(y0) + 'Z" fill="' + s.color + '" opacity=".12"/>';
      h += '<path d="' + path + '" fill="none" stroke="' + s.color + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"' +
        (s.dash ? ' stroke-dasharray="' + s.dash + '"' : ' pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="animation:drawl 1.2s ' + i * 0.15 + 's cubic-bezier(.2,.8,.2,1) forwards"') + "/>";
      (s.marks || []).forEach((m) => {
        h += '<circle cx="' + X(m[0]) + '" cy="' + Y(m[1]) + '" r="5.5" fill="#fffdf8" stroke="' + (m[3] || s.color) + '" stroke-width="2.6" data-tip="' + FL.tipAttr(m[2] || "") + '" style="cursor:default"/>';
      });
    });
    h += '<g id="xh" style="display:none"><line y1="' + M.t + '" y2="' + (M.t + d.ih) + '" stroke="#1b2a2e" stroke-width="1" stroke-dasharray="3 3"/>' +
      o.series.map((s) => '<circle r="4.5" fill="' + s.color + '" stroke="#fffdf8" stroke-width="2"/>').join("") + "</g>";
    h += '<rect id="hit" x="' + M.l + '" y="' + M.t + '" width="' + d.iw + '" height="' + d.ih + '" fill="transparent"/>';
    svg.innerHTML = h;

    if (o.onHover) {
      const hit = svg.querySelector("#hit"), xh = svg.querySelector("#xh");
      const dots = xh.querySelectorAll("circle");
      hit.addEventListener("mousemove", (e) => {
        const r = svg.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * d.W;
        const xv = x0 + ((px - M.l) / d.iw) * (x1 - x0);
        const near = o.series.map((s) => {
          let best = s.pts[0], bd = Infinity;
          s.pts.forEach((p) => { const dd = Math.abs(p[0] - xv); if (dd < bd) { bd = dd; best = p; } });
          return best;
        });
        xh.style.display = "";
        const line = xh.querySelector("line");
        const lx = X(near[0][0]);
        line.setAttribute("x1", lx); line.setAttribute("x2", lx);
        near.forEach((p, i) => { dots[i].setAttribute("cx", X(p[0])); dots[i].setAttribute("cy", Y(p[1])); });
        o.onHover(xv, near);
      });
      hit.addEventListener("mouseleave", () => { xh.style.display = "none"; if (o.onLeave) o.onLeave(); });
    }
    return { X, Y };
  }

  /* overlapping filled areas (two distributions) */
  function areas(svg, o) {
    const d = dims(svg);
    const n = o.a.length;
    const mx = nice(Math.max.apply(null, o.a.concat(o.b)) * 1.08);
    const X = (i) => M.l + (i / (n - 1)) * d.iw;
    const Y = (v) => M.t + d.ih - (v / mx) * d.ih;
    let h = "";
    for (let i = 0; i <= 4; i++) {
      const v = (mx * i) / 4;
      h += '<line x1="' + M.l + '" x2="' + (M.l + d.iw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (i ? "#ddd5c3" : "#cbc1aa") + '"/><text x="' + (M.l - 8) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + Math.round(v * 100) + "%</text>";
    }
    [[o.a, o.colors[0], 0], [o.b, o.colors[1], 1]].forEach(([arr, col, i]) => {
      const p = arr.map((v, j) => (j ? "L" : "M") + X(j).toFixed(1) + " " + Y(v).toFixed(1)).join("");
      h += '<path d="' + p + "L" + X(n - 1) + " " + Y(0) + "L" + X(0) + " " + Y(0) + 'Z" fill="' + col + '" opacity=".22" style="animation:fade .8s ' + i * 0.2 + 's both"/>' +
        '<path d="' + p + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linejoin="round"/>';
    });
    h += '<text x="' + M.l + '" y="' + (M.t + d.ih + 18) + '">' + o.xLo + '</text><text x="' + (M.l + d.iw) + '" y="' + (M.t + d.ih + 18) + '" text-anchor="end">' + o.xHi + "</text>";
    svg.innerHTML = h;
  }

  /* horizontal bars as HTML rows */
  function hbars(el, items) {
    el.innerHTML = items.map((it) =>
      '<div class="hb" data-tip="' + FL.tipAttr(it.tip || "") + '"><span class="n">' + it.n + '</span><span class="t"><i data-w="' + (it.w * 100).toFixed(1) + '"></i></span><span class="p">' + it.p + "</span></div>").join("");
    requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll("i[data-w]").forEach((i) => (i.style.width = i.dataset.w + "%"))));
  }

  return { bars, lines, areas, hbars, short, nice };
})();
