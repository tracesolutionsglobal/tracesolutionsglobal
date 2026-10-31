/* =========================================================
   TS.pdf: a tiny dependency-free PDF writer, plus the
   branded "Website concept plan" layout.
   TS.pdf.plan(brief, site) -> Uint8Array (a ready PDF file)
   Uses the PDF standard fonts (Helvetica), so nothing loads
   from the internet and it works on any host.
   ========================================================= */
window.TS = window.TS || {};
(function () {
  const _WH=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const _WB=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
  const CP = { 0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159 };
  const SWAP = { "→": "->", "←": "<-", "★": "*", "✓": "", " ": " " };
  const K = 72 / 25.4, PW = 210, PH = 297;

  function codes(s) {
    const out = [];
    for (const ch of String(s == null ? "" : s)) {
      if (SWAP[ch] !== undefined) { for (const c of SWAP[ch]) out.push(c.charCodeAt(0)); continue; }
      const u = ch.codePointAt(0);
      let c = (u >= 32 && u <= 126) || (u >= 160 && u <= 255) ? u : CP[u];
      if (u === 10 || u === 9) c = 32;
      out.push(c === undefined ? 63 : c);
    }
    return out;
  }
  function textWidth(s, size, font, cs) {
    const cc = codes(s);
    if (font === "C") return cc.length * 0.6 * size / K + (cs || 0) * cc.length;
    const tab = font === "B" ? _WB : _WH;
    let w = 0; cc.forEach(c => { w += tab[c - 32] || 556; });
    return w / 1000 * size / K + (cs || 0) * cc.length;
  }
  const n = v => (Math.round(v * 100) / 100).toString();
  const rgb = c => c.map(v => n(v / 255)).join(" ");
  function pdfString(s) {
    let o = "(";
    codes(s).forEach(c => {
      if (c === 40 || c === 41 || c === 92) o += "\\" + String.fromCharCode(c);
      else if (c < 32 || c > 126) o += "\\" + c.toString(8).padStart(3, "0");
      else o += String.fromCharCode(c);
    });
    return o + ")";
  }

  function Doc() {
    this.pages = []; this.addPage();
  }
  Doc.prototype = {
    addPage() { this.cur = { ops: [], links: [] }; this.pages.push(this.cur); },
    op(s) { this.cur.ops.push(s); },
    X: x => n(x * K), Y: y => n((PH - y) * K),
    rect(x, y, w, h, o = {}) {
      const r = Math.min(o.r || 0, w / 2, h / 2);
      let p;
      if (r > 0) {
        const c = r * 0.5523, X = this.X, Y = this.Y;
        p = `${X(x + r)} ${Y(y)} m ${X(x + w - r)} ${Y(y)} l ${X(x + w - r + c)} ${Y(y)} ${X(x + w)} ${Y(y + r - c)} ${X(x + w)} ${Y(y + r)} c ` +
          `${X(x + w)} ${Y(y + h - r)} l ${X(x + w)} ${Y(y + h - r + c)} ${X(x + w - r + c)} ${Y(y + h)} ${X(x + w - r)} ${Y(y + h)} c ` +
          `${X(x + r)} ${Y(y + h)} l ${X(x + r - c)} ${Y(y + h)} ${X(x)} ${Y(y + h - r + c)} ${X(x)} ${Y(y + h - r)} c ` +
          `${X(x)} ${Y(y + r)} l ${X(x)} ${Y(y + r - c)} ${X(x + r - c)} ${Y(y)} ${X(x + r)} ${Y(y)} c h`;
      } else p = `${this.X(x)} ${this.Y(y + h)} ${n(w * K)} ${n(h * K)} re`;
      this.paint(p, o);
    },
    circle(cx, cy, r, o = {}) {
      const c = r * 0.5523, X = this.X, Y = this.Y;
      const p = `${X(cx + r)} ${Y(cy)} m ${X(cx + r)} ${Y(cy + c)} ${X(cx + c)} ${Y(cy + r)} ${X(cx)} ${Y(cy + r)} c ` +
        `${X(cx - c)} ${Y(cy + r)} ${X(cx - r)} ${Y(cy + c)} ${X(cx - r)} ${Y(cy)} c ` +
        `${X(cx - r)} ${Y(cy - c)} ${X(cx - c)} ${Y(cy - r)} ${X(cx)} ${Y(cy - r)} c ` +
        `${X(cx + c)} ${Y(cy - r)} ${X(cx + r)} ${Y(cy - c)} ${X(cx + r)} ${Y(cy)} c h`;
      this.paint(p, o);
    },
    poly(pts, o = {}) {
      this.paint(pts.map((p, i) => `${this.X(p[0])} ${this.Y(p[1])} ${i ? "l" : "m"}`).join(" ") + " h", o);
    },
    line(x1, y1, x2, y2, o = {}) {
      this.op(`q ${rgb(o.color || [0, 0, 0])} RG ${n((o.lw || 0.3) * K)} w ${o.dash ? `[${o.dash.map(d => n(d * K)).join(" ")}] 0 d` : ""} ${this.X(x1)} ${this.Y(y1)} m ${this.X(x2)} ${this.Y(y2)} l S Q`);
    },
    paint(path, o) {
      const f = o.fill, s = o.stroke;
      this.op(`q ${f ? rgb(f) + " rg " : ""}${s ? rgb(s) + " RG " + n((o.lw || 0.3) * K) + " w " : ""}${path} ${f && s ? "B" : f ? "f" : "S"} Q`);
    },
    text(str, x, y, o = {}) {
      const size = o.size || 10, font = o.font || "H", cs = o.cs || 0;
      let tx = x;
      if (o.align === "right") tx = x - textWidth(str, size, font, cs);
      else if (o.align === "center") tx = x - textWidth(str, size, font, cs) / 2;
      const F = { H: "F1", B: "F2", C: "F3" }[font];
      this.op(`BT /${F} ${n(size)} Tf ${rgb(o.color || [0, 0, 0])} rg ${n(cs * K)} Tc 1 0 0 1 ${this.X(tx)} ${this.Y(y)} Tm ${pdfString(str)} Tj ET`);
      return textWidth(str, size, font, cs);
    },
    link(x, y, w, h, url) { this.cur.links.push({ x, y, w, h, url }); },
    wrap(str, maxW, size, font) {
      const words = String(str == null ? "" : str).split(/\s+/).filter(Boolean), lines = [];
      let cur = "";
      words.forEach(wd => {
        const tryLine = cur ? cur + " " + wd : wd;
        if (textWidth(tryLine, size, font) <= maxW) { cur = tryLine; return; }
        if (cur) lines.push(cur);
        cur = wd;
        while (textWidth(cur, size, font) > maxW && cur.length > 1) {
          let i = cur.length - 1;
          while (i > 1 && textWidth(cur.slice(0, i), size, font) > maxW) i--;
          lines.push(cur.slice(0, i)); cur = cur.slice(i);
        }
      });
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    },
    output(meta) {
      const objs = [];
      const add = s => { objs.push(s); return objs.length; };
      const catalog = add(""), pagesObj = add("");
      const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
      const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
      const f3 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
      const kids = [];
      this.pages.forEach(pg => {
        const body = pg.ops.join("\n");
        const content = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
        const annots = pg.links.map(l => add(`<< /Type /Annot /Subtype /Link /Border [0 0 0] /Rect [${n(l.x * K)} ${n((PH - l.y - l.h) * K)} ${n((l.x + l.w) * K)} ${n((PH - l.y) * K)}] /A << /S /URI /URI ${pdfString(l.url)} >> >>`));
        kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${n(PW * K)} ${n(PH * K)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${content} 0 R${annots.length ? ` /Annots [${annots.map(a => a + " 0 R").join(" ")}]` : ""} >>`));
      });
      objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
      objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
      const info = add(`<< /Title ${pdfString(meta.title || "")} /Author ${pdfString(meta.author || "")} /Creator ${pdfString(meta.author || "")} >>`);
      let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
      const offs = [];
      objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
      out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
      return bytes;
    }
  };

  /* ---------- Brand palette (matches the website) ---------- */
  const C = {
    navy: [1, 34, 40], navy2: [11, 58, 64], ink: [74, 93, 96], green: [21, 138, 73], bright: [45, 190, 108],
    mint: [234, 247, 239], mintLine: [205, 239, 217], coral: [228, 87, 46], coralSoft: [255, 230, 221],
    line: [228, 231, 225], paper: [252, 251, 246], white: [255, 255, 255], softWhite: [190, 210, 208]
  };
  const hexRgb = h => { const v = parseInt(String(h || "#158A49").replace("#", ""), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const fmtDate = iso => { const d = iso ? new Date(iso) : new Date(); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };

  function logo(d, x, y, w, dark) {
    const s = w / 322, P = pts => pts.map(([a, b]) => [x + a * s, y + b * s]);
    const ink = dark ? C.white : C.navy;
    d.poly(P([[4, 4], [318, 4], [282, 60], [39, 60]]), { fill: ink });
    d.poly(P([[68, 93], [127, 93], [189, 216], [141, 240]]), { fill: ink });
    d.poly(P([[168, 93], [255, 93], [210, 180]]), { fill: [31, 167, 90] });
  }

  /** Builds the branded concept plan. `brief` is the Concept Builder brief; `site` is TS.site. */
  function plan(brief, site) {
    const d = new Doc(), M = 16, CW = PW - M * 2;
    const br = brief || {}, biz = br.business || {}, web = br.website || {}, est = br.estimate || {}, ct = br.contact || {};
    const stages = (br.plan && br.plan.stages) || [];
    const addons = br.addons || (web.features || []).map(l => ({ label: l, desc: "" }));
    let y = 0;

    function footer() {
      d.line(M, 284, PW - M, 284, { color: C.line, lw: 0.3 });
      d.text("Trace Solutions Global  ·  tracesolutionsglobal.com", M, 289.5, { size: 7.5, color: C.ink });
    }
    function newPage() {
      footer(); d.addPage(); y = 18;
      logo(d, M, 12, 7, false);
      d.text(`Website concept plan  ·  ${br.ref || ""}`, PW - M, 16, { size: 7.5, color: C.ink, align: "right" });
      y = 26;
    }
    const ensure = h => { if (y + h > 278) newPage(); };
    function section(label, right) {
      ensure(16);
      d.rect(M, y - 1.1, 5, 0.7, { fill: C.coral });
      d.text(label.toUpperCase(), M + 7, y, { size: 7.5, font: "B", color: C.green, cs: 0.35 });
      if (right) d.text(right, PW - M, y, { size: 8, color: C.ink, align: "right" });
      y += 3; d.line(M, y, PW - M, y, { color: C.line, lw: 0.3 }); y += 6.5;
    }

    /* Header band */
    d.rect(0, 0, PW, 42, { fill: C.navy });
    logo(d, M, 13, 12, true);
    let lx = M + 15;
    lx += d.text("TRACE SOLUTIONS ", lx, 20.3, { size: 10, font: "B", color: C.white, cs: 0.5 });
    lx += d.text("G", lx, 20.3, { size: 10, font: "B", color: C.bright, cs: 0.5 });
    d.text("LOBAL", lx, 20.3, { size: 10, font: "B", color: C.white, cs: 0.5 });
    d.text("Your vision, built line by line.", M + 15, 25.5, { size: 7.5, color: C.softWhite });
    d.text("WEBSITE CONCEPT PLAN", PW - M, 17.5, { size: 7.5, font: "B", color: C.bright, cs: 0.5, align: "right" });
    d.text(`Ref ${br.ref || ""}`, PW - M, 23.5, { size: 8.5, font: "C", color: C.white, align: "right" });
    d.text(fmtDate(br.created_at), PW - M, 28.5, { size: 8, color: C.softWhite, align: "right" });
    d.rect(0, 42, PW, 1.2, { fill: C.coral });

    /* Prepared for */
    y = 56;
    d.rect(M, y - 1.1, 5, 0.7, { fill: C.coral });
    d.text("PREPARED FOR", M + 7, y, { size: 7.5, font: "B", color: C.green, cs: 0.35 });
    y += 10;
    d.wrap(biz.name || ct.name || "Your business", CW, 22, "B").slice(0, 2).forEach(l => { d.text(l, M, y, { size: 22, font: "B", color: C.navy }); y += 9; });
    const sub = [biz.type_label, web.type_label, biz.tagline].filter(Boolean).join("  ·  ");
    d.wrap(sub, CW, 10, "H").forEach(l => { d.text(l, M, y - 1.5, { size: 10, color: C.ink }); y += 5; });
    const who = [ct.name, ct.phone, ct.email, ct.location].filter(Boolean).join("  ·  ");
    if (who) { d.wrap(who, CW, 9, "H").forEach(l => { d.text(l, M, y, { size: 9, color: C.ink }); y += 4.6; }); }
    y += 5;

    /* Summary tiles */
    const tw = (CW - 8) / 3, th = 27;
    const tiles = [
      { k: "SUGGESTED PACKAGE", v: est.package || "-", s: est.timeline ? `${est.timeline} to launch` : "", dark: true },
      { k: "VISUAL STYLE", v: web.style_label || "-", s: (web.brand_color || "").toUpperCase(), swatch: web.brand_color },
      { k: "SCOPE", v: `${(web.pages || []).length} pages  ·  ${addons.length} add-ons`, s: web.type_label || "" }
    ];
    tiles.forEach((t, i) => {
      const x = M + i * (tw + 4);
      d.rect(x, y, tw, th, t.dark ? { fill: C.navy, r: 3 } : { fill: C.white, stroke: C.line, lw: 0.35, r: 3 });
      d.text(t.k, x + 5, y + 7.5, { size: 6.8, font: "B", color: t.dark ? C.bright : C.green, cs: 0.3 });
      const vSize = textWidth(t.v, 14, "B") > tw - 10 ? 11 : 14;
      d.text(t.v, x + 5, y + 16, { size: vSize, font: "B", color: t.dark ? C.white : C.navy });
      let sx = x + 5;
      if (t.swatch) { d.circle(sx + 1.6, y + 21.4, 1.6, { fill: hexRgb(t.swatch) }); sx += 5; }
      d.text(t.s, sx, y + 22.4, { size: 8, color: t.dark ? C.softWhite : C.ink });
    });
    y += th + 11;

    /* Pages */
    section("Pages", `${(web.pages || []).length} pages`);
    let px = M;
    (web.pages || []).forEach(p => {
      const w = textWidth(p, 8.5, "B") + 8;
      if (px + w > PW - M) { px = M; y += 9; ensure(9); }
      d.rect(px, y - 4.8, w, 7, { fill: C.paper, stroke: C.line, lw: 0.3, r: 3.5 });
      d.text(p, px + 4, y, { size: 8.5, font: "B", color: C.navy });
      px += w + 2.5;
    });
    y += 12;

    /* Add-ons */
    section("Add-ons included", addons.length ? `${addons.length} selected` : "");
    if (!addons.length) { d.text("No add-ons yet. We can suggest some in your proposal.", M, y, { size: 9, color: C.ink }); y += 8; }
    const colW = (CW - 8) / 2;
    for (let i = 0; i < addons.length; i += 2) {
      const pair = addons.slice(i, i + 2).map(a => ({ a, lines: d.wrap(a.desc || "", colW - 6, 8, "H").slice(0, 3) }));
      const h = Math.max(...pair.map(p => 5 + p.lines.length * 3.8)) + 3;
      ensure(h);
      pair.forEach((p, j) => {
        const x = M + j * (colW + 8);
        d.circle(x + 1.3, y - 1.2, 1.1, { fill: C.bright });
        d.text(p.a.label, x + 5, y, { size: 9, font: "B", color: C.navy });
        p.lines.forEach((l, k) => d.text(l, x + 5, y + 4.4 + k * 3.8, { size: 8, color: C.ink }));
      });
      y += h;
    }
    y += 4;

    /* Build plan timeline */
    if (stages.length) {
      const colw = CW / stages.length;
      const itemH = s => s.items.reduce((a, it) => a + d.wrap(it, colw - 6, 7.6, "H").length * 3.4 + 1.8, 0);
      const need = 30 + Math.max(...stages.map(itemH));
      if (y + need > 278) newPage();
      section("Your build plan", est.timeline ? `Estimated ${est.timeline}` : "");
      const ly = y + 9;
      d.line(M + colw / 2, ly, PW - M - colw / 2, ly, { color: C.bright, lw: 0.9 });
      stages.forEach((s, i) => {
        const cx = M + colw * i + colw / 2;
        d.text(s.name, cx, ly - 5, { size: 9.5, font: "B", color: C.navy, align: "center" });
        d.circle(cx, ly, 2.3, { fill: C.white, stroke: C.bright, lw: 0.9 });
        d.circle(cx, ly, 0.9, { fill: i === stages.length - 1 ? C.coral : C.bright });
        d.text(s.sub || "", cx, ly + 7, { size: 7.5, color: C.ink, align: "center" });
        let iy = ly + 14;
        s.items.forEach(it => {
          const lines = d.wrap(it, colw - 6, 7.6, "H");
          d.circle(M + colw * i + 3, iy - 1, 0.7, { fill: C.green });
          lines.forEach((l, k) => d.text(l, M + colw * i + 5, iy + k * 3.4, { size: 7.6, color: C.navy }));
          iy += lines.length * 3.4 + 1.8;
        });
      });
      y += need - 4;
    }

    /* Answers */
    const answers = (br.answers || []).filter(a => a && a.answer && String(a.answer).trim());
    if (answers.length) {
      section("Your goals and answers");
      answers.forEach(a => {
        const ans = Array.isArray(a.answer) ? a.answer.join(", ") : String(a.answer);
        const ql = d.wrap(a.question, CW * 0.42, 8.3, "B"), al = d.wrap(ans, CW * 0.55, 8.6, "H");
        const h = Math.max(ql.length, al.length) * 4 + 3;
        ensure(h);
        ql.forEach((l, k) => d.text(l, M, y + k * 4, { size: 8.3, font: "B", color: C.navy }));
        al.forEach((l, k) => d.text(l, M + CW * 0.45, y + k * 4, { size: 8.6, color: C.ink }));
        y += h;
      });
      y += 3;
    }

    /* Notes from "More details" boxes */
    const notes = (br.notes || []).filter(nt => nt && nt.text && String(nt.text).trim());
    if (notes.length) {
      section("More details and changes");
      notes.forEach(nt => {
        const tl = d.wrap(String(nt.text), CW * 0.75, 8.6, "H");
        const h = tl.length * 4 + 3.5;
        ensure(h);
        d.text(nt.step || "", M, y, { size: 8.3, font: "B", color: C.navy });
        tl.forEach((l, k) => d.text(l, M + CW * 0.25, y + k * 4, { size: 8.6, color: C.ink }));
        y += h;
      });
      y += 3;
    }

    /* What happens next */
    ensure(52);
    y += 2;
    d.rect(M, y, CW, 46, { fill: C.navy, r: 4 });
    d.text("WHAT HAPPENS NEXT", M + 7, y + 9, { size: 7.5, font: "B", color: C.bright, cs: 0.35 });
    const steps = [
      ["01", "We review your concept", "A real person on our team reads every detail, usually within 24 hours."],
      ["02", "You get a fixed price", "A clear proposal in US dollars with pages, features and timeline."],
      ["03", "We build and launch", "You review every stage. Typically 1 to 4 weeks to go live."]
    ];
    const sw = (CW - 14) / 3;
    steps.forEach(([num, h, p], i) => {
      const x = M + 7 + i * sw;
      d.text(num, x, y + 17.5, { size: 9, font: "C", color: C.coral });
      d.text(h, x, y + 23, { size: 9.5, font: "B", color: C.white });
      d.wrap(p, sw - 6, 7.8, "H").forEach((l, k) => d.text(l, x, y + 28 + k * 3.7, { size: 7.8, color: C.softWhite }));
    });
    const s = site || {};
    const contact = [`WhatsApp ${s.phoneDisplay || ""}`, s.email || ""].filter(Boolean).join("     ");
    d.text(contact, M + 7, y + 41.5, { size: 8.5, font: "B", color: C.white });
    if (s.whatsapp) d.link(M + 7, y + 37.5, textWidth(`WhatsApp ${s.phoneDisplay || ""}`, 8.5, "B"), 5, `https://wa.me/${s.whatsapp}`);
    if (s.email) d.link(M + 7 + textWidth(`WhatsApp ${s.phoneDisplay || ""}     `, 8.5, "B"), y + 37.5, textWidth(s.email, 8.5, "B"), 5, `mailto:${s.email}`);
    y += 52;
    ensure(10);
    d.text("This plan summarises your concept. Package and timeline are estimates; your proposal confirms the fixed price.", M, y, { size: 7.5, color: C.ink });
    footer();

    const total = d.pages.length;
    d.pages.forEach((pg, i) => { d.cur = pg; d.text(`Page ${i + 1} of ${total}`, PW - M, 289.5, { size: 7.5, color: C.ink, align: "right" }); });
    return d.output({ title: `Website concept plan ${br.ref || ""}`, author: "Trace Solutions Global" });
  }

  /** Base64 of a PDF's bytes, for sending to the server. */
  function toBase64(bytes) {
    let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  TS.pdf = { plan, toBase64 };
})();
