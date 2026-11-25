/* Inversores da bancada: seletora de partida da bomba (Direta / PF525 / ATV12 / CFW500) e os inversores
   WEG CFW500 (manual de programação 10001469555, software 1.8x) e Schneider Altivar ATV12 (manual BBV28581).
   O PowerFlex 525 continua em app-pf525.js e é registrado aqui.
   Expõe window.DRV = { sel, names, list, setSel, onChange, active, renderSel }. */
(() => {
  "use strict";
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ================= seletora (hub) ================= */
  const KSEL = "nivel-partida-bomba";
  const NAMES = { direta: "Direta (K1)", pf525: "PowerFlex 525", atv12: "Altivar ATV12", cfw500: "WEG CFW500" };
  let sel = "direta";
  try { const v = localStorage.getItem(KSEL); sel = v === "inversor" ? "pf525" : (NAMES[v] ? v : "direta"); } catch (e) { }
  const subs = [];
  const DRV = {
    get sel() { return sel; }, names: NAMES, list: {},
    setSel(v) {
      if (!NAMES[v] || v === sel) return;
      sel = v; for (const k in DRV.list) if (k !== v && DRV.list[k].state) DRV.list[k].state.run = false;
      try { localStorage.setItem(KSEL, v); } catch (e) { }
      subs.forEach(f => { try { f(); } catch (e) { } });
    },
    onChange(f) { subs.push(f); },
    active() { return DRV.list[sel] || null; },
    // botões da seletora (usados nos painéis laterais de todos os inversores)
    renderSel(el) {
      if (!el) return;
      const key = Object.keys(NAMES).join("|") + sel;
      if (el.dataset.k !== key) {
        el.dataset.k = key;
        el.innerHTML = Object.keys(NAMES).map(k => `<button data-s="${k}" class="${k === sel ? "on" : ""}">${NAMES[k]}</button>`).join("");
        el.querySelectorAll("button").forEach(b => b.onclick = () => DRV.setSel(b.dataset.s));
      }
    },
  };
  // Parametrização automática: grava nos inversores os dados de placa de exemplo (0,75 kW, 220 V, 60 Hz), as rampas e o comando
  // pelo CLP (Y0 na entrada digital, referência 4–20 mA), para a aula não gastar tempo parametrizando. Desligue para parametrizar à mão.
  const AUTO = {
    pf525: { P031: 220, P032: 60, P033: 3, P034: 3, P035: 4, P036: 1720, P041: 5, P042: 5, P043: 0, P044: 60, P045: 0, P046: 2, P047: 6, t062: 48, t064: 0 },
    cfw500: { P0400: 220, P0401: 3, P0402: 1720, P0403: 60, P0404: 5, P0100: 5, P0101: 5, P0134: 60, P0220: 1, P0222: 1, P0227: 1, P0233: 1, P0263: 1 },
    atv12: { bFr: 1, UnS: 220, nCr: 3, FrS: 60, nSP: 1720, ACC: 5, dEC: 5, HSP: 60, Fr1: 0, tCC: 0, AI1t: 2 },
  };
  const KAUTO = "nivel-drv-auto";
  let auto = true;
  auto = false;   // não aplica nada sozinho: cada inversor é parametrizado pelo botão do HUD
  DRV.auto = () => auto;
  DRV.applyAuto = (key) => {
    const ks = key ? [key] : Object.keys(AUTO);
    DRV._batch = true;
    try { ks.forEach(k => { const D = DRV.list[k]; if (!D || !AUTO[k]) return; for (const c in AUTO[k]) { try { D.setParam(c, AUTO[k][c]); } catch (e) { } } if (D.state) { D.state.fault = 0; } }); }
    finally { DRV._batch = false; }
    ks.forEach(k => { const D = DRV.list[k]; if (D && D.flush) { try { D.flush(); } catch (e) { } } });
  };
  DRV.setAuto = (v) => { auto = !!v; try { localStorage.setItem(KAUTO, auto ? "1" : "0"); } catch (e) { } if (auto) DRV.applyAuto(); else subs.forEach(f => { try { f(); } catch (e) { } }); };
  window.DRV = DRV;
  if (window.PF525) DRV.list.pf525 = window.PF525;

  /* ================= peças comuns ================= */
  // display de 7 segmentos desenhado no canvas
  const SEG = { "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg",
    A: "abcefg", a: "abcdeg", b: "cdefg", C: "adef", c: "deg", d: "bcdeg", E: "adefg", F: "aefg", G: "acdef", H: "bcefg", h: "cefg", I: "ef", i: "c", J: "bcde", L: "def", l: "ef",
    n: "ceg", N: "abcef", O: "abcdef", o: "cdeg", P: "abefg", q: "abcfg", r: "eg", S: "acdfg", t: "defg", U: "bcdef", u: "cde", Y: "bcdfg", y: "bcdfg", M: "abcef", "-": "g", "_": "d", " ": "" };
  function seg7(g, ch, x, y, w, h, on, off, sk = 0.12) {
    const t = Math.max(2, w * 0.18), m = y + h / 2, S = SEG[ch] ?? SEG[String(ch).toUpperCase()] ?? "";
    const k = (yy) => (m - yy) * sk; // inclinação
    const P = {
      a: [[x + t, y], [x + w - t, y], [x + w - t * 1.6, y + t], [x + t * 1.6, y + t]],
      g: [[x + t, m], [x + t * 1.6, m - t / 2], [x + w - t * 1.6, m - t / 2], [x + w - t, m], [x + w - t * 1.6, m + t / 2], [x + t * 1.6, m + t / 2]],
      d: [[x + t * 1.6, y + h - t], [x + w - t * 1.6, y + h - t], [x + w - t, y + h], [x + t, y + h]],
      f: [[x, y + t * 0.6], [x + t, y + t * 1.6], [x + t, m - t * 0.6], [x, m - t * 0.1]],
      b: [[x + w, y + t * 0.6], [x + w, m - t * 0.1], [x + w - t, m - t * 0.6], [x + w - t, y + t * 1.6]],
      e: [[x, m + t * 0.1], [x + t, m + t * 0.6], [x + t, y + h - t * 1.6], [x, y + h - t * 0.6]],
      c: [[x + w, m + t * 0.1], [x + w, y + h - t * 0.6], [x + w - t, y + h - t * 1.6], [x + w - t, m + t * 0.6]] };
    for (const s of "abcdefg") {
      const pts = P[s]; g.beginPath(); pts.forEach(([px, py], i) => { const X = px + k(py); i ? g.lineTo(X, py) : g.moveTo(X, py); }); g.closePath();
      if (S.includes(s)) { g.fillStyle = on; g.fill(); } else if (off) { g.fillStyle = off; g.fill(); }
    }
  }
  // texto em 7 segmentos alinhado à direita, com ponto decimal; "blink" = índice da célula que pisca
  function seg7Text(g, txt, x1, y, n, w, h, gap, on, off, blink, blinkOn) {
    const cs = []; for (const ch of String(txt)) { if (ch === "." && cs.length) cs[cs.length - 1].dp = true; else cs.push({ ch, dp: false }); }
    while (cs.length < n) cs.unshift({ ch: " ", dp: false });
    const cells = cs.slice(-n), x0 = x1 - n * w - (n - 1) * gap;
    cells.forEach((c, i) => {
      const hide = (blink === "all" || blink === i) && !blinkOn, x = x0 + i * (w + gap);
      seg7(g, hide ? " " : c.ch, x, y, w, h, on, off);
      if (c.dp && !hide) { g.fillStyle = on; g.fillRect(x + w + gap * 0.25, y + h - w * 0.2, w * 0.18, w * 0.18); }
    });
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // CSS dos painéis (independente do PF525)
  const CSS = `
  .dv-wrap{display:grid;grid-template-columns:330px minmax(0,1fr);gap:16px;align-items:start}
  @media (max-width:820px){.dv-wrap{grid-template-columns:1fr}}
  .dv-dev{position:relative;width:300px;margin:0 auto;user-select:none;-webkit-user-select:none;touch-action:none;filter:drop-shadow(0 12px 22px rgba(0,0,0,.35))}
  .dv-dev canvas{display:block;width:100%;height:auto}
  .dv-dev .hk{position:absolute;border:0;border-radius:50%;background:transparent;cursor:pointer;padding:0}
  .dv-dev .hk:active,.dv-dev .hk.dn{background:rgba(255,255,255,.25)}
  .dv-side{display:grid;gap:10px}
  .dv-side .box{background:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 1px 2px rgba(31,42,55,.06),0 4px 14px rgba(31,42,55,.05)}
  .dv-side h4{margin:0 0 8px;color:var(--navy,#1E3A5F);font-size:16px}
  .dv-sel{display:flex;flex-wrap:wrap;gap:6px}
  .dv-sel button{border:1.5px solid var(--navy,#1E3A5F);background:#fff;color:var(--navy,#1E3A5F);border-radius:9px;padding:6px 10px;cursor:pointer;font-weight:600;font-size:14px}
  .dv-sel button.on{background:var(--navy,#1E3A5F);color:#fff}
  .dv-st{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .dv-st div{background:var(--bg,#EEF2F7);border-radius:10px;padding:6px 10px}
  .dv-st b{display:block;font-size:17px;color:var(--navy,#1E3A5F);font-variant-numeric:tabular-nums}
  .dv-st span{font-size:12px;color:var(--muted,#5B6B80);text-transform:uppercase;letter-spacing:.04em}
  .dv-next{background:#FFF4EA;border:2px solid #E87722;border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.45}
  .dv-next b.h{display:block;color:#B35A12;font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
  .dv-next ol{margin:4px 0 0;padding-left:20px}.dv-next li{margin:2px 0}
  .dv-next .x{float:right;border:0;background:none;cursor:pointer;color:#B35A12;font-weight:700}
  .dv-next kbd,.dv-keys kbd{display:inline-block;min-width:22px;text-align:center;border:1px solid #B9C2CC;border-radius:5px;padding:0 4px;background:#fff;font:700 12px Arial;color:#1E3A5F}
  .dv-now{font-size:15px}.dv-now code{font-family:"Courier New",monospace;font-weight:700;color:#E87722}
  .dv-msg{border-radius:10px;padding:8px 12px;font-size:14px;background:var(--bg,#EEF2F7)}
  .dv-msg.bad{background:#F8E6E4;color:#7E2A22}.dv-msg.ok{background:#E3F3EF;color:#1F5F54}
  .dv-hint{font-size:13px;color:#1E3A5F;background:#E8F0FA;border-radius:10px;padding:8px 10px}
  .dv-tabs{display:flex;gap:6px;flex-wrap:wrap}
  .dv-tabs button{border:1.5px solid var(--navy,#1E3A5F);background:#fff;color:var(--navy,#1E3A5F);border-radius:9px;padding:5px 10px;cursor:pointer;font-weight:600}
  .dv-tabs button.on{background:var(--navy,#1E3A5F);color:#fff}
  .dv-ck{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}
  .dv-ck li{display:flex;gap:8px;align-items:flex-start;font-size:14px;padding:4px 6px;border-radius:8px}
  .dv-ck li i{flex:0 0 20px;height:20px;border-radius:50%;border:2px solid #9AA5B1;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:700;color:#fff}
  .dv-ck li.ok{background:#E3F3EF}.dv-ck li.ok i{background:#2E8B7A;border-color:#2E8B7A}
  .dv-ck li a{margin-left:auto;white-space:nowrap;font-size:12px;color:#2F6DB5;cursor:pointer;text-decoration:underline}
  .dv-ck li.sel{outline:2px solid #E87722}
  .dv-keys{font-size:13px;color:var(--muted,#5B6B80);line-height:1.5;max-width:300px;margin:8px auto 0}
  `;
  function css() { if (!document.getElementById("drvcss")) { const s = document.createElement("style"); s.id = "drvcss"; s.textContent = CSS; document.head.appendChild(s); } }

  /* ================= fábrica de inversores ================= */
  // spec: key, name, model, img, FW, FH, FACE, defs, groups, logic(), ref(), rampBase(), acc(), dec(), fmin(), fmax(), motor(), draw(), key(), hints, checklists
  function makeDrive(spec) {
    const KP = "nivel-drv-" + spec.key + "-v1";
    const BY = {}; spec.defs.forEach(d => { BY[d.c] = d; if (d.dec == null) d.dec = 0; });
    const st = { par: {}, run: false, dir: 1, outF: 0, cmdF: 0, n: 0, I: 0, V: 0, bus: 325, fault: 0, ol: 0, di1: false, di1Prev: false, ai: null,
      coast: false, accel: false, decel: false, ach45: false, stopAfter45: false, ranDI: false, rem: false, jogT: 0, hit: null, warn: false };
    const ui = { mode: spec.home, guide: null, msg: null, msgKind: "", rep: 0, lastKey: "", lastT: 0 };
    const defaults = () => { const p = {}; spec.defs.forEach(d => { if (!d.ro) p[d.c] = d.d; }); return p; };
    const save = () => { try { localStorage.setItem(KP, JSON.stringify(st.par)); } catch (e) { } };
    st.par = defaults();
    try { const j = JSON.parse(localStorage.getItem(KP) || "null"); if (j) for (const k in j) if (k in st.par) st.par[k] = j[k]; } catch (e) { }
    const P = c => st.par[c];
    const running = () => st.run || st.outF > 0.01;
    const subsD = [];
    const api = {
      st, ui, P, BY, running, spec,
      val: c => { const d = BY[c]; return d.ro ? d.get(st, api) : st.par[c]; },
      set: (c, v) => { st.par[c] = v; if (DRV._batch) return; save(); subsD.forEach(f => { try { f(); } catch (e) { } }); },
      msg: (h, k = "") => { ui.msg = h; ui.msgKind = k; },
      changed: () => { save(); subsD.forEach(f => { try { f(); } catch (e) { } }); },
      defaults: () => { st.par = defaults(); save(); },
      setFault: (code) => { if (st.fault) return; st.fault = code; st.run = false; st.outF = 0; st.coast = true; api.msg(`Falha <b>${spec.faultName(code)}</b>. Corrija a causa e ${spec.resetHow}.`, "bad"); },
      isSel: () => DRV.sel === spec.key,
    };
    function step(dt, inp = {}) {
      st.di1 = !!inp.di1; st.ai = inp.ai == null ? null : clamp(inp.ai, 0, 1);
      spec.logic(api, dt);                      // decide st.run / st.dir / st.cmdF
      st.di1Prev = st.di1;
      if (st.jogT > 0) { st.jogT -= dt; if (st.jogT <= 0) st.run = false; }
      const fmax = Math.max(spec.fmax(api), 0.1), fmin = spec.fmin(api), base = Math.max(spec.rampBase(api), 0.1);
      const up = spec.acc(api) > 0 ? base / spec.acc(api) : 1e4, dn = spec.dec(api) > 0 ? base / spec.dec(api) : 1e4;
      const prev = st.outF;
      if (st.run && !st.fault) { st.coast = false; const tgt = clamp(st.cmdF, fmin, fmax); st.outF = st.outF < tgt ? Math.min(tgt, st.outF + up * dt) : Math.max(tgt, st.outF - dn * dt); }
      else if (spec.coastStop(api)) { if (st.outF > 0) st.coast = true; st.outF = 0; }
      else st.outF = Math.max(0, st.outF - dn * dt);
      st.accel = st.outF > prev + 1e-6; st.decel = st.outF < prev - 1e-6;
      const m = spec.motor(api), sync = Math.max(m.hz, 1);
      if (st.outF > 0) st.n += (st.outF / sync - st.n) * Math.min(1, dt * 6); else st.n = st.coast ? st.n * Math.exp(-dt / 2.5) : Math.max(0, st.n - dt * 2);
      if (st.n < 0.002) { st.n = 0; st.coast = false; }
      const nn = Math.min(st.outF / sync, 1.25), fla = m.fla > 0 ? m.fla : 3;
      st.I = st.outF > 0.05 ? Math.min(fla * (0.32 + 0.6 * nn * nn * nn) + (st.accel ? 0.35 * fla * Math.min(1, up / 12) : 0), m.imax) : 0;
      st.V = st.outF > 0.05 ? Math.min(m.v, m.v * st.outF / sync + 4) : 0;
      st.bus = Math.round(311 - st.I * 1.5);
      const ol = m.ol;
      if (st.I > 0 && ol > 0 && st.I > ol) st.ol += ((st.I / ol) ** 2 - 1) * dt; else st.ol = Math.max(0, st.ol - dt * 0.5);
      if (st.I > 0 && ol <= 0) st.ol += dt * 2;
      st.warn = st.ol > 17;
      if (st.ol > 20) { st.ol = 0; api.setFault(spec.olFault); }
      const remCmd = spec.isRemote(api);
      if (remCmd && st.run) st.ranDI = true;
      if (!remCmd && st.run && Math.abs(st.outF - 45) < 2.5) st.ach45 = true;
      if (st.ach45 && !running()) st.stopAfter45 = true;
      return { n: st.n * st.dir, outF: st.outF, running: running(), fault: st.fault };
    }
    function press(k, ev) {
      const now = performance.now(); ui.rep = (k === ui.lastKey && now - ui.lastT < 260) ? ui.rep + 1 : 0; ui.lastKey = k; ui.lastT = now;
      st.hit = { k, t: now }; spec.key2(api, k, ev || {}); paint();
    }
    function hitKey(u, v) {
      const x = u * spec.FW, y = (1 - v) * spec.FH;
      for (const [k, z] of Object.entries(spec.FACE)) { if (z.length !== 3) continue; if (Math.hypot(x - z[0], y - z[1]) <= z[2] + 4) return spec.mapHit ? spec.mapHit(k, x, y, z) : k; }
      return null;
    }
    function pressAt(u, v, ev) { const k = hitKey(u, v); if (!k) return null; press(k, ev); return k; }
    const IMG = new Image(); let imgOk = false; IMG.onload = () => { imgOk = true; }; IMG.src = spec.img() || "";
    function drawFace(g, W, H) {
      g.save(); g.setTransform(W / spec.FW, 0, 0, H / spec.FH, 0, 0);
      if (imgOk) g.drawImage(IMG, 0, 0, spec.FW, spec.FH); else { g.fillStyle = "#AEB4BB"; g.fillRect(0, 0, spec.FW, spec.FH); }
      spec.draw(g, api, performance.now(), Math.floor(performance.now() / 350) % 2 === 0);
      if (st.hit && performance.now() - st.hit.t < 220) { const z = spec.FACE[st.hit.k]; if (z && z.length === 3) { g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.arc(z[0], z[1], z[2] + 2, 0, 7); g.fill(); } }
      g.restore();
    }
    // ---------- painéis ----------
    let hosts = [], tab = "a1", timer = null;
    const hot = (k) => { const [x, y, r] = spec.FACE[k]; return `left:${(x - r) / spec.FW * 100}%;top:${(y - r) / spec.FH * 100}%;width:${2 * r / spec.FW * 100}%;height:${2 * r / spec.FH * 100}%`; };
    const side = (compact) => `<div class="dv-side">
        ${compact ? `<div class="dv-hint">${spec.hint3d}</div>` : ""}
        <div class="dv-next" data-r="next"></div>
        <div class="box dv-now" data-r="now"></div>
        <div class="dv-msg" data-r="msg"></div>
        <div class="box"><div class="dv-st" data-r="st"></div></div>
        <div class="box"><h4>Partida da bomba</h4><div class="dv-sel" data-r="sel"></div><div class="note" style="margin-top:6px" data-r="seln"></div></div>
        <div class="box"><div class="dv-tabs" data-r="tabs"><button data-t="a1">Atividade 1 · IHM</button><button data-t="a2">Atividade 2 · CLP</button></div><div data-r="ck"></div>
          <div style="margin-top:10px"><button class="btn" data-r="def">Restaurar padrão de fábrica</button></div></div>
      </div>`;
    function mount(el, opts = {}) {
      css(); hosts = hosts.filter(h => h !== el && document.contains(h)); hosts.push(el);
      const keys = Object.keys(spec.FACE).filter(k => spec.FACE[k].length === 3);
      el.innerHTML = opts.compact ? side(true) : `<div class="dv-wrap"><div>
          <div class="dv-dev"><canvas width="${spec.FW}" height="${spec.FH}"></canvas>${keys.map(k => `<button class="hk" data-k="${k}" style="${hot(k)}" aria-label="${spec.keyNames[k] || k}" title="${spec.keyNames[k] || k}"></button>`).join("")}</div>
          <div class="dv-keys">${spec.keysHelp}</div></div>${side(false)}</div>`;
      el.querySelectorAll("[data-k]").forEach(b => {
        let rep = null, t0 = 0;
        const go = (ev) => press(b.dataset.k, ev);
        b.addEventListener("pointerdown", e => { e.preventDefault(); b.classList.add("dn"); t0 = performance.now(); if (spec.repeatKeys.includes(b.dataset.k)) { go(e); rep = setTimeout(function r() { go(e); rep = setTimeout(r, 110); }, 450); } });
        const end = (e) => { if (!b.classList.contains("dn")) return; b.classList.remove("dn"); clearTimeout(rep); rep = null; if (!spec.repeatKeys.includes(b.dataset.k)) { let kk = b.dataset.k; const z = spec.FACE[kk]; if (spec.mapHit && z && e && e.clientX != null) { const r = b.getBoundingClientRect(); kk = spec.mapHit(kk, z[0] + ((e.clientX - r.left) / r.width - 0.5) * 2 * z[2], z[1] + ((e.clientY - r.top) / r.height - 0.5) * 2 * z[2], z); } press(kk, { holdMs: performance.now() - t0, clientX: e.clientX, clientY: e.clientY }); } };
        b.addEventListener("pointerup", end); b.addEventListener("pointerleave", e => { if (b.classList.contains("dn") && spec.repeatKeys.includes(b.dataset.k)) end(e); });
      });
      el.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; paint(); });
      const bd = el.querySelector("[data-r=def]"); let armed = 0;
      bd.onclick = () => {
        if (running()) { api.msg("Pare o inversor antes de restaurar os parâmetros.", "bad"); paint(); return; }
        if (Date.now() - armed > 3000) { armed = Date.now(); bd.textContent = "Clique de novo para confirmar"; setTimeout(() => { bd.textContent = "Restaurar padrão de fábrica"; }, 3000); return; }
        armed = 0; bd.textContent = "Restaurar padrão de fábrica"; api.defaults(); st.ach45 = st.stopAfter45 = st.ranDI = false; api.msg("Parâmetros no padrão de fábrica.", "ok"); api.changed(); paint();
      };
      if (!timer) timer = setInterval(() => { if (hosts.some(h => h.offsetParent)) paint(); }, 120);
      paint();
    }
    function paint() { hosts = hosts.filter(h => document.contains(h)); for (const h of hosts) paintHost(h); }
    function paintHost(h) {
      const q = s => h.querySelector(`[data-r="${s}"]`);
      const cv = h.querySelector("canvas"); if (cv) drawFace(cv.getContext("2d"), cv.width, cv.height);
      const nx = q("next"); if (nx) { nx.innerHTML = ui.guide ? spec.guide(api, ui.guide) : `<b class="h">Próxima tecla</b>${spec.next(api)}`; const x = nx.querySelector(".x"); if (x) x.onclick = () => { ui.guide = null; paint(); }; }
      const nw = q("now"); if (nw) nw.innerHTML = spec.now(api);
      const m = q("msg"); if (m) { m.className = "dv-msg " + ui.msgKind; m.innerHTML = ui.msg || "Use a IHM como no inversor real. O checklist confere os valores <b>gravados</b> no inversor."; }
      const sit = st.fault ? `<span style="color:#B83A2E">FALHA ${spec.faultCode(st.fault)}</span>` : running() ? (st.accel ? "Acelerando" : st.decel ? "Desacelerando" : "Rodando") : "Parado";
      const rpm = Math.round(Math.abs(st.n) * spec.motor(api).rpm);
      const s = q("st"); if (s) s.innerHTML = `<div><span>Situação</span><b>${sit}</b></div><div><span>Saída</span><b>${st.outF.toFixed(1)} Hz</b></div><div><span>Corrente</span><b>${st.I.toFixed(2)} A</b></div>
        <div><span>Pedida</span><b>${st.cmdF.toFixed(1)} Hz</b></div><div><span>Comando</span><b style="font-size:14px">${spec.cmdText(api)}</b></div><div><span>Motor</span><b>${rpm} rpm</b></div>`;
      DRV.renderSel(q("sel"));
      const sn = q("seln"); if (sn) sn.innerHTML = api.isSel() ? `A bomba está ligada a <b>este inversor</b> (${spec.name}).` : `A bomba está em <b>${NAMES[DRV.sel]}</b>. Este inversor pode ser parametrizado, mas não aciona o motor.`;
      h.querySelectorAll("[data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
      const ex = spec.checklists(api)[tab], ck = q("ck");
      if (ck && ex) {
        const done = ex.items.filter(i => i[1]()).length;
        ck.innerHTML = `<div style="margin-top:8px"><b>${ex.t}</b> · ${done}/${ex.items.length}</div><div class="note">${ex.note} Clique em <b>como fazer</b> para ver o caminho das teclas.</div><ul class="dv-ck">${ex.items.map(i => { const ok = i[1](), c = i[2] || ""; return `<li class="${ok ? "ok" : ""}${c && ui.guide === c ? " sel" : ""}"><i>${ok ? "✓" : ""}</i><span>${i[0]}</span>${c ? `<a data-g="${c}">como fazer ›</a>` : ""}</li>`; }).join("")}</ul>`;
        ck.querySelectorAll("[data-g]").forEach(a => a.onclick = () => { ui.guide = a.dataset.g; paint(); const n = q("next"); if (n && n.scrollIntoView) n.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
      }
    }
    const D = {
      key: spec.key, name: spec.name, model: spec.model, size3d: spec.size3d, FW: spec.FW, FH: spec.FH,
      get state() { return st; }, get faulted() { return !!st.fault; }, param: c => api.val(c), setParam: (c, v) => api.set(c, v), flush: () => api.changed(),
      defaults: () => { api.defaults(); }, step, mount, paint, pressAt, hitKey, paint3D: (c) => drawFace(c.getContext("2d"), c.width, c.height),
      onChange: f => subsD.push(f), key: k => press(k), trip: () => api.setFault(spec.olFault),
    };
    DRV.list[spec.key] = D;
    return D;
  }

  /* ================= WEG CFW500 ================= */
  // modelo de referência: CFW500 200–240 V, 4,3 A (P0029 = 3), motor 0,75 kW
  const CFW_IN = 4.3;
  const OPT_LOCREM = { 0: "Sempre Local", 1: "Sempre Remoto", 2: "Tecla HMI (LOC)", 3: "Tecla HMI (REM)", 4: "Entrada Digital (DIx)", 5: "Serial/USB (LOC)", 6: "Serial/USB (REM)" };
  const OPT_REF = { 0: "Teclas HMI", 1: "AI1", 2: "AI2", 3: "AI3", 4: "FI", 7: "E.P.", 8: "Multispeed", 9: "Serial/USB" };
  const OPT_GIRO = { 0: "Horário", 1: "Anti-horário", 2: "Tecla HMI (H)", 3: "Teclas HMI (AH)", 4: "DIx", 5: "Serial/USB (H)", 6: "Serial/USB (AH)" };
  const OPT_GP = { 0: "Tecla HMI", 1: "DIx", 2: "Serial/USB", 3: "Sem Função", 4: "CO/DN/PB/Eth", 5: "SoftPLC" };
  const OPT_DI = { 0: "Sem Função", 1: "Gira/Para", 2: "Habilita Geral", 3: "Parada Rápida", 4: "Avanço", 5: "Retorno", 6: "Start", 7: "Stop", 8: "Sentido de Giro", 9: "LOC/REM", 10: "JOG", 13: "Multispeed", 20: "Reset de Falha" };
  const CFW_DEFS = [
    { c: "P0001", n: "Referência Velocidade", pt: "Referência de velocidade ativa (em Hz).", ro: 1, dec: 1, u: "Hz", get: s => s.cmdF },
    { c: "P0002", n: "Velocidade de Saída", pt: "Velocidade aplicada ao motor (em Hz).", ro: 1, dec: 1, u: "Hz", get: s => s.outF },
    { c: "P0003", n: "Corrente do Motor", pt: "Corrente de saída para o motor.", ro: 1, dec: 1, u: "A", get: s => s.I },
    { c: "P0004", n: "Tensão Barram. CC (Ud)", pt: "Tensão do barramento CC.", ro: 1, dec: 0, u: "V", get: s => s.bus },
    { c: "P0005", n: "Frequência de Saída", pt: "Frequência aplicada ao motor.", ro: 1, dec: 1, u: "Hz", get: s => s.outF },
    { c: "P0006", n: "Estado do Inversor", pt: "0 = Ready (Pronto), 1 = Run (Execução), 3 = Falha.", ro: 1, dec: 0, get: s => s.fault ? 3 : (s.run || s.outF > 0.01) ? 1 : 0 },
    { c: "P0007", n: "Tensão de Saída", pt: "Tensão aplicada ao motor.", ro: 1, dec: 0, u: "V", get: s => s.V },
    { c: "P0012", n: "Estado DI8 a DI1", pt: "Estado das entradas digitais: o bit 0 é a DI1 (1 = fechada).", ro: 1, dec: 0, get: s => s.di1 ? 1 : 0 },
    { c: "P0018", n: "Valor de AI1", pt: "Valor lido na entrada analógica AI1, em % (já com o tipo de sinal de P0233).", ro: 1, dec: 1, u: "%", get: (s, a) => cfwAI(a) * 100 },
    { c: "P0037", n: "Sobrecarga Motor Ixt", pt: "Nível da proteção de sobrecarga do motor. Acima de 85 % aparece o alarme A0046; em 100 % ocorre a falha F0072.", ro: 1, dec: 0, u: "%", get: s => Math.min(100, s.ol / 20 * 100) },
    { c: "P0049", n: "Falha Atual", pt: "Número da falha ativa (0 = nenhuma).", ro: 1, dec: 0, get: s => s.fault },
    { c: "P0100", n: "Tempo Aceleração", pt: "Tempo para acelerar de 0 até a velocidade máxima (P0134).", min: 0.1, max: 999, dec: 1, d: 10, u: "s" },
    { c: "P0101", n: "Tempo Desaceleração", pt: "Tempo para desacelerar da velocidade máxima (P0134) até 0.", min: 0.1, max: 999, dec: 1, d: 10, u: "s" },
    { c: "P0121", n: "Referência via HMI", pt: "Velocidade pedida pelas teclas ▲▼ da HMI (com P0221/P0222 = 0). No modo monitoração, ▲▼ mudam este valor.", min: 0, max: 500, dec: 1, d: 3, u: "Hz" },
    { c: "P0122", n: "Referência JOG", pt: "Velocidade usada pela tecla JOG.", min: 0, max: 500, dec: 1, d: 5, u: "Hz" },
    { c: "P0133", n: "Velocidade Mínima", pt: "Menor velocidade com o motor girando.", min: 0, max: 500, dec: 1, d: 3, u: "Hz" },
    { c: "P0134", n: "Velocidade Máxima", pt: "Maior velocidade. Também é o 100 % da entrada analógica.", min: 0, max: 500, dec: 1, d: 66, u: "Hz" },
    { c: "P0135", n: "Corrente Máxima Saída", pt: "Limite de corrente do inversor (1,5 × Inom).", min: 0, max: 20, dec: 1, d: 6.4, u: "A" },
    { c: "P0156", n: "Corr. Sobrecarga Vel. Nom.", pt: "Corrente de sobrecarga do motor na velocidade nominal (proteção que gera A0046 e F0072). Padrão 1,1 × Inom.", min: 0, max: 20, dec: 1, d: 4.7, u: "A" },
    { c: "P0202", n: "Tipo de Controle", pt: "0 = V/f (escalar, o mais usado em bombas), 5 = VVW (vetorial).", min: 0, max: 5, d: 0, cfg: 1, opts: { 0: "V/f", 5: "VVW" } },
    { c: "P0204", n: "Carrega/Salva Parâm.", pt: "5 = carrega o padrão WEG para 60 Hz; 6 = padrão para 50 Hz. Volta sozinho para 0.", min: 0, max: 11, d: 0, cfg: 1, opts: { 0: "Sem Função", 5: "Carrega WEG 60 Hz", 6: "Carrega WEG 50 Hz" } },
    { c: "P0205", n: "Parâmetro Display Princ.", pt: "Parâmetro mostrado no mostrador principal no modo monitoração (2 = P0002).", min: 0, max: 1500, d: 2 },
    { c: "P0206", n: "Parâmetro Display Secund.", pt: "Parâmetro mostrado no mostrador secundário (1 = P0001).", min: 0, max: 1500, d: 1 },
    { c: "P0220", n: "Seleção LOC/REM", pt: "De onde vem a escolha Local/Remoto. 2 = tecla LOC/REM da HMI, começando em LOCAL.", min: 0, max: 11, d: 2, cfg: 1, opts: OPT_LOCREM },
    { c: "P0221", n: "Sel. Referência LOC", pt: "Referência de velocidade em LOCAL. 0 = teclas ▲▼ da HMI.", min: 0, max: 17, d: 0, cfg: 1, opts: OPT_REF },
    { c: "P0222", n: "Sel. Referência REM", pt: "Referência de velocidade em REMOTO. 1 = entrada analógica AI1.", min: 0, max: 17, d: 1, cfg: 1, opts: OPT_REF },
    { c: "P0223", n: "Seleção Giro LOC", pt: "Sentido de giro em LOCAL. 2 = tecla de giro da HMI.", min: 0, max: 12, d: 2, cfg: 1, opts: OPT_GIRO },
    { c: "P0224", n: "Seleção Gira/Para LOC", pt: "Comando gira/para em LOCAL. 0 = teclas I e O da HMI.", min: 0, max: 5, d: 0, cfg: 1, opts: OPT_GP },
    { c: "P0225", n: "Seleção JOG LOC", pt: "JOG em LOCAL. 1 = tecla JOG da HMI.", min: 0, max: 6, d: 1, cfg: 1, opts: { 0: "Inativo", 1: "Teclas HMI", 2: "DIx" } },
    { c: "P0226", n: "Seleção Giro REM", pt: "Sentido de giro em REMOTO (4 = DIx).", min: 0, max: 12, d: 4, cfg: 1, opts: OPT_GIRO },
    { c: "P0227", n: "Seleção Gira/Para REM", pt: "Comando gira/para em REMOTO. 1 = entradas digitais (DIx).", min: 0, max: 5, d: 1, cfg: 1, opts: OPT_GP },
    { c: "P0229", n: "Seleção Modo Parada", pt: "0 = por rampa (P0101), 1 = por inércia.", min: 0, max: 2, d: 0, cfg: 1, opts: { 0: "Por Rampa", 1: "Por Inércia", 2: "Parada Rápida" } },
    { c: "P0233", n: "Sinal da Entrada AI1", pt: "Tipo de sinal da AI1: 0 = 0 a 10 V / 0 a 20 mA, 1 = 4 a 20 mA. O CLP manda 4–20 mA.", min: 0, max: 3, d: 0, opts: { 0: "0 a 10 V / 20 mA", 1: "4 a 20 mA", 2: "10 V / 20 mA a 0", 3: "20 a 4 mA" } },
    { c: "P0263", n: "Função da Entrada DI1", pt: "Função da DI1. 1 = Gira/Para (fechada gira, aberta para).", min: 0, max: 46, d: 1, cfg: 1, opts: OPT_DI },
    { c: "P0264", n: "Função da Entrada DI2", pt: "Função da DI2 (8 = Sentido de Giro).", min: 0, max: 46, d: 8, cfg: 1, opts: OPT_DI },
    { c: "P0400", n: "Tensão Nom. Motor", pt: "Tensão nominal da placa do motor.", min: 200, max: 600, d: 220, cfg: 1, u: "V" },
    { c: "P0401", n: "Corrente Nom. Motor", pt: "Corrente nominal da placa do motor.", min: 0, max: 20, dec: 1, d: 4.3, cfg: 1, u: "A" },
    { c: "P0402", n: "Velocidade Nom. Motor", pt: "Rotação nominal da placa do motor.", min: 0, max: 30000, d: 1710, cfg: 1, u: "rpm" },
    { c: "P0403", n: "Frequência Nom. Motor", pt: "Frequência nominal da placa do motor.", min: 0, max: 500, d: 60, cfg: 1, u: "Hz" },
    { c: "P0404", n: "Potência Nom. Motor", pt: "Potência da placa do motor (código): 4 = 0,75 HP (0,55 kW), 5 = 1,00 HP (0,75 kW), 6 = 1,50 HP (1,10 kW).", min: 0, max: 19, d: 5, cfg: 1, opts: { 3: "0,50 HP (0,37 kW)", 4: "0,75 HP (0,55 kW)", 5: "1,00 HP (0,75 kW)", 6: "1,50 HP (1,10 kW)", 7: "2,00 HP (1,50 kW)" } },
  ];
  const CFW_GROUPS = [
    { k: "PARAM", t: "todos os parâmetros", f: () => true },
    { k: "READ", t: "somente leitura", f: d => d.ro },
    { k: "MODIF", t: "alterados do padrão", f: (d, a) => !d.ro && a.st.par[d.c] !== d.d },
    { k: "BASIC", t: "aplicação básica", f: d => ["P0100", "P0101", "P0133", "P0134", "P0135"].includes(d.c) },
    { k: "MOTOR", t: "controle e dados do motor", f: d => ["P0135", "P0156", "P0202", "P0400", "P0401", "P0402", "P0403", "P0404"].includes(d.c) },
    { k: "I/O", t: "entradas, saídas e comandos", f: d => /^P0(012|018|22\d|233|26[34])$/.test(d.c) },
  ];
  function cfwAI(a) {
    const ai = a.st.ai; if (ai == null) return 0;
    const mA = 4 + 16 * ai, t = a.P("P0233");
    if (t === 1) return clamp((mA - 4) / 16, 0, 1);
    if (t === 3) return clamp((20 - mA) / 16, 0, 1);
    if (t === 2) return clamp(1 - mA / 20, 0, 1);
    return clamp(mA / 20, 0, 1);
  }
  const cfwRem = a => { const s = a.P("P0220"); return s === 0 ? false : s === 1 ? true : a.st.rem; };
  const cfwList = a => CFW_DEFS.filter(d => CFW_GROUPS[a.ui.grp || 0].f(d, a));
  const cfwFmt = (d, v) => d.ro && d.c === "P0012" ? String(v) : Number(v).toFixed(d.dec);
  makeDrive({
    key: "cfw500", name: "WEG CFW500", model: "CFW500 · 200–240 V · 4,3 A (0,75 kW)",
    img: () => window.CFW500_IMG, FW: 400, FH: 1046, size3d: { w: 0.135, h: 0.353, d: 0.17 },
    FACE: { lcd: [57, 244, 338, 410], esc: [95, 452, 30], enter: [305, 452, 30], up: [199, 449, 26], down: [199, 505, 26], rot: [90, 515, 25], locrem: [138, 559, 25], jog: [200, 576, 23], stop: [264, 559, 26], start: [311, 515, 26] },
    keyNames: { esc: "BACK/ESC", enter: "MENU/ENTER", up: "▲", down: "▼", rot: "Sentido de giro", locrem: "LOC/REM", jog: "JOG", stop: "O (para / reseta falha)", start: "I (gira)" },
    repeatKeys: ["up", "down"],
    keysHelp: "<kbd>MENU/ENTER</kbd> entra e salva · <kbd>BACK/ESC</kbd> volta · <kbd>▲</kbd><kbd>▼</kbd> navegam ou mudam o valor (segure para correr) · <kbd>I</kbd> gira · <kbd>O</kbd> para ou reseta a falha.",
    hint3d: "Opere as <b>teclas do CFW500 no painel 3D</b>, como no equipamento real. No modo monitoração, <b>▲▼ mudam a velocidade</b> (P0121) quando a referência é a HMI.",
    defs: CFW_DEFS, home: "mon",
    faultName: c => ({ 72: "F0072 · Sobrecarga no motor", 48: "F0048 · Sobrecarga nos IGBTs" })[c] || "F" + String(c).padStart(4, "0"),
    faultCode: c => "F" + String(c).padStart(4, "0"), resetHow: "aperte <b>O</b> para resetar", olFault: 72,
    isRemote: a => cfwRem(a),
    cmdText: a => (cfwRem(a) ? "REM · " : "LOC · ") + (OPT_GP[a.P(cfwRem(a) ? "P0227" : "P0224")] || "?"),
    rampBase: a => a.P("P0134"), acc: a => a.P("P0100"), dec: a => a.P("P0101"),
    fmin: a => a.P("P0133"), fmax: a => a.P("P0134"), coastStop: a => a.P("P0229") === 1,
    motor: a => ({ hz: a.P("P0403") || 60, fla: a.P("P0401"), ol: a.P("P0156"), v: a.P("P0400"), rpm: a.P("P0402") || 1710, imax: a.P("P0135") || 6.4 }),
    logic(a) {
      const s = a.st, rem = cfwRem(a), src = a.P(rem ? "P0227" : "P0224");
      if (src === 1 && !s.fault) { if (a.P("P0263") === 1) { if (s.di1) { s.run = true; } else if (!s.jogT) s.run = false; } }
      const r = a.P(rem ? "P0222" : "P0221");
      s.cmdF = s.jogT > 0 ? a.P("P0122") : r === 0 ? a.P("P0121") : r === 1 ? cfwAI(a) * a.P("P0134") : 0;
    },
    key2(a, k) {
      const s = a.st, ui = a.ui, rem = cfwRem(a);
      if (k === "stop") { if (s.fault) { s.fault = 0; s.ol = 0; a.msg("Falha resetada pela tecla O.", "ok"); return; } if (a.P(rem ? "P0227" : "P0224") === 0) s.run = false; else a.msg("A tecla O não comanda: o gira/para está nas <b>entradas digitais</b> (P0224/P0227 = 1). Ela só reseta falhas.", "bad"); return; }
      if (k === "start") { if (s.fault) { a.msg("Inversor em falha: aperte <b>O</b> para resetar antes.", "bad"); return; } if (a.P(rem ? "P0227" : "P0224") === 0) s.run = true; else a.msg(`A tecla I está inativa: em ${rem ? "REMOTO" : "LOCAL"} o gira/para vem de <b>${OPT_GP[a.P(rem ? "P0227" : "P0224")]}</b> (${rem ? "P0227" : "P0224"}).`, "bad"); return; }
      if (k === "locrem") { const p = a.P("P0220"); if (p === 2 || p === 3) { s.rem = !s.rem; s.run = false; a.msg(`Modo <b>${s.rem ? "REMOTO" : "LOCAL"}</b>.`, ""); } else a.msg("A tecla LOC/REM só vale com <b>P0220 = 2 ou 3</b>.", "bad"); return; }
      if (k === "rot") { const p = a.P(rem ? "P0226" : "P0223"); if (p === 2 || p === 3) { s.dir = -s.dir; a.msg(s.dir < 0 ? "Sentido <b>anti-horário</b>. Numa centrífuga, ao contrário, a vazão cai muito." : "Sentido <b>horário</b>.", ""); } else a.msg(`A tecla de giro está inativa (${rem ? "P0226" : "P0223"} = ${p}).`, "bad"); return; }
      if (k === "jog") { if (s.run) { a.msg("O JOG só funciona com o motor parado.", "bad"); return; } if (!rem && a.P("P0225") === 1) { s.jogT = 1.5; s.run = true; a.msg(`JOG: gira em P0122 = ${a.P("P0122").toFixed(1)} Hz enquanto a tecla é usada.`, ""); } else a.msg("JOG inativo (P0225).", "bad"); return; }
      const list = cfwList(a), mult = ui.rep < 8 ? 1 : ui.rep < 25 ? 10 : 100;
      if (ui.mode === "mon") {
        if (k === "enter") { ui.mode = "l1"; if (ui.grp == null) ui.grp = 0; }
        else if ((k === "up" || k === "down") && a.P(rem ? "P0222" : "P0221") === 0) { a.set("P0121", clamp(Math.round((a.P("P0121") + (k === "up" ? 1 : -1) * 0.1 * mult) * 10) / 10, 0, a.P("P0134"))); }
        else if (k === "up" || k === "down") a.msg("As setas não mudam a velocidade: a referência não é a HMI (P0221/P0222).", "bad");
        return;
      }
      if (ui.mode === "l1") {
        if (k === "up") ui.grp = (ui.grp + CFW_GROUPS.length - 1) % CFW_GROUPS.length;
        else if (k === "down") ui.grp = (ui.grp + 1) % CFW_GROUPS.length;
        else if (k === "enter") { if (!cfwList(a).length) { a.msg("O grupo <b>MODIF</b> lista só os parâmetros alterados. Ainda não há nenhum.", ""); return; } ui.mode = "l2"; ui.idx = 0; }
        else if (k === "esc") ui.mode = "mon";
        return;
      }
      if (ui.mode === "l2") {
        const n = list.length;
        if (k === "up") ui.idx = (ui.idx + 1) % n; else if (k === "down") ui.idx = (ui.idx + n - 1) % n;
        else if (k === "esc") ui.mode = "l1";
        else if (k === "enter") { const d = list[ui.idx]; if (d.ro) { a.msg(`<b>${d.c}</b> é só de leitura (ro).`, ""); return; } if (d.cfg && a.running()) { a.msg(`<b>${d.c}</b> é "cfg": só muda com o motor <b>parado</b>.`, "bad"); return; } ui.mode = "l3"; ui.ed = a.P(d.c); }
        return;
      }
      if (ui.mode === "l3") {
        const d = list[ui.idx];
        if (k === "up" || k === "down") { const step = Math.pow(10, -d.dec) * mult; let v = ui.ed + (k === "up" ? step : -step); if (d.opts) { const ks = Object.keys(d.opts).map(Number); const i = ks.indexOf(ui.ed); v = ks[clamp((i < 0 ? 0 : i) + (k === "up" ? 1 : -1), 0, ks.length - 1)]; } ui.ed = clamp(Math.round(v * 1e3) / 1e3, d.min, d.max); }
        else if (k === "esc") { ui.mode = "l2"; a.msg("Alteração cancelada (BACK/ESC).", ""); }
        else if (k === "enter") {
          if (d.cfg && a.running()) { a.msg(`Pare o motor antes de salvar <b>${d.c}</b>.`, "bad"); return; }
          if (d.c === "P0204" && (ui.ed === 5 || ui.ed === 6)) { const hz50 = ui.ed === 6; a.defaults(); if (hz50) { a.st.par.P0403 = 50; a.st.par.P0134 = 55; a.st.par.P0402 = 1425; } a.changed(); ui.mode = "l2"; a.msg(`Padrão WEG para <b>${hz50 ? "50" : "60"} Hz</b> carregado (P0204). P0204 voltou para 0.`, "ok"); return; }
          if (d.c === "P0220") a.st.rem = ui.ed === 3 || ui.ed === 1;
          a.set(d.c, ui.ed); ui.mode = "l2"; a.msg(`<b>${d.c} [${d.n}]</b> salvo: <b>${cfwFmt(d, ui.ed)}</b>${d.opts && d.opts[ui.ed] ? " = " + d.opts[ui.ed] : d.u ? " " + d.u : ""}.`, "ok");
        }
      }
    },
    draw(g, a, now, on) {
      const [x0, y0, x1, y1] = this.FACE.lcd, s = a.st, ui = a.ui, rem = cfwRem(a);
      const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, "#D6EC5A"); gr.addColorStop(1, "#C3DD44");
      g.fillStyle = gr; rr(g, x0, y0, x1 - x0, y1 - y0, 6); g.fill();
      const ink = "#1A2412", off = "rgba(20,40,10,.06)";
      g.fillStyle = ink; g.font = "bold 13px Arial"; g.textAlign = "left";
      const list = cfwList(a);
      if (ui.mode !== "mon") g.fillText(CFW_GROUPS[ui.grp || 0].k, x0 + 8, y0 + 18);
      g.fillText(rem ? "REM" : "LOC", x0 + 66, y0 + 18);
      if (a.running()) g.fillText("RUN", x0 + 66, y0 + 44);
      g.font = "bold 18px Arial"; g.fillText(s.dir < 0 ? "↺" : "↻", x0 + 44, y0 + 44);
      if (a.P("P0202") === 5) { g.font = "bold 11px Arial"; g.fillText("VVW", x0 + 8, y0 + 44); }
      let sec = "", main = "", unit = "", blinkMain = -1;
      const pfmt = (c) => { const d = CFW_DEFS.find(x => x.c === c); return d ? cfwFmt(d, a.val(c)) : "----"; };
      if (s.fault && ui.mode === "mon") { main = "F" + String(s.fault).padStart(4, "0"); blinkMain = "all"; sec = pfmt("P0002"); }
      else if (s.warn && ui.mode === "mon" && on) { main = "A0046"; sec = pfmt("P0002"); }
      else if (ui.mode === "mon") { const pm = "P" + String(a.P("P0205")).padStart(4, "0"), ps = "P" + String(a.P("P0206")).padStart(4, "0"); main = pfmt(pm); sec = pfmt(ps); unit = (CFW_DEFS.find(x => x.c === pm) || {}).u || ""; }
      else if (ui.mode === "l1") { main = ""; sec = ""; }
      else if (ui.mode === "l2") { const d = list[ui.idx]; main = d.c; sec = cfwFmt(d, a.val(d.c)); }
      else if (ui.mode === "l3") { const d = list[ui.idx]; main = cfwFmt(d, ui.ed); sec = d.c; unit = d.u || ""; blinkMain = on ? -1 : "all"; }
      seg7Text(g, sec, x1 - 10, y0 + 8, 5, 22, 34, 4, ink, off, -1, true);
      seg7Text(g, main, x1 - 36, y0 + 62, 5, 40, 64, 6, ink, off, blinkMain, on);
      g.font = "bold 13px Arial"; g.textAlign = "left"; g.fillStyle = ink; if (unit) g.fillText(unit, x1 - 32, y0 + 78);
      // barra gráfica (P0207 = P0003, corrente) e escala
      const bx = x0 + 18, by = y1 - 30, bw = x1 - x0 - 36, frac = clamp(s.outF / Math.max(a.P("P0134"), 1), 0, 1);
      g.fillStyle = "rgba(20,40,10,.12)"; g.fillRect(bx, by, bw, 8); g.fillStyle = ink; g.fillRect(bx, by, bw * frac, 8);
      g.font = "bold 11px Arial"; g.textAlign = "center"; g.fillText("0", bx, y1 - 8); g.fillText(Math.round(a.P("P0134") / 2), bx + bw / 2, y1 - 8); g.fillText(Math.round(a.P("P0134")), bx + bw, y1 - 8); g.textAlign = "left";
    },
    next(a) {
      const ui = a.ui, list = cfwList(a);
      if (a.st.fault) return "Inversor em <b>falha</b>: aperte <kbd>O</kbd> para resetar.";
      if (ui.mode === "mon") return `Modo <b>monitoração</b>. Para programar: <kbd>MENU/ENTER</kbd> (nível 1), <kbd>▼</kbd> até o grupo e <kbd>MENU/ENTER</kbd>. ${a.P(cfwRem(a) ? "P0222" : "P0221") === 0 ? "Aqui, <kbd>▲</kbd><kbd>▼</kbd> mudam a velocidade (P0121)." : ""}`;
      if (ui.mode === "l1") return `<b>Nível 1</b>, escolha do grupo (agora <b>${CFW_GROUPS[ui.grp].k}</b>): <kbd>▲</kbd><kbd>▼</kbd> trocam, <kbd>MENU/ENTER</kbd> entra, <kbd>BACK/ESC</kbd> volta.`;
      if (ui.mode === "l2") { const d = list[ui.idx]; return `<b>Nível 2</b>: <kbd>▲</kbd><kbd>▼</kbd> escolhem o parâmetro (agora <b>${d.c}</b>; o valor aparece no mostrador de cima). <kbd>MENU/ENTER</kbd> para editar.`; }
      if (ui.mode === "l3") return "<b>Nível 3 · editando</b>: <kbd>▲</kbd><kbd>▼</kbd> mudam o valor (segure para correr), <kbd>MENU/ENTER</kbd> <b>salva</b>, <kbd>BACK/ESC</kbd> cancela.";
      return "";
    },
    now(a) {
      const ui = a.ui, list = cfwList(a);
      if (ui.mode === "mon") return `Monitoração: principal = <code>P${String(a.P("P0205")).padStart(4, "0")}</code>, secundário = <code>P${String(a.P("P0206")).padStart(4, "0")}</code>, barra = velocidade. ${cfwRem(a) ? "REMOTO" : "LOCAL"}.`;
      if (ui.mode === "l1") return `Grupo <b>${CFW_GROUPS[ui.grp].k}</b>: ${CFW_GROUPS[ui.grp].t}.`;
      const d = list[ui.idx]; if (!d) return "";
      const v = ui.mode === "l3" ? ui.ed : a.val(d.c);
      return `<code>${d.c}</code> <b>[${d.n}]</b> = <b>${cfwFmt(d, v)}</b>${d.opts && d.opts[v] != null ? " · “" + d.opts[v] + "”" : d.u ? " " + d.u : ""}${ui.mode === "l3" ? " <b style=\"color:#E87722\">(editando)</b>" : ""}<div class="note" style="margin-top:4px">${d.pt}${d.ro ? " <b>Somente leitura.</b>" : ` Faixa ${d.min}–${d.max} · padrão ${cfwFmt(d, d.d)}.`}${d.cfg ? " <b>cfg: só muda com o motor parado.</b>" : ""}</div>`;
    },
    guide(a, code) {
      const d = CFW_DEFS.find(x => x.c === code); if (!d) return "";
      const gi = CFW_GROUPS.findIndex((g, i) => i >= 3 && g.f(d, a)), g = gi < 0 ? 0 : gi;
      const list = CFW_DEFS.filter(x => CFW_GROUPS[g].f(x, a)), i = list.indexOf(d);
      return `<button class="x" title="Fechar">✕</button><b class="h">Como chegar em ${code} [${d.n}]</b><ol>
        <li>No modo monitoração, aperte <kbd>MENU/ENTER</kbd>: entra no nível 1 (aparece <b>PARAM</b>).</li>
        <li>Aperte <kbd>▼</kbd> <b>${g}×</b> até o grupo <b>${CFW_GROUPS[g].k}</b>.</li>
        <li><kbd>MENU/ENTER</kbd> entra no grupo (nível 2).</li>
        <li>${i > 0 ? `Aperte <kbd>▲</kbd> <b>${i}×</b> até <b>${code}</b>.` : `Você já está em <b>${code}</b>.`}</li>
        <li><kbd>MENU/ENTER</kbd> para editar (nível 3)${d.cfg ? " — com o motor <b>parado</b>" : ""}.</li>
        <li><kbd>▲</kbd><kbd>▼</kbd> mudam o valor (segure para correr).</li>
        <li><kbd>MENU/ENTER</kbd> <b>salva</b>; <kbd>BACK/ESC</kbd> volta.</li></ol>`;
    },
    checklists: (a) => ({
      a1: { t: "Atividade 1 · Partida pela HMI (LOCAL)", note: "Dados de placa de <b>exemplo</b> (motor 0,75 kW, 220 V): confira a placa do motor da bancada.", items: [
        ["Seletora de partida em <b>WEG CFW500</b>", () => DRV.sel === "cfw500"],
        ["P0400 [Tensão Nom. Motor] = 220 V", () => a.P("P0400") === 220, "P0400"],
        ["P0401 [Corrente Nom. Motor] = 3,0 A", () => Math.abs(a.P("P0401") - 3) < 0.05, "P0401"],
        ["P0402 [Velocidade Nom. Motor] = 1720 rpm", () => a.P("P0402") === 1720, "P0402"],
        ["P0403 [Frequência Nom. Motor] = 60 Hz", () => a.P("P0403") === 60, "P0403"],
        ["P0404 [Potência Nom. Motor] = 5 (1,00 HP / 0,75 kW)", () => a.P("P0404") === 5, "P0404"],
        ["P0100 [Tempo Aceleração] = 5,0 s", () => Math.abs(a.P("P0100") - 5) < 0.05, "P0100"],
        ["P0101 [Tempo Desaceleração] = 5,0 s", () => Math.abs(a.P("P0101") - 5) < 0.05, "P0101"],
        ["P0134 [Velocidade Máxima] = 60,0 Hz", () => Math.abs(a.P("P0134") - 60) < 0.05, "P0134"],
        ["P0220 = 2 (Tecla HMI, LOC) · P0221 = 0 (Teclas HMI) · P0224 = 0 (Tecla HMI)", () => a.P("P0220") === 2 && a.P("P0221") === 0 && a.P("P0224") === 0, "P0220"],
        ["Em LOCAL, partir com <b>I</b> e levar a <b>45 Hz</b> com ▲ (veja P0002 e P0003)", () => a.st.ach45],
        ["Parar com <b>O</b> e observar a rampa de desaceleração", () => a.st.stopAfter45],
      ] },
      a2: { t: "Atividade 2 · Partida pelo CLP (REMOTO)", note: "O Y0 do CLP fecha a <b>DI1</b>; a velocidade vem do CLP pela <b>AI1</b> (D1117, 4–20 mA).", items: [
        ["Seletora de partida em <b>WEG CFW500</b>", () => DRV.sel === "cfw500"],
        ["P0220 = 1 (Sempre Remoto) ou 3 (Tecla HMI, REM)", () => [1, 3].includes(a.P("P0220")), "P0220"],
        ["P0227 [Gira/Para REM] = 1 (DIx)", () => a.P("P0227") === 1, "P0227"],
        ["P0263 [Função DI1] = 1 (Gira/Para)", () => a.P("P0263") === 1, "P0263"],
        ["P0222 [Referência REM] = 1 (AI1)", () => a.P("P0222") === 1, "P0222"],
        ["P0233 [Sinal AI1] = 1 (4 a 20 mA)", () => a.P("P0233") === 1, "P0233"],
        ["Ligar a bomba pelo CLP (Y0) ou pelo botão local e ver o CFW500 girar em REMOTO", () => a.st.ranDI],
      ] },
    }),
  });

  /* ================= Schneider Altivar ATV12 ================= */
  // ATV12H075M2: 200–240 V monofásico, 0,75 kW, In = 4,2 A
  const ATV_IN = 4.2;
  const T_FR1 = { 0: "AI1", 1: "LCC", 2: "Ndb", 3: "AIU1" }, T_AI1T = { 0: "5U", 1: "10U", 2: "0A" }, T_TCC = { 0: "2C", 1: "3C" }, T_YN = { 0: "nO", 1: "YES" }, T_BFR = { 0: "50", 1: "60" }, T_FCS = { 0: "nO", 1: "InI" };
  const ATV_DEFS = [
    // monitoração (MOn)
    { c: "rFr", n: "Output frequency", pt: "Frequência aplicada ao motor.", ro: 1, mon: 1, dec: 1, u: "HErt", get: s => s.outF },
    { c: "LCr", n: "Motor current", pt: "Corrente do motor.", ro: 1, mon: 1, dec: 1, u: "AMP", get: s => s.I },
    { c: "ULn", n: "Mains voltage", pt: "Tensão da rede.", ro: 1, mon: 1, dec: 0, u: "UOLt", get: () => 230 },
    { c: "tHr", n: "Motor thermal state", pt: "Estado térmico do motor (100 % = disparo OLF).", ro: 1, mon: 1, dec: 0, get: s => Math.min(118, s.ol / 20 * 100) },
    { c: "StAt", n: "Drive state", pt: "rdY = pronto, rUn = girando, ACC/dEC = em rampa, nSt = parada por inércia.", ro: 1, mon: 1, txt: s => s.fault ? "FLt" : s.accel ? "ACC" : s.decel ? "dEC" : (s.run || s.outF > 0.01) ? "rUn" : "rdY" },
    // configuração (ConF · MyMenu + alguns do FULL)
    { c: "AIU1", n: "Analog input virtual", pt: "Referência pelo botão giratório, de 0 a 100 % de HSP. Só aparece com Fr1 = AIU1. Gira o botão e o valor muda na hora, sem ENT.", min: 0, max: 100, d: 0, u: "%", live: 1, vis: a => a.P("Fr1") === 3 },
    { c: "bFr", n: "Standard motor frequency", pt: "50 ou 60 Hz, conforme a placa do motor. Mudar para 60 ajusta FrS, HSP e tFr. Segure ENT por 2 s.", min: 0, max: 1, d: 0, opts: T_BFR, hold: 1 },
    { c: "Fr1", n: "Reference channel 1", pt: "Origem da referência (e do comando): AI1 = bornes, AIU1 = botão giratório da IHM (habilita RUN/STOP locais).", min: 0, max: 3, d: 0, opts: T_FR1 },
    { c: "ACC", n: "Acceleration", pt: "Tempo de 0 Hz até a frequência nominal (FrS).", min: 0, max: 999.9, dec: 1, d: 3, u: "SEC" },
    { c: "dEC", n: "Deceleration", pt: "Tempo da frequência nominal (FrS) até 0 Hz.", min: 0, max: 999.9, dec: 1, d: 3, u: "SEC" },
    { c: "LSP", n: "Low speed", pt: "Frequência mínima.", min: 0, max: 400, dec: 1, d: 0, u: "HErt" },
    { c: "HSP", n: "High speed", pt: "Frequência máxima (100 % da referência).", min: 0, max: 400, dec: 1, d: 50, u: "HErt" },
    { c: "nCr", n: "Rated motor current", pt: "Corrente da placa do motor. Também ajusta a proteção térmica (ItH): acima dela, por tempo, ocorre OLF.", min: 1.0, max: 6.3, dec: 1, d: 3.5, u: "AMP" },
    { c: "AI1t", n: "AI1 type", pt: "Tipo da entrada AI1: 5U (0–5 V), 10U (0–10 V), 0A (corrente, 4–20 mA com CrL1 = 4 mA). O CLP manda 4–20 mA. Segure ENT por 2 s.", min: 0, max: 2, d: 0, opts: T_AI1T, hold: 1 },
    { c: "tCC", n: "Type of control", pt: "2C = comando a 2 fios (LI1 = avanço), 3C = 3 fios. No ATV12 real fica no menu FULL › I-O-. Segure ENT por 2 s.", min: 0, max: 1, d: 0, opts: T_TCC, hold: 1 },
    { c: "UnS", n: "Rated motor voltage", pt: "Tensão da placa do motor (menu FULL › drC-).", min: 100, max: 480, d: 230, u: "UOLt" },
    { c: "FrS", n: "Rated motor frequency", pt: "Frequência da placa do motor (menu FULL › drC-).", min: 10, max: 400, dec: 1, d: 50, u: "HErt" },
    { c: "nSP", n: "Rated motor speed", pt: "Rotação da placa do motor (menu FULL › drC-).", min: 0, max: 24000, d: 1400, u: "rpm" },
    { c: "tFr", n: "Maximum frequency", pt: "Limite superior para HSP (menu FULL › drC-).", min: 10, max: 400, dec: 1, d: 60, u: "HErt" },
    { c: "rIn", n: "Reverse inhibition", pt: "YES bloqueia a reversão (menu FULL › CtL-).", min: 0, max: 1, d: 0, opts: T_YN },
    { c: "FCS", n: "Factory / recall", pt: "InI = volta ao padrão de fábrica. Segure ENT por 2 s.", min: 0, max: 1, d: 0, opts: T_FCS, hold: 1 },
  ];
  const atvConf = a => ATV_DEFS.filter(d => !d.mon && !d.live);   // AIU1 fica no modo REF (botão giratório), não no CONF
  const atvMon = () => ATV_DEFS.filter(d => d.mon);
  const MODES = ["rEF", "MOn", "ConF"];
  const atvText = (d, v, s) => d.txt ? d.txt(s) : d.opts ? d.opts[v] : Number(v).toFixed(d.dec || 0);
  const atvLocal = a => a.P("Fr1") === 3 || a.P("Fr1") === 1;
  makeDrive({
    key: "atv12", name: "Altivar ATV12", model: "ATV12H075M2 · 200–240 V · 0,75 kW · In 4,2 A",
    img: () => window.ATV12_IMG, FW: 400, FH: 721, size3d: { w: 0.14, h: 0.252, d: 0.15 },
    FACE: { lcd: [113, 184, 281, 253], esc: [284, 314, 21], mode: [234, 314, 13], dial: [192, 397, 58], run: [290, 365, 18], stop: [290, 418, 18], lbl: [44, 582, 176, 600] },
    keyNames: { esc: "ESC", mode: "MODE", dial: "Botão giratório (esquerda = −, direita = +, centro = ENT)", run: "RUN", stop: "STOP/RESET" },
    repeatKeys: [],
    // o botão giratório: lado esquerdo gira para −, direito para +, centro = ENT
    mapHit: (k, x, y, z) => k !== "dial" ? k : Math.hypot(x - z[0], y - z[1]) < 22 ? "ent" : x < z[0] ? "ccw" : "cw",
    keysHelp: "<kbd>MODE</kbd> troca REF · MON · CONF · o <b>botão giratório</b>: clique à <b>esquerda</b> (−) ou à <b>direita</b> (+) para girar e no <b>centro</b> para ENT (segure 2 s nos parâmetros marcados) · <kbd>ESC</kbd> volta · <kbd>RUN</kbd>/<kbd>STOP</kbd>.",
    hint3d: "Opere o <b>ATV12 no painel 3D</b>: <b>MODE</b> troca de modo; no <b>botão giratório</b>, clique à esquerda/direita para girar e no centro para <b>ENT</b>. RUN e STOP ficam sob a tampa oval.",
    defs: ATV_DEFS, home: "home",
    faultName: c => ({ 1: "OLF · Sobrecarga do motor" })[c] || "Falha " + c, faultCode: c => ({ 1: "OLF" })[c] || "FLt", resetHow: "aperte <b>STOP/RESET</b>", olFault: 1,
    isRemote: a => !atvLocal(a),
    cmdText: a => atvLocal(a) ? "Local · RUN/STOP" : `Bornes · ${T_TCC[a.P("tCC")]}`,
    rampBase: a => a.P("FrS"), acc: a => a.P("ACC"), dec: a => a.P("dEC"),
    fmin: a => a.P("LSP"), fmax: a => Math.min(a.P("HSP"), a.P("tFr")), coastStop: () => false,
    motor: a => ({ hz: a.P("FrS") || 50, fla: a.P("nCr"), ol: a.P("nCr"), v: a.P("UnS"), rpm: a.P("nSP") || 1400, imax: ATV_IN * 1.5 }),
    logic(a) {
      const s = a.st, local = atvLocal(a);
      if (!local && !s.fault && a.P("tCC") === 0) { const edge = s.di1 && !s.di1Prev; if (edge) s.run = true; if (!s.di1) s.run = false; } // 2 fios, LI1 = avanço (transição)
      if (!local && a.P("tCC") === 1) s.run = false;                                                           // 3 fios: falta a LI de STOP na bancada
      let pct = 0;
      if (a.P("Fr1") === 3) pct = a.P("AIU1") / 100;
      else if (a.P("Fr1") === 0) { const t = a.P("AI1t"); pct = s.ai == null ? 0 : t === 2 ? clamp(s.ai, 0, 1) : 0; }
      s.cmdF = a.P("LSP") + pct * (Math.min(a.P("HSP"), a.P("tFr")) - a.P("LSP"));
    },
    key2(a, k, ev) {
      const s = a.st, ui = a.ui;
      if (k === "stop") { if (s.fault) { s.fault = 0; s.ol = 0; a.msg("Falha resetada (STOP/RESET).", "ok"); return; } s.run = false; return; }
      if (k === "run") { if (s.fault) { a.msg("Inversor em falha: aperte <b>STOP/RESET</b> antes.", "bad"); return; } if (!atvLocal(a)) { a.msg("RUN inativo: de fábrica o ATV12 é comandado pelos bornes. Para usar RUN e o botão giratório, ajuste <b>Fr1 = AIU1</b> (manual, pág. 49).", "bad"); return; } s.run = true; return; }
      if (k === "mode") { const i = MODES.indexOf(ui.mode); ui.mode = MODES[(i + 1) % 3]; ui.st = "name"; ui.ed = null; return; }
      if (ui.mode === "home") { if (k === "ent" || k === "cw" || k === "ccw" || k === "esc") { ui.mode = "rEF"; ui.st = "name"; } return; }
      const list = ui.mode === "ConF" ? atvConf(a) : ui.mode === "MOn" ? atvMon() : null;
      const d = list ? list[ui.i || 0] : null;
      if (ui.st === "name") {
        if (k === "cw" || k === "ccw") { const i = MODES.indexOf(ui.mode); ui.mode = MODES[(i + (k === "cw" ? 1 : 2)) % 3]; }
        else if (k === "ent") { ui.st = ui.mode === "rEF" ? "ref" : "list"; ui.i = 0; }
        else if (k === "esc") { ui.mode = "home"; }
        return;
      }
      if (ui.mode === "rEF") {
        if (k === "esc") { ui.st = "name"; return; }
        if ((k === "cw" || k === "ccw") && a.P("Fr1") === 3) { a.set("AIU1", clamp(a.P("AIU1") + (k === "cw" ? 5 : -5), 0, 100)); a.msg(`AIU1 = <b>${a.P("AIU1")} %</b> de HSP (${(a.P("AIU1") / 100 * a.P("HSP")).toFixed(1)} Hz). No modo REF não precisa de ENT.`, ""); }
        else if (k === "cw" || k === "ccw") a.msg("A referência está nos bornes (Fr1 ≠ AIU1): aqui ela só pode ser lida (FrH).", "bad");
        return;
      }
      if (ui.st === "list") {
        if (k === "cw") ui.i = ((ui.i || 0) + 1) % list.length; else if (k === "ccw") ui.i = ((ui.i || 0) + list.length - 1) % list.length;
        else if (k === "esc") ui.st = "name";
        else if (k === "ent") { ui.st = "val"; ui.ed = d.ro ? null : a.P(d.c); }
        return;
      }
      if (ui.st === "val") {
        if (k === "esc") { ui.st = "list"; ui.ed = null; return; }
        if (d.ro) { if (k === "ent") { ui.unitT = performance.now(); } return; }
        if (k === "cw" || k === "ccw") {
          const step = d.opts ? 1 : Math.pow(10, -(d.dec || 0)) * (ui.rep < 6 ? 1 : ui.rep < 20 ? 10 : 100);
          ui.ed = clamp(Math.round((ui.ed + (k === "cw" ? step : -step)) * 100) / 100, d.min, d.max);
          if (d.live) a.set(d.c, ui.ed);
          return;
        }
        if (k === "ent") {
          if (d.hold && !((ev.holdMs || 0) >= 1800)) { a.msg(`<b>${d.c}</b> só grava com <b>ENT segurado por 2 s</b> (símbolo de ampulheta no manual). Segure o centro do botão giratório.`, "bad"); return; }
          if (d.c === "FCS" && ui.ed === 1) { if (a.running()) { a.msg("Pare o motor antes.", "bad"); return; } a.defaults(); a.changed(); ui.st = "list"; a.msg("Configuração de <b>fábrica</b> carregada (FCS = InI).", "ok"); return; }
          if (d.c === "bFr") { const hz = ui.ed === 1 ? 60 : 50; a.st.par.FrS = hz; a.st.par.HSP = hz; a.st.par.tFr = hz === 60 ? 72 : 60; }
          a.set(d.c, ui.ed); ui.st = "list"; a.msg(`<b>${d.c}</b> gravado: <b>${atvText(d, ui.ed, s)}</b>${d.u ? " " + d.u : ""}.`, "ok");
        }
      }
    },
    draw(g, a, now, on) {
      const [x0, y0, x1, y1] = this.FACE.lcd, s = a.st, ui = a.ui;
      g.fillStyle = "#14161A"; rr(g, x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4, 3); g.fill();
      const red = "#FF2B1F", off = "rgba(255,40,30,.07)";
      let txt = "", blink = -1, val = false, unit = false;
      const list = ui.mode === "ConF" ? atvConf(a) : ui.mode === "MOn" ? atvMon() : null, d = list ? list[ui.i || 0] : null;
      if (s.fault && (ui.mode === "home" || ui.st === "name")) { txt = this.faultCode(s.fault); blink = "all"; }
      else if (ui.mode === "home") txt = a.running() ? s.outF.toFixed(1) : "rdY", val = a.running();
      else if (ui.st === "name") txt = ui.mode === "MOn" ? "MOn" : ui.mode === "ConF" ? "ConF" : "rEF";
      else if (ui.mode === "rEF") { txt = a.P("Fr1") === 3 ? String(a.P("AIU1")) : s.cmdF.toFixed(1); val = true; }
      else if (ui.st === "list") txt = d.c;
      else if (ui.st === "val") {
        if (ui.unitT && now - ui.unitT < 2000 && d.u) { txt = d.u; unit = true; }
        else { txt = atvText(d, d.ro ? a.val(d.c) : ui.ed, s); val = true; if (!d.ro && ui.ed !== a.P(d.c)) blink = on ? -1 : "all"; }
      }
      // os códigos do ATV12 usam letras de 7 segmentos
      txt = String(txt).replace("rpm", "rPM").slice(0, 6);
      seg7Text(g, txt, x1 - 8, y0 + 12, 4, 30, 46, 7, red, off, blink, on);
      const led = (x, y, lit, col) => { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fillStyle = lit ? col : "#3A2422"; g.fill(); if (lit) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.fillStyle = "rgba(255,60,40,.25)"; g.fill(); } };
      const m = ui.mode, editing = ui.st === "val" && list && d && !d.ro;
      led(80, 203, m === "rEF", red); led(80, 218, m === "MOn" || m === "home", red); led(80, 234, m === "ConF" || editing, red);
      led(290, 203, val, red); led(290, 233, unit, red);
      // RUN e STOP (sob a tampa oval) e MODE
      const [rx, ry, rr2] = this.FACE.run, [sx, sy] = this.FACE.stop, [mx, my, mr] = this.FACE.mode;
      g.fillStyle = "#1E9A4A"; g.beginPath(); g.arc(rx, ry, rr2, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 10px Arial"; g.textAlign = "center"; g.fillText("RUN", rx, ry + 4);
      g.fillStyle = "#C8342A"; g.beginPath(); g.arc(sx, sy, rr2, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 8px Arial"; g.fillText("STOP", sx, sy + 1); g.fillText("RESET", sx, sy + 9);
      g.fillStyle = "#5A6068"; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 7px Arial"; g.fillText("MODE", mx, my + 3); g.textAlign = "left";
      // botão giratório: indica a posição do AIU1
      const [dx, dy, dr] = this.FACE.dial, ang = (-135 + 270 * (a.P("AIU1") / 100)) * Math.PI / 180;
      g.strokeStyle = "rgba(90,90,80,.55)"; g.lineWidth = 3; g.beginPath(); g.moveTo(dx + Math.sin(ang) * (dr - 22), dy - Math.cos(ang) * (dr - 22)); g.lineTo(dx + Math.sin(ang) * (dr - 6), dy - Math.cos(ang) * (dr - 6)); g.stroke();
      // etiqueta do modelo
      const [lx0, ly0, lx1, ly1] = this.FACE.lbl; g.fillStyle = "#F4F1E8"; g.fillRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
      g.fillStyle = "#1A1A1A"; g.font = "bold 15px Arial"; g.textAlign = "center"; g.fillText("ATV12H075M2", (lx0 + lx1) / 2, ly1 - 3); g.textAlign = "left";
    },
    next(a) {
      const ui = a.ui, s = a.st;
      if (s.fault) return "Inversor em <b>falha</b>: aperte <kbd>STOP/RESET</kbd>.";
      if (ui.mode === "home") return "Tela inicial (<b>rdY</b> = pronto). Aperte <kbd>MODE</kbd> para ir aos modos <b>rEF → MOn → ConF</b>.";
      if (ui.st === "name") return `Modo <b>${ui.mode}</b> (LED aceso à esquerda). <kbd>MODE</kbd> ou girar troca o modo; <b>ENT</b> (centro do botão) entra.`;
      if (ui.mode === "rEF") return a.P("Fr1") === 3 ? "Modo REF: <b>gire o botão</b> para mudar a velocidade (AIU1, % de HSP). <kbd>ESC</kbd> volta." : "Modo REF: com Fr1 ≠ AIU1, a referência só é lida aqui.";
      if (ui.st === "list") return "Gire o botão (esquerda/direita) para escolher o <b>código</b>; <b>ENT</b> mostra o valor; <kbd>ESC</kbd> volta.";
      if (ui.st === "val") { const list = ui.mode === "ConF" ? atvConf(a) : atvMon(), d = list[ui.i || 0]; return d.ro ? "Valor de leitura. <b>ENT</b> mostra a unidade; <kbd>ESC</kbd> volta." : `Gire para mudar; <b>ENT</b> grava${d.hold ? " — <b>segure ENT 2 s</b> neste parâmetro" : ""}; <kbd>ESC</kbd> cancela.`; }
      return "";
    },
    now(a) {
      const ui = a.ui;
      if (ui.mode === "home") return "Display: <code>rdY</code> (pronto) ou a frequência de saída quando gira.";
      if (ui.st === "name") return `Modo <code>${ui.mode}</code>: ${{ rEF: "referência de velocidade", MOn: "monitoração (leituras)", ConF: "configuração (MyMenu e alguns do FULL)" }[ui.mode]}.`;
      if (ui.mode === "rEF") return a.P("Fr1") === 3 ? `<code>AIU1</code> = <b>${a.P("AIU1")} %</b> de HSP → ${(a.P("AIU1") / 100 * a.P("HSP")).toFixed(1)} Hz.` : `<code>FrH</code> (referência) = <b>${a.st.cmdF.toFixed(1)} Hz</b>.`;
      const list = ui.mode === "ConF" ? atvConf(a) : atvMon(), d = list[ui.i || 0]; if (!d) return "";
      const v = ui.st === "val" && !d.ro ? ui.ed : a.val(d.c);
      return `<code>${d.c}</code> <b>[${d.n}]</b> = <b>${atvText(d, v, a.st)}</b>${d.u ? " " + d.u : ""}${ui.st === "val" && !d.ro ? " <b style=\"color:#E87722\">(editando)</b>" : ""}<div class="note" style="margin-top:4px">${d.pt}${d.ro ? "" : d.opts ? "" : ` Faixa ${d.min}–${d.max} · padrão ${atvText(d, d.d, a.st)}.`}</div>`;
    },
    guide(a, code) {
      const d = ATV_DEFS.find(x => x.c === code); if (!d) return "";
      const list = atvConf(a), i = list.indexOf(d);
      return `<button class="x" title="Fechar">✕</button><b class="h">Como chegar em ${code} [${d.n}]</b><ol>
        <li>Aperte <kbd>MODE</kbd> até acender o LED <b>CONF</b> (aparece <b>ConF</b>).</li>
        <li><b>ENT</b> (centro do botão giratório) entra na lista.</li>
        <li>${i > 0 ? `Gire para a <b>direita</b> <b>${i}×</b> até <b>${code}</b>.` : i === 0 ? `Você já está em <b>${code}</b>.` : `<b>${code}</b> não aparece agora (depende de outro parâmetro).`}</li>
        <li><b>ENT</b> mostra o valor.</li>
        <li>Gire para mudar o valor.</li>
        <li><b>ENT</b> grava${d.hold ? " — <b>segure por 2 s</b>" : ""}; <kbd>ESC</kbd> cancela.</li></ol>`;
    },
    checklists: (a) => ({
      a1: { t: "Atividade 1 · Partida pela IHM (local)", note: "Dados de placa de <b>exemplo</b> (motor 0,75 kW, 220 V, 60 Hz): confira a placa do motor da bancada.", items: [
        ["Seletora de partida em <b>Altivar ATV12</b>", () => DRV.sel === "atv12"],
        ["bFr [Standard motor frequency] = 60 (segurar ENT 2 s)", () => a.P("bFr") === 1, "bFr"],
        ["UnS [Rated motor voltage] = 220 V", () => a.P("UnS") === 220, "UnS"],
        ["nCr [Rated motor current] = 3,0 A", () => Math.abs(a.P("nCr") - 3) < 0.05, "nCr"],
        ["FrS = 60 Hz e nSP = 1720 rpm", () => Math.abs(a.P("FrS") - 60) < 0.05 && a.P("nSP") === 1720, "nSP"],
        ["ACC = 5,0 s e dEC = 5,0 s", () => Math.abs(a.P("ACC") - 5) < 0.05 && Math.abs(a.P("dEC") - 5) < 0.05, "ACC"],
        ["HSP [High speed] = 60,0 Hz", () => Math.abs(a.P("HSP") - 60) < 0.05, "HSP"],
        ["Fr1 [Reference channel 1] = AIU1 (habilita RUN e o botão giratório)", () => a.P("Fr1") === 3, "Fr1"],
        ["Apertar <b>RUN</b> e, no modo REF, girar até <b>45 Hz</b> (AIU1 = 75 %)", () => a.st.ach45],
        ["Parar com <b>STOP</b> e observar a rampa", () => a.st.stopAfter45],
      ] },
      a2: { t: "Atividade 2 · Partida pelo CLP (bornes)", note: "O Y0 do CLP fecha a <b>LI1</b> (avanço); a velocidade vem pela <b>AI1</b> (D1117, 4–20 mA).", items: [
        ["Seletora de partida em <b>Altivar ATV12</b>", () => DRV.sel === "atv12"],
        ["Fr1 [Reference channel 1] = AI1 (bornes)", () => a.P("Fr1") === 0, "Fr1"],
        ["tCC [Type of control] = 2C (2 fios)", () => a.P("tCC") === 0, "tCC"],
        ["AI1t [AI1 type] = 0A (corrente, 4–20 mA)", () => a.P("AI1t") === 2, "AI1t"],
        ["Ligar a bomba pelo CLP (Y0) ou pelo botão local e ver o ATV12 girar", () => a.st.ranDI],
      ] },
    }),
  });
  css();
})();
