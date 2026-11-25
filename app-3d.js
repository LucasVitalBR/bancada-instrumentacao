/* Bancada 3D · tanque de acrílico (nível e temperatura), bomba e CLP Delta DVP-SX2
   Cena própria (Three.js). Mecânica: Bancada de Peças + áreas de encaixe.
   Endereços e escalas do CLP conferidos no manual do DVP-SX2 (AI 4–20 mA → 0..2000, AO 4–20 mA → 0..4000). */
(function () {
  "use strict";
  const T = window.THREE;
  let ttZero = 0;   // erro de zero do transmissor TT-104 (°C): descalibração didática
  try { const z = parseFloat(localStorage.getItem("nivel-tt-zero")); if (isFinite(z)) ttZero = Math.max(-10, Math.min(10, z)); } catch (e) { }
  let ltZero = 0;   // erro de zero do transmissor de nível LT-101 (cm): descalibração injetada pelo professor
  try { const z = parseFloat(localStorage.getItem("nivel-lt-zero")); if (isFinite(z)) ltZero = Math.max(-10, Math.min(10, z)); } catch (e) { }
  const LVL_CM = 88;   // altura útil da água no modelo (m ×100): 100 % = 88 cm
  const ltInfo = Lp => { const cmReal = LVL_CM * Lp / 100, cm = Math.max(0, cmReal + ltZero), kPa = 9.81 * cm / 100, f = Math.min(1, kPa / 10); return { cmReal, cm, kPa, mA: 4 + 16 * f, counts: Math.round(f * 2000) }; };   // P = ρ·g·h (ρ = 1000 kg/m³), faixa 0–10 kPa = 4–20 mA = 0–2000
  function setLtZero(v) { ltZero = Math.max(-10, Math.min(10, Math.round((+v || 0) * 2) / 2)); try { localStorage.setItem("nivel-lt-zero", String(ltZero)); } catch (e) { } if (S.proc) updateReadings(); }
  const Tm = P => P.T + ttZero;   // temperatura que o TT-104 mede (real + erro de zero)
  function setTtZero(v) { ttZero = Math.max(-10, Math.min(10, Math.round((+v || 0) * 2) / 2)); try { localStorage.setItem("nivel-tt-zero", String(ttZero)); } catch (e) { } if (S.proc) updateReadings(); }
  window.__ttWired = true;   // a aba "Ligação do PT100" está fora por enquanto: o TT-104 conta como ligado
  const DX = -3.65;  // conjunto tanque, bomba e tubulação avançado 25 cm em direção ao painel
  let started = false;
  // qualidade gráfica: alta (padrão em placa dedicada), média e baixa (menos resolução, menos partículas e menos efeitos) — escolhida pelos botões ao lado do FPS
  const QUAL = { alta: { h: 1080, pf: 1, wv: 1, pc: 0.066 }, media: { h: 720, pf: 0.3, wv: 2, pc: 0.12 }, baixa: { h: 480, pf: 0, wv: 0, pc: 1e9 } };   // baixa = água simplificada: superfície plana, jato e dreno simples, sem bolhas/espuma/gotas; monitor do fundo parado   // h = altura máxima da imagem 3D interna (a janela continua adaptável: a imagem é esticada para caber)
  function gpuName() { try { const c = document.createElement("canvas"), g = c.getContext("webgl"), e = g.getExtension("WEBGL_debug_renderer_info"), n = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER), l = g.getExtension("WEBGL_lose_context"); if (l) l.loseContext(); return String(n); } catch (e) { return ""; } }
  let qName = "alta";
  { let st = null; try { st = localStorage.getItem("nivel-q3d"); } catch (e) { }
    if (st && QUAL[st]) qName = st; else { const g = gpuName(); qName = /(nvidia|geforce|rtx|gtx|radeon rx|radeon pro|apple m\d)/i.test(g) ? "alta" : /(intel|uhd|iris|swiftshader|llvmpipe|basic render|mali|adreno|powervr|vc4)/i.test(g) ? "media" : "alta"; } }
  const qpf = () => QUAL[qName].pf;
  const S = { parts: {}, slots: {}, installed: {}, errors: 0, sel: null, proc: null, lvl: null, labels: {}, done: {}, labelMode: "compact", hot: null, ui: { emerg: false, selRes: false }, burnt: false, force: { LSL: null, LSH: null, TSH: null } };   // force: null = automático · LSL/LSH: true = boia levantada (água acima) · TSH: true = atuado

  /* ---------- catálogo ---------- */
  const PARTS = [
    { tag: "TE-104", name: "Sensor PT100 com poço", slot: "te", icon: "probe", grp: "tq" },
    { tag: "TT-104", name: "Transmissor de temperatura", slot: "tt", icon: "tt", grp: "tq" },
    { tag: "TSH-104", name: "Termostato de imersão", slot: "tsh", icon: "tsh", grp: "tq" },
    { tag: "LSH-101", name: "Chave boia", slot: "lsh", icon: "float", grp: "ln" },
    { tag: "LSL-101", name: "Chave boia", slot: "lsl", icon: "float", grp: "ln" },
    { tag: "VY-01", name: "Válvula solenoide", slot: "vy", icon: "vy", grp: "ln" },
  ];
  const SLOTDEF = {
    te: { hint: "Entrada com poço termométrico na tampa do tanque" },
    tt: { hint: "Cabeçote aberto do sensor de temperatura", req: "te" },
    tsh: { hint: "Luva na parede do tanque para a chave de temperatura de segurança" },
    lsh: { hint: "Furo na parede do tanque de acrílico, perto do topo" },
    lsl: { hint: "Furo na parede do tanque de acrílico, perto do fundo" },
    vy: { hint: "Trecho da tubulação para a válvula liga/desliga" },
  };
  const GRP = { tq: "Temperatura (resistência e PT100)", ln: "Nível e bomba" };

  const ICONS = {
    probe: '<rect x="23" y="4" width="18" height="12" rx="3" fill="#B9C2CC" stroke="#1E3A5F" stroke-width="2"/><rect x="30" y="16" width="4" height="42" fill="#6B7684"/><rect x="26" y="22" width="12" height="5" fill="#1E3A5F"/>',
    probe2: '<circle cx="32" cy="9" r="6" fill="#E8C21C"/><rect x="30" y="14" width="4" height="44" fill="#9AA5B1"/><path d="M26 30 h12" stroke="#B83A2E" stroke-width="3"/>',
    tt: '<circle cx="32" cy="34" r="18" fill="#F4F6F8" stroke="#1E3A5F" stroke-width="3"/><circle cx="24" cy="30" r="3" fill="#6B7684"/><circle cx="32" cy="27" r="3" fill="#6B7684"/><circle cx="40" cy="30" r="3" fill="#6B7684"/><text x="32" y="44" font-size="8" text-anchor="middle" fill="#1E3A5F">4-20</text>',
    pit: '<rect x="10" y="14" width="44" height="24" rx="11" fill="#1F8A8A"/><rect x="27" y="38" width="10" height="10" fill="#6B7684"/><polygon points="24,48 40,48 37,58 27,58" fill="#1E3A5F"/>',
    psh: '<rect x="18" y="12" width="28" height="32" rx="3" fill="#8A949F"/><rect x="18" y="8" width="28" height="6" fill="#B83A2E"/><polygon points="24,44 40,44 37,56 27,56" fill="#1E3A5F"/>',
    tsh: '<circle cx="20" cy="30" r="13" fill="#8A949F"/><circle cx="20" cy="30" r="5" fill="#B83A2E"/><rect x="33" y="27" width="26" height="6" fill="#6B7684"/>',
    pg: '<circle cx="32" cy="28" r="20" fill="#fff" stroke="#1E3A5F" stroke-width="4"/><line x1="32" y1="28" x2="43" y2="19" stroke="#B83A2E" stroke-width="3"/><rect x="28" y="48" width="8" height="12" fill="#6B7684"/>',
    lit: '<rect x="20" y="6" width="24" height="24" rx="5" fill="#E8E2D0" stroke="#1E3A5F" stroke-width="2"/><rect x="26" y="30" width="12" height="8" fill="#6B7684"/><path d="M22 40 h20 l-4 16 h-12 z" fill="#3E5068"/><path d="M20 58 q12 6 24 0" stroke="#2F6DB5" stroke-width="2" fill="none"/>',
    float: '<ellipse cx="22" cy="40" rx="14" ry="9" fill="#fff" stroke="#1E3A5F" stroke-width="3"/><rect x="36" y="37" width="22" height="6" fill="#6B7684"/><rect x="50" y="22" width="10" height="16" fill="#8A949F"/>',
    flow: '<rect x="4" y="38" width="56" height="12" fill="#7E8EA3"/><rect x="16" y="34" width="32" height="20" rx="3" fill="#3E5068"/><rect x="24" y="10" width="16" height="24" rx="5" fill="#1F8A8A"/>',
    fv: '<rect x="4" y="44" width="56" height="10" fill="#7E8EA3"/><ellipse cx="32" cy="48" rx="11" ry="9" fill="#6B7684"/><rect x="30" y="20" width="4" height="22" fill="#6B7684"/><path d="M12 20 A20 12 0 0 1 52 20 Z" fill="#2F6DB5"/>',
    fy: '<rect x="14" y="16" width="36" height="32" rx="4" fill="#C9D1DA" stroke="#1E3A5F" stroke-width="3"/><circle cx="26" cy="32" r="5" fill="#fff" stroke="#1E3A5F" stroke-width="2"/><circle cx="40" cy="32" r="5" fill="#fff" stroke="#1E3A5F" stroke-width="2"/>',
    vy: '<rect x="4" y="44" width="56" height="10" fill="#7E8EA3"/><rect x="22" y="38" width="20" height="18" fill="#B08D57"/><rect x="22" y="12" width="20" height="24" rx="2" fill="#1F2A37"/><rect x="40" y="18" width="10" height="10" fill="#6B7684"/>',
  };

  /* ---------- utilidades ---------- */
  const $ = s => document.querySelector(s);
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (x, d = 1) => Number(x).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const M = {};
  function at(o, p, sc) { o.position.copy(p); if (sc) o.scale.copy(sc); return o; }
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  function mat(color, metal = 0.2, rough = 0.6, extra = {}) { return new T.MeshStandardMaterial(Object.assign({ color, metalness: Math.min(metal, 0.35), roughness: Math.max(rough, 0.4) }, extra)); }
  function mesh(geo, m, cast = false, recv = false) { const o = new T.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
  const cylX = (r, l, seg = 24) => new T.CylinderGeometry(r, r, l, seg).rotateZ(Math.PI / 2);
  const cylZ = (r, l, seg = 24) => new T.CylinderGeometry(r, r, l, seg).rotateX(Math.PI / 2);
  function orientY(o, dir) { o.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.clone().normalize()); return o; }

  /* ---------- tubulação realista ---------- */
  function pipe(a, b, r, m, parent) {
    const d = new T.Vector3().subVectors(b, a), len = d.length();
    if (len < 0.001) return null;
    const o = mesh(new T.CylinderGeometry(r, r, len, 24), m);
    o.position.copy(a).addScaledVector(d, 0.5);
    orientY(o, d);
    parent.add(o); return o;
  }
  function elbow(corner, d1, d2, R, r, m, parent) {
    const u = d2.clone().negate(), z = new T.Vector3().crossVectors(u, d1);
    const C = corner.clone().addScaledVector(d1, -R).addScaledVector(d2, R);
    const o = mesh(new T.TorusGeometry(R, r, 16, 18, Math.PI / 2), m);
    o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(u, d1, z));
    o.position.copy(C); parent.add(o);
    weld(corner.clone().addScaledVector(d1, -R), d1, r, parent);
    weld(corner.clone().addScaledVector(d2, R), d2, r, parent);
  }
  function weld(p, dir, r, parent) {
    const ring = mesh(new T.TorusGeometry(r * 1.02, r * 0.12, 8, 24), M.weld, false);
    ring.quaternion.setFromUnitVectors(v3(0, 0, 1), dir); ring.position.copy(p); parent.add(ring);
  }
  function pipeRun(pts, r, m, parent, opt = {}) {
    const R = opt.bend || r * 3.2, n = pts.length;
    const dirs = []; for (let i = 0; i < n - 1; i++) dirs.push(new T.Vector3().subVectors(pts[i + 1], pts[i]).normalize());
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i].clone(), b = pts[i + 1].clone();
      if (i > 0) a.addScaledVector(dirs[i], R);
      if (i < n - 2) b.addScaledVector(dirs[i], -R);
      pipe(a, b, r, m, parent);
    }
    for (let i = 1; i < n - 1; i++) elbow(pts[i], dirs[i - 1], dirs[i], R, r, m, parent);
    if (opt.flangeStart) flange(pts[0], dirs[0], r, parent);
    if (opt.flangeEnd) flange(pts[n - 1], dirs[n - 2], r, parent);
  }
  function flange(p, dir, r, parent, bolts = 6) {
    const g = new T.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.clone().normalize()); parent.add(g);
    const R = r * 2.3;
    const fk = "fl" + r.toFixed(4);
    if (!flange._g) flange._g = {};
    if (!flange._g[fk]) { const sh = new T.Shape(); sh.absarc(0, 0, R, 0, Math.PI * 2, false); const ho = new T.Path(); ho.absarc(0, 0, r * 0.82, 0, Math.PI * 2, true); sh.holes.push(ho);
      flange._g[fk] = new T.ExtrudeGeometry(sh, { depth: 0.028, bevelEnabled: false, curveSegments: 32 }).rotateX(-Math.PI / 2).translate(0, -0.014, 0); }
    g.add(mesh(flange._g[fk], M.flange));
    // furo: fundo escuro dentro do cano (aparece como parte oca)
    for (const y of [-0.0008, 0.0008]) { const d = mesh(new T.CircleGeometry(r * 0.84, 28), M.bore, false, false); d.rotation.x = -Math.PI / 2; d.position.y = y; g.add(d); }
    for (let i = 0; i < bolts; i++) {
      const a = i / bolts * Math.PI * 2 + Math.PI / bolts;
      g.add(at(mesh(new T.CylinderGeometry(r * 0.22, r * 0.22, 0.05, 6), M.bolt), v3(Math.cos(a) * R * 0.78, 0, Math.sin(a) * R * 0.78)));
    }
    return g;
  }
  // extremidade aberta de cano (boca oca): aro de parede + fundo escuro
  function openEnd(p, dir, r, parent) {
    const g = new T.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.clone().normalize()); parent.add(g);
    const lip = mesh(new T.TorusGeometry(r * 0.92, r * 0.12, 8, 24), M.steel, false); lip.rotation.x = Math.PI / 2; g.add(lip);
    const d = mesh(new T.CircleGeometry(r * 0.82, 24), M.bore, false, false); d.rotation.x = -Math.PI / 2; d.position.y = 0.0006; g.add(d);
    return g;
  }
  function support(x, z, yPipe, r, parent, axis = "x") {
    const top = yPipe - r - 0.012;
    parent.add(at(mesh(new T.BoxGeometry(0.05, top, 0.05), M.support), v3(x, top / 2, z)));
    parent.add(at(mesh(new T.BoxGeometry(0.16, 0.012, 0.16), M.support), v3(x, 0.006, z)));
    parent.add(at(mesh(new T.BoxGeometry(axis === "x" ? 0.06 : 0.12, 0.014, axis === "x" ? 0.12 : 0.06), M.support), v3(x, top, z)));
    const clampRing = mesh(new T.TorusGeometry(r * 1.15, 0.005, 6, 24, Math.PI), M.bolt);
    clampRing.position.set(x, yPipe, z);
    clampRing.rotation.set(0, axis === "x" ? Math.PI / 2 : 0, 0);
    parent.add(clampRing);
  }
  function screen(w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    return { tex: t, canvas: c, draw(lines, bg = "#CFE3C9") {
      const g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = bg === "#1F2A37" ? "#9FE3B0" : "#1F2A37"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `bold ${Math.round(h * 0.4)}px Courier New, monospace`; g.fillText(lines[0], w / 2, h * (lines[1] ? 0.38 : 0.52));
      if (lines[1]) { g.font = `bold ${Math.round(h * 0.2)}px Arial`; g.fillText(lines[1], w / 2, h * 0.78); }
      t.needsUpdate = true;
    } };
  }
  // display de cristal líquido dos transmissores Smar (LD301/TT301): tag, valor com unidade e % da faixa
  function smarScreen(tag, span) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    return { tex: t, canvas: c, draw(lines) {
      const g = c.getContext("2d"), gr = g.createRadialGradient(118, 100, 20, 128, 128, 140);
      gr.addColorStop(0, "#D3DFBB"); gr.addColorStop(1, "#9DAE88"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.fillStyle = "#1A2216"; g.textBaseline = "middle"; g.textAlign = "center";
      g.font = "bold 30px Arial"; g.fillText(tag, 128, 64);
      const v = String(lines[0]), u = lines[1] || "";
      let fs = 66; g.font = `bold ${fs}px Arial`; let wv = g.measureText(v).width; if (wv > 150) { fs = Math.floor(fs * 150 / wv); g.font = `bold ${fs}px Arial`; wv = g.measureText(v).width; }
      g.font = "bold 24px Arial"; const wu = g.measureText(u).width, x0 = 128 - (wv + 6 + wu) / 2;
      g.textAlign = "left"; g.font = `bold ${fs}px Arial`; g.fillText(v, x0, 128); g.font = "bold 24px Arial"; g.fillText(u, x0 + wv + 6, 140);
      const n = parseFloat(v.replace(",", ".")); g.textAlign = "center"; g.font = "bold 30px Arial";
      g.fillText(isFinite(n) && span ? (n / span * 100).toFixed(1).replace(".", ",") + " %" : "-- %", 128, 192);
      t.needsUpdate = true;
    } };
  }
  // carcaça de transmissor no estilo Smar: corpo de alumínio, tampas azuis rosqueadas com nervuras, visor e marca
  function smarHousing(g, c, r, len, scr) {
    const alu = mat(0xB4BBC4, 0.65, 0.32), blue = mat(0x4E6BB5, 0.35, 0.42), blueD = mat(0x3D5698, 0.4, 0.45);
    g.add(at(mesh(cylZ(r, len, 40), alu), c));
    for (const sg of [1, -1]) {
      const z = c.z + sg * (len / 2 + 0.011);
      g.add(at(mesh(cylZ(r * 1.08, 0.022, 40), blue), v3(c.x, c.y, z)));
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; g.add(at(mesh(new T.BoxGeometry(0.004, 0.004, 0.02), blueD), v3(c.x + Math.cos(a) * r * 1.085, c.y + Math.sin(a) * r * 1.085, z))); }
      g.add(at(mesh(new T.TorusGeometry(r * 0.9, r * 0.07, 10, 40), blue), v3(c.x, c.y, z + sg * 0.011)));
    }
    const zf = c.z + len / 2 + 0.0225;
    if (scr) g.add(at(mesh(new T.CircleGeometry(r * 0.7, 40), new T.MeshBasicMaterial({ map: scr.tex })), v3(c.x, c.y, zf)));
    g.add(at(mesh(new T.CircleGeometry(r * 0.84, 40), new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0, clearcoat: 1, depthWrite: false })), v3(c.x, c.y, zf + 0.001)));
    g.add(at(mesh(new T.PlaneGeometry(r * 0.62, r * 0.17), new T.MeshBasicMaterial({ map: canvasTex(128, 36, (cc) => { cc.clearRect(0, 0, 128, 36); cc.fillStyle = "#D5DDF2"; cc.font = "bold 30px Arial"; cc.textAlign = "center"; cc.fillText("smar", 64, 28); }), transparent: true, depthWrite: false }), false, false), v3(c.x, c.y + r * 0.97, zf + 0.0125)));
    // entradas elétricas laterais (a do lado −x fica tampada com bujão)
    for (const sx of [1, -1]) g.add(at(mesh(cylX(r * 0.3, 0.024, 16), alu), v3(c.x + sx * (r + 0.004), c.y, c.z - len * 0.3)));
    g.add(at(mesh(cylX(r * 0.24, 0.01, 6), M.dark), v3(c.x - r - 0.018, c.y, c.z - len * 0.3)));
  }
  function gland(parent, p, dir, r = 0.009) {
    const g = new T.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); g.userData.gland = true; parent.add(g);
    g.add(at(mesh(new T.CylinderGeometry(r * 1.4, r * 1.4, 0.012, 6), M.gland), v3(0, 0.006, 0)));
    g.add(at(mesh(new T.CylinderGeometry(r, r * 1.2, 0.018, 16), M.gland), v3(0, 0.021, 0)));
    g.add(at(mesh(new T.CylinderGeometry(r * 0.6, r * 0.6, 0.03, 10), M.cable), v3(0, 0.042, 0)));
    return g;
  }

  function g_spiral(parent, m) {
    const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 1.6 - Math.PI * 0.3, rr = 0.112 + 0.02 * i / 24; pts.push(v3(-0.04, 0.17 + Math.sin(a) * rr, Math.cos(a) * rr)); }
    parent.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.022, 12, false), m));
  }
  // registro de esfera (válvula esfera inox 304) com uniões de PPR verde e alavanca amarela que gira 90 graus: alinhada ao tubo = aberto, de través = fechado. Clicável.
  function ballValve(parent, p, dir, r) {
    const g = new T.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(v3(1, 0, 0), dir.clone().normalize()); parent.add(g);
    const ss = mat(0xC4CAD0, 0.85, 0.3), ssD = mat(0xA3AAB1, 0.8, 0.38), ppr = mat(0x2E8B3E, 0.1, 0.55), yel = mat(0xF2C81B, 0.08, 0.45), blue = mat(0x2F6FD0, 0.2, 0.4);
    g.add(mesh(cylX(r * 1.3, r * 3.4, 24), ss));
    g.add(at(mesh(new T.SphereGeometry(r * 1.5, 24, 16), ss), v3(0, 0, 0), v3(1.1, 1, 1)));
    for (const sx of [-1, 1]) {
      g.add(at(mesh(cylX(r * 1.35, r * 1.4, 6), ssD), v3(sx * r * 2.2, 0, 0)));
      g.add(at(mesh(cylX(r * 1.2, r * 0.28, 24), mat(0xF4F4F4, 0.05, 0.5)), v3(sx * r * 2.95, 0, 0)));
      g.add(at(mesh(cylX(r * 1.7, r * 2.4, 6), ppr), v3(sx * r * 4.0, 0, 0)));
    }
    g.add(at(mesh(new T.CylinderGeometry(r * 0.85, r * 1.05, r * 1.4, 18), ss), v3(0, r * 1.75, 0)));
    g.add(at(mesh(new T.CylinderGeometry(r * 0.58, r * 0.58, r * 0.45, 6), ssD), v3(0, r * 2.6, 0)));
    g.add(at(mesh(new T.BoxGeometry(r * 1.2, r * 0.13, r * 0.45), ss), v3(r * 0.8, r * 2.42, 0)));
    const lv = new T.Group(); lv.position.set(0, r * 2.85, 0); g.add(lv);
    lv.add(at(mesh(new T.BoxGeometry(r * 1.4, r * 0.15, r * 0.9), ss), v3(-r * 0.55, 0, 0)));
    const step = mesh(new T.BoxGeometry(r * 1.0, r * 0.15, r * 0.9), ss); step.rotation.z = -0.5; step.position.set(-r * 1.4, r * 0.2, 0); lv.add(step);
    lv.add(at(mesh(new T.BoxGeometry(r * 1.4, r * 0.15, r * 0.9), ss), v3(-r * 2.1, r * 0.4, 0)));
    // empunhadura plástica amarela: perfil arredondado extrudado (topo plano, bordas chanfradas)
    const GL = r * 5.3, GW = r * 0.95, rr = GW / 2 * 0.95, sh = new T.Shape();   // empunhadura longa e fina
    sh.moveTo(-GL / 2 + rr, -GW / 2); sh.lineTo(GL / 2 - rr, -GW / 2); sh.quadraticCurveTo(GL / 2, -GW / 2, GL / 2, -GW / 2 + rr); sh.lineTo(GL / 2, GW / 2 - rr); sh.quadraticCurveTo(GL / 2, GW / 2, GL / 2 - rr, GW / 2);
    sh.lineTo(-GL / 2 + rr, GW / 2); sh.quadraticCurveTo(-GL / 2, GW / 2, -GL / 2, GW / 2 - rr); sh.lineTo(-GL / 2, -GW / 2 + rr); sh.quadraticCurveTo(-GL / 2, -GW / 2, -GL / 2 + rr, -GW / 2);
    const gg = new T.ExtrudeGeometry(sh, { depth: r * 0.3, bevelEnabled: true, bevelThickness: r * 0.1, bevelSize: r * 0.1, bevelSegments: 3, curveSegments: 8 }); gg.rotateX(-Math.PI / 2);
    const grip = mesh(gg, yel); grip.position.set(-r * 4.65, r * 0.12, 0); lv.add(grip);
    const topY = r * 0.12 + r * 0.3 + r * 0.1;                                                          // topo plano da empunhadura
    const lt = canvasTex(256, 96, c => { c.fillStyle = "#F2C81B"; c.fillRect(0, 0, 256, 96); c.fillStyle = "#1A1A1A"; c.font = "bold 30px Arial"; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("OFF", 130, 26); c.fillText("ON", 142, 66); c.font = "bold 56px Arial"; c.fillText("\u21BA", 56, 50); });
    const pl = mesh(new T.PlaneGeometry(r * 1.9, r * 0.62), new T.MeshStandardMaterial({ map: lt, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); pl.rotation.x = -Math.PI / 2; pl.rotation.z = Math.PI; pl.position.set(-r * 5.2, topY + 0.0006, 0); lv.add(pl);
    lv.add(at(mesh(new T.CylinderGeometry(r * 0.46, r * 0.46, r * 0.35, 6), ssD), v3(0, r * 0.3, 0)));
    lv.add(at(mesh(new T.TorusGeometry(r * 0.28, r * 0.08, 8, 18).rotateX(Math.PI / 2), blue), v3(0, r * 0.52, 0)));
    lv.add(at(mesh(new T.CylinderGeometry(r * 0.23, r * 0.23, r * 0.28, 10), ssD), v3(0, r * 0.62, 0)));
    g.scale.setScalar(0.72);
    return { g, lv };
  }
  function handValve(parent, p, dir, r) {
    const { g, lv } = ballValve(parent, p, dir, r);
    S.valves = S.valves || [];
    const vv = { g, lv, open: true, tag: "REG-" + (S.valves.length + 1) }; S.valves.push(vv);
    S.clickables = S.clickables || []; S.clickables.push({ obj: g, tag: vv.tag, fn: () => toggleValve(vv) });
    return g;
  }
  function replacePump() {
    if (!S.pumpBurnt) { tip("A bomba está <b>boa</b>: não precisa substituir.", ""); return; }
    const PL = PLCo(), cmd = !S.ui.emerg && (PL && PL.run ? !!PL.io.Y[0] : !!(S.lvl && S.lvl.pump));
    if (cmd) { tip("Antes de trocar, <b>desligue a bomba</b> (DESLIGA ou emergência).", "bad"); return; }
    S.pumpBurnt = false; S.pumpT = 25; S.pumpSmokeT = 0; S.thermalTrip = false;
    tip("<b>Bomba nova instalada.</b> Confira se os <b>registros estão abertos</b> antes de ligar de novo; se houver falha no inversor, resete-a.", "ok");
  }
  const VALVE_WHERE = ["sucção da bomba", "recalque da bomba", "linha de recalque (descida)", "entrada do tanque"];
  function toggleValve(v) {
    v.open = !v.open; const i = S.valves.indexOf(v), where = VALVE_WHERE[i] || "linha";
    if (!v.open) tip("<b>" + v.tag + "</b> (" + where + ") <b>fechado</b>: a água não passa. Se a bomba estiver ligada, ela trabalha <b>sem vazão</b> e <b>sobreaquece</b>: o inversor vai acusar falha.", "bad");
    else tip("<b>" + v.tag + "</b> (" + where + ") <b>aberto</b>: a água volta a circular e a bomba esfria.", "ok");
  }

  /* ---------- sala (laboratório de eletromecânica) ---------- */
  /* ---------- tela do computador do fundo: logo EducaWEB animado (protetor de tela) ---------- */
  function drawPcScreen(t) {
    const p = S.pcScreen; if (!p) return;
    const c = p.c.getContext("2d"), w = p.c.width, h = p.c.height;
    const bg = c.createRadialGradient(w / 2, h * 0.44, 10, w / 2, h / 2, w * 0.75); bg.addColorStop(0, "#1B3A5C"); bg.addColorStop(1, "#08121C"); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2), R = 50;
    c.save(); c.translate(w / 2, h * 0.43);
    const gl = c.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 1.9); gl.addColorStop(0, "rgba(238,122,16," + (0.16 + 0.2 * pulse).toFixed(3) + ")"); gl.addColorStop(1, "rgba(238,122,16,0)"); c.fillStyle = gl; c.beginPath(); c.arc(0, 0, R * 1.9, 0, 7); c.fill();
    for (let k = 0; k < 3; k++) { const a0 = t * (0.9 - 0.3 * k) + k * 2; c.strokeStyle = "rgba(238,122,16," + (0.3 + 0.2 * k) + ")"; c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, R + 16 + k * 13, a0, a0 + Math.PI * (0.7 + 0.25 * k)); c.stroke(); }
    for (let i = 0; i < 10; i++) { const a = t * 1.1 + i * Math.PI / 5, r = R + 58 + 6 * Math.sin(t * 2 + i); c.fillStyle = "rgba(245,246,248," + (0.45 + 0.4 * Math.sin(t * 3 + i)).toFixed(3) + ")"; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r * 0.72, 1.8 + (i % 3) * 0.5, 0, 7); c.fill(); }
    c.save(); const sc = R * 2 / 56; c.scale(sc, sc); c.translate(-32, -32);      // logo (viewBox 64): hexágono névoa, L laranja atrás do E tinta
    c.fillStyle = "#F5F6F8"; c.strokeStyle = "#F5F6F8"; c.lineWidth = 5; c.lineJoin = "round"; c.beginPath(); c.moveTo(32, 4); c.lineTo(56, 18); c.lineTo(56, 46); c.lineTo(32, 60); c.lineTo(8, 46); c.lineTo(8, 18); c.closePath(); c.fill(); c.stroke();
    c.save(); c.translate(14, 14); c.scale(0.75, 0.75);
    c.fillStyle = "#EE7A10"; c.fillRect(6, 9, 7, 37); c.fillRect(6, 39, 30, 7);
    const E = [[16, 3, 7, 32], [16, 3, 26, 7], [16, 15.5, 20, 7], [16, 28, 26, 7]];
    c.fillStyle = "#F5F6F8"; for (const [x, y, ww, hh] of E) c.fillRect(x - 1.8, y - 1.8, ww + 3.6, hh + 3.6);
    c.fillStyle = "#0F2236"; for (const [x, y, ww, hh] of E) c.fillRect(x, y, ww, hh);
    c.restore(); c.restore(); c.restore();
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = "800 30px 'Bricolage Grotesque', Arial, sans-serif";
    const tw1 = c.measureText("Educa").width, tw2 = c.measureText("WEB").width, x0 = w / 2 - (tw1 + tw2) / 2;
    c.textAlign = "left"; c.fillStyle = "#F5F6F8"; c.fillText("Educa", x0, h * 0.83); c.fillStyle = "#EE7A10"; c.fillText("WEB", x0 + tw1, h * 0.83);
    const bx0 = w * 0.3, bw = w * 0.4, ph = (t * 0.5) % 1.4 - 0.2;       // barra de progresso que corre
    c.fillStyle = "rgba(245,246,248,0.14)"; c.fillRect(bx0, h * 0.93, bw, 3);
    const gx = bx0 + bw * Math.max(0, ph - 0.2), ge = bx0 + bw * Math.min(1, ph + 0.2); if (ge > gx) { c.fillStyle = "#EE7A10"; c.fillRect(gx, h * 0.93, ge - gx, 3); }
    p.t.needsUpdate = true;
  }
  /* ---------- bancada didática real (fundo do cenário): perfil de alumínio, painéis, medidores, inversor, soft-starter, monitor ---------- */
  function buildRealBench(scene, cx, cz) {
    const g = new T.Group(); g.position.set(cx, 0, cz); scene.add(g);
    const alu = mat(0xD6DADE, 0.5, 0.4), blk = mat(0x1A1C20, 0.2, 0.6), wht = mat(0xF2F3F4, 0.05, 0.5), desk = mat(0x25282D, 0.1, 0.55), gry = mat(0xA7ABB0, 0.05, 0.85);
    const box = (w, h, d, m, x, y, z, p = g) => { const o = mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
    const cyz = (r, l, m, x, y, z, p = g, seg = 16) => { const o = mesh(cylZ(r, l, seg), m); o.position.set(x, y, z); p.add(o); return o; };
    const decal = (tex, rough = 0.6) => new T.MeshStandardMaterial({ map: tex, roughness: rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const plane = (w, h, tex, x, y, z, rough = 0.6) => { const o = mesh(new T.PlaneGeometry(w, h), decal(tex, rough), false); o.position.set(x, y, z); g.add(o); return o; };
    const stripe = (w, h, d, x, y, z, p = g) => box(w, h, d, blk, x, y, z, p);
    // ---- estrutura: perfis verticais e travessas com faixa preta
    for (const x of [-0.8, 0.8]) {
      box(0.05, 1.24, 0.05, alu, x, 1.52, -0.2); stripe(0.012, 1.24, 0.004, x, 1.52, -0.173);   // os módulos ficam encaixados na face da frente desta estrutura rasa
      for (const z of [-0.33, 0.33]) box(0.05, 0.82, 0.05, alu, x, 0.49, z);
      for (const z of [-0.33, 0.33]) { const w = mesh(cylX(0.04, 0.03, 16), blk); w.position.set(x, 0.04, z); g.add(w); }
      box(0.04, 0.05, 0.7, alu, x, 0.84, 0);
    }
    box(1.6, 0.05, 0.04, alu, 0, 0.84, 0.33); stripe(1.6, 0.012, 0.004, 0, 0.84, 0.352);
    // ---- tampo preto com borda de alumínio
    box(1.66, 0.04, 0.78, desk, 0, 0.9, 0); box(1.66, 0.07, 0.025, alu, 0, 0.868, 0.39); stripe(1.66, 0.012, 0.004, 0, 0.868, 0.404);
    box(0.025, 0.07, 0.78, alu, -0.83, 0.868, 0); box(0.025, 0.07, 0.78, alu, 0.83, 0.868, 0);
    // ---- compartimento inferior: fundo escuro, prateleira, vitrine de acrílico com motor azul e servomotor
    box(1.56, 0.78, 0.015, blk, 0, 0.5, -0.33); box(1.56, 0.02, 0.62, desk, 0, 0.13, 0);
    box(0.02, 0.72, 0.62, blk, 0.285, 0.5, 0);
    const acr = mesh(new T.BoxGeometry(0.76, 0.62, 0.01), new T.MeshPhysicalMaterial({ color: 0xE6F0F8, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false }), false, false); acr.position.set(-0.115, 0.47, 0.31); g.add(acr);
    for (const [w, h, x, y] of [[0.78, 0.025, -0.115, 0.785], [0.78, 0.025, -0.115, 0.155], [0.025, 0.65, -0.505, 0.47], [0.025, 0.65, 0.275, 0.47]]) box(w, h, 0.03, alu, x, y, 0.31);
    box(0.25, 0.02, 0.04, blk, -0.115, 0.2, 0.33);
    box(0.42, 0.035, 0.34, wht, -0.12, 0.17, -0.02);
    { const m = mesh(cylX(0.075, 0.26, 24), mat(0x2F5FA0, 0.4, 0.4)); m.position.set(-0.24, 0.265, -0.02); g.add(m); box(0.05, 0.05, 0.1, blk, -0.24, 0.35, -0.02); }
    box(0.2, 0.28, 0.2, wht, 0.04, 0.33, -0.05); box(0.12, 0.06, 0.12, mat(0xC4A64A, 0.4, 0.5), 0.04, 0.5, -0.05);
    cyz(0.11, 0.22, blk, 0.55, 0.43, -0.12, g, 28); cyz(0.065, 0.02, mat(0x8A9097, 0.6, 0.4), 0.55, 0.43, 0.0, g, 24); cyz(0.014, 0.05, alu, 0.55, 0.43, 0.02, g, 12);
    const A0 = g.children.length;
    // ---- faixa de comando (liga/desliga, disjuntores, emergência, lâmpadas, tomadas, bornes)
    const px = x => (x + 0.78) * 1024 / 1.56;
    const stripTex = canvasTex(1024, 190, (c, w, h) => {
      c.fillStyle = "#F4F5F6"; c.fillRect(0, 0, w, h);
      const lab = (x, t, y, ww) => { c.fillStyle = "#15181C"; c.fillRect(px(x) - ww / 2, y - 12, ww, 24); c.fillStyle = "#fff"; c.font = "bold 11px Arial"; c.textAlign = "center"; c.fillText(t, px(x), y + 4); };
      lab(-0.62, "LIGA/DESLIGA", 172, 80); lab(-0.45, "DISJUNTOR TRIPOLAR", 172, 110); lab(-0.07, "24Vcc", 168, 44); lab(0.1, "DISJUNTOR BIPOLAR E DR", 172, 130); lab(0.39, "TOMADA 2P+T/220Vca", 172, 150); lab(0.74, "RJ45", 172, 44);
      c.fillStyle = "#0F2236"; c.font = "bold 10px Arial"; c.fillText("220Vca", px(-0.17), 125); c.fillText("10Vcc", px(-0.04), 125);
      c.fillStyle = "#15181C"; c.fillRect(px(0.51), 50, px(0.7) - px(0.51), 92); c.fillStyle = "#fff"; c.font = "bold 10px Arial";
      for (const [x, t] of [[0.525, "R"], [0.55, "S"], [0.575, "T"], [0.6, "N"], [0.625, "PE"], [0.655, "+24"], [0.685, "+10"]]) c.fillText(t, px(x), 96);
    });
    box(1.56, 0.285, 0.02, wht, 0, 1.06, -0.32); plane(1.56, 0.285, stripTex, 0, 1.06, -0.304);
    box(0.085, 0.085, 0.02, mat(0xE8C21C, 0.2, 0.5), -0.62, 1.07, -0.3); cyz(0.026, 0.03, mat(0xCC1F1A, 0.3, 0.45), -0.62, 1.07, -0.285, g, 20); box(0.05, 0.012, 0.012, mat(0xCC1F1A, 0.3, 0.45), -0.62, 1.07, -0.267);
    box(0.05, 0.08, 0.04, wht, -0.46, 1.08, -0.295); box(0.05, 0.08, 0.04, mat(0x2F5FA0, 0.2, 0.5), -0.44, 1.08, -0.297); box(0.14, 0.012, 0.045, wht, -0.45, 1.125, -0.296);
    cyz(0.034, 0.012, mat(0xE8C21C, 0.3, 0.5), -0.3, 1.07, -0.298, g, 24); cyz(0.027, 0.02, mat(0xCC1F1A, 0.3, 0.45), -0.3, 1.07, -0.29, g, 20);
    for (const [x, y, col, em] of [[-0.17, 1.09, 0x2EBE4E, 0x0E5A1E], [-0.04, 1.09, 0xEE9A1E, 0x7A4A08], [-0.1, 1.0, 0xE8EDF2, 0x555B62]]) cyz(0.017, 0.018, new T.MeshStandardMaterial({ color: col, emissive: em, emissiveIntensity: 0.5, roughness: 0.4 }), x, y, -0.298, g, 20);
    box(0.13, 0.075, 0.04, wht, 0.1, 1.06, -0.297); box(0.012, 0.03, 0.012, blk, 0.145, 1.07, -0.272);
    for (const x of [0.33, 0.45]) { cyz(0.03, 0.02, mat(0xD6342A, 0.2, 0.5), x, 1.06, -0.298, g, 24); cyz(0.018, 0.012, mat(0xA82219, 0.2, 0.5), x, 1.06, -0.287, g, 20); }
    box(0.19, 0.095, 0.014, blk, 0.605, 1.09, -0.304);
    { const cols = [0xEDEDED, 0xEDEDED, 0xEDEDED, 0x2B67C7, 0x2EA84F, 0xCC1F1A, 0xCC1F1A, 0x15181C, 0x2EA84F], jg = cylZ(0.0075, 0.012, 10);
      for (const y of [1.12, 1.06]) cols.forEach((cc, i) => { const o = mesh(jg, mat(cc, 0.2, 0.5)); o.position.set(0.53 + i * 0.0225, y, -0.297); g.add(o); }); }
    box(0.04, 0.04, 0.015, blk, 0.745, 1.075, -0.298);
    const A1 = g.children.length;
    // ---- travessas
    for (const y of [1.215, 1.532, 1.74]) { box(1.6, 0.035, 0.14, alu, 0, y, -0.245); stripe(1.6, 0.01, 0.004, 0, y, -0.174); }
    box(1.56, 0.5, 0.012, gry, 0, 1.88, -0.3); box(1.56, 0.3, 0.012, gry, 0, 1.38, -0.325);
    // ---- desenhos esquemáticos (placas pretas com símbolos)
    const schem = (c, x, y, w, h, mot) => {
      c.fillStyle = "#101216"; c.fillRect(x, y, w, h); c.strokeStyle = "#E8EAEC"; c.lineWidth = 1.2; c.fillStyle = "#E8EAEC";
      for (let i = 0; i < 3; i++) { const xx = x + w * (0.2 + i * 0.2); c.beginPath(); c.moveTo(xx, y + h * 0.08); c.lineTo(xx, y + h * 0.45); c.stroke(); c.beginPath(); c.moveTo(xx - 5, y + h * 0.22); c.lineTo(xx + 5, y + h * 0.3); c.stroke(); }
      c.beginPath(); c.moveTo(x + w * 0.82, y + h * 0.1); c.lineTo(x + w * 0.82, y + h * 0.7); c.stroke(); c.strokeRect(x + w * 0.72, y + h * 0.35, 12, 18);
      if (mot) { c.beginPath(); c.arc(x + w * 0.36, y + h * 0.78, Math.min(w, h) * 0.13, 0, 7); c.stroke(); c.font = "bold 10px Arial"; c.textAlign = "center"; c.fillText("M", x + w * 0.36, y + h * 0.8); }
    };
    const B0 = g.children.length;
    // ---- linha 2: três painéis (inversor CFW500, contatores, soft-starter SSW07)
    const rowTex = canvasTex(1024, 290, (c, w, h) => {
      c.fillStyle = "#F3F4F5"; c.fillRect(0, 0, w, h); c.strokeStyle = "#C5CACF"; c.lineWidth = 3; for (const x of [341, 683]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      schem(c, 140, 28, 130, 190, true); schem(c, 430, 118, 200, 160, true); schem(c, 760, 100, 70, 80, false);
      c.fillStyle = "#15181C"; c.font = "bold 9px Arial"; c.textAlign = "center"; c.fillText("DESLIGA/LIGA", 322, 188); c.fillText("DESLIGA/LIGA", 640, 105);
      for (let i = 0; i < 26; i++) { c.strokeStyle = i % 2 ? "#C9302C" : "#E7E7E7"; c.lineWidth = 2; c.beginPath(); c.moveTo(440 + i * 7, 14); c.quadraticCurveTo(445 + i * 7, 45, 438 + i * 7 + (i % 3) * 3, 78); c.stroke(); }
    });
    box(1.56, 0.3, 0.012, wht, 0, 1.375, -0.322); plane(1.56, 0.3, rowTex, 0, 1.375, -0.309);
    const contactor = (x, y, w) => { box(w, 0.075, 0.045, mat(0xE4E7EA, 0.1, 0.5), x, y, -0.29); box(w * 0.96, 0.02, 0.048, mat(0x3A3F46, 0.2, 0.5), x, y + 0.02, -0.288); box(w * 0.5, 0.012, 0.05, mat(0xCC2A24, 0.2, 0.5), x, y - 0.02, -0.286); };
    const breaker = (x, y) => { box(0.04, 0.075, 0.045, mat(0xEFE9DF, 0.1, 0.5), x, y, -0.29); box(0.02, 0.025, 0.05, mat(0xB32823, 0.2, 0.5), x, y + 0.01, -0.286); };
    breaker(-0.64, 1.38); contactor(-0.585, 1.38, 0.05); contactor(-0.585, 1.46, 0.05);
    breaker(-0.14, 1.46); for (const x of [-0.1, -0.04, 0.02]) contactor(x, 1.46, 0.05); breaker(-0.14, 1.36);
    breaker(0.31, 1.46); contactor(0.36, 1.46, 0.05); breaker(0.31, 1.38);
    box(0.085, 0.175, 0.07, mat(0xC7D2E0, 0.3, 0.45), -0.745, 1.4, -0.26); box(0.06, 0.04, 0.012, mat(0x1C2230, 0.3, 0.4), -0.745, 1.45, -0.222); box(0.06, 0.04, 0.012, mat(0xE5EAF0, 0.2, 0.5), -0.745, 1.4, -0.222);
    box(0.08, 0.18, 0.065, mat(0x4A74C9, 0.3, 0.45), 0.4, 1.31, -0.26); box(0.06, 0.07, 0.01, mat(0xDCE6F5, 0.2, 0.5), 0.4, 1.3, -0.226); box(0.07, 0.03, 0.01, mat(0x2B2F36, 0.3, 0.5), 0.4, 1.36, -0.226);
    { const jg = cylZ(0.0065, 0.012, 10);
      for (const [row, y] of [[0, 1.265], [1, 1.24]]) for (let i = 0; i < 11; i++) { const col = row ? (i % 3 === 0 ? 0xE8C21C : 0x2B67C7) : (i === 6 ? 0xCC1F1A : i === 10 ? 0x15181C : 0x2B67C7); const o = mesh(jg, mat(col, 0.2, 0.5)); o.position.set(-0.64 + i * 0.027, y, -0.298); g.add(o); } }
    cyz(0.024, 0.018, mat(0xCC1F1A, 0.3, 0.45), -0.31, 1.47, -0.295, g, 20); cyz(0.015, 0.03, blk, -0.31, 1.385, -0.292, g, 16); box(0.004, 0.025, 0.004, wht, -0.31, 1.385, -0.274);
    cyz(0.015, 0.03, blk, 0.2, 1.42, -0.292, g, 16);
    const B1 = g.children.length;
    for (let i = A0; i < A1; i++) g.children[i].position.z += 0.12;     // faixa de comando e linha 2: coladas na face da frente
    for (let i = B0; i < B1; i++) g.children[i].position.z += 0.12;
    // ---- linha 3: três caixas brancas com contator, painel esquemático e seletor
    const boxTex = canvasTex(512, 180, (c, w, h) => { c.fillStyle = "#F4F5F6"; c.fillRect(0, 0, w, h); schem(c, 240, 18, 150, 140, true); c.fillStyle = "#15181C"; c.font = "bold 9px Arial"; c.textAlign = "center"; c.fillText("DESLIGA / LIGA", 440, 115); });
    for (const [x, w] of [[-0.536, 0.4], [0.04, 0.37], [0.44, 0.37]]) {
      box(w, 0.175, 0.12, wht, x, 1.63, -0.24); const t = mesh(new T.PlaneGeometry(w, 0.175), decal(boxTex)); t.position.set(x, 1.63, -0.174); g.add(t);
      box(0.05, 0.08, 0.04, mat(0xE4E7EA, 0.1, 0.5), x - w * 0.36, 1.63, -0.157); box(0.04, 0.08, 0.04, mat(0xEFE9DF, 0.1, 0.5), x - w * 0.36 - 0.05, 1.63, -0.157);
      cyz(0.014, 0.03, blk, x + w * 0.38, 1.67, -0.16, g, 16);
    }
    // ---- linha 4: medidores (mA, A, V)
    const dial = (label, max, ticks) => canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = "#F4F5F6"; c.fillRect(0, 0, w, h); c.fillStyle = "#17191D"; c.fillRect(40, 20, 176, 150); c.fillStyle = "#F7F7F7"; c.fillRect(46, 26, 164, 138);
      c.strokeStyle = "#222"; c.lineWidth = 1.5; c.fillStyle = "#222"; c.font = "bold 9px Arial"; c.textAlign = "center";
      for (let i = 0; i <= ticks; i++) { const a = Math.PI * (1.2 + 0.6 * i / ticks), r0 = 78, r1 = i % 2 ? 84 : 90; c.beginPath(); c.moveTo(128 + Math.cos(a) * r0, 150 + Math.sin(a) * r0); c.lineTo(128 + Math.cos(a) * r1, 150 + Math.sin(a) * r1); c.stroke(); if (i % 2 === 0) c.fillText(String(Math.round(max * i / ticks)), 128 + Math.cos(a) * 70, 150 + Math.sin(a) * 70 + 3); }
      c.font = "bold 22px Arial"; c.fillText(label, 100, 80); c.lineWidth = 2.5; c.beginPath(); c.moveTo(118, 152); c.lineTo(78, 112); c.stroke();
      c.fillStyle = "#101216"; c.beginPath(); c.arc(188, 148, 12, 0, 7); c.fill();
      c.fillStyle = "#15181C"; c.fillRect(88, 196, 80, 24); c.fillStyle = "#fff"; c.font = "bold 14px Arial"; c.fillText(label, 128, 214);
      c.fillStyle = "#B8232A"; c.beginPath(); c.arc(50, 208, 11, 0, 7); c.fill(); c.beginPath(); c.arc(206, 208, 11, 0, 7); c.fill();
    });
    [[-0.29, "mA", 500, 10], [-0.06, "A", 6, 6], [0.2, "V", 250, 10]].forEach(([x, l, mx, tk]) => { box(0.225, 0.25, 0.12, wht, x, 1.88, -0.24); const t = mesh(new T.PlaneGeometry(0.225, 0.25), decal(dial(l, mx, tk), 0.5)); t.position.set(x, 1.88, -0.174); g.add(t); });
    // ---- cobertura (aba de alumínio com faixa preta e luminária)
    box(1.74, 0.045, 0.5, alu, 0, 2.15, -0.1); stripe(1.74, 0.012, 0.004, 0, 2.15, 0.152); box(1.7, 0.012, 0.44, wht, 0, 2.123, -0.1);
    box(1.4, 0.01, 0.12, new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 }), 0, 2.115, -0.02);
    for (const x of [-0.87, 0.87]) box(0.06, 0.06, 0.06, blk, x, 2.15, 0.155);
    // ---- computador all-in-one (ital) em braço articulado de mesa; teclado e mouse sem fio
    const dkg = mat(0x2A2D32, 0.4, 0.45), body = mat(0x14161A, 0.3, 0.45);
    const pcC = document.createElement("canvas"); pcC.width = 384; pcC.height = 216; const scr = new T.CanvasTexture(pcC); scr.colorSpace = T.SRGBColorSpace; scr.anisotropy = 4; S.pcScreen = { c: pcC, t: scr }; drawPcScreen(0);
    const lbl = canvasTex(128, 32, (c, w, h) => { c.fillStyle = "#14161A"; c.fillRect(0, 0, w, h); c.fillStyle = "#C9CDD2"; c.font = "bold 20px Arial"; c.textAlign = "center"; c.fillText("ital", 64, 23); });
    const mon = new T.Group(); mon.position.set(0.3, 1.4, 0.0); g.add(mon);
    box(0.6, 0.35, 0.016, body, 0, 0.012, 0, mon);                                              // painel fino
    box(0.6, 0.038, 0.02, body, 0, -0.177, 0.0, mon);                                          // queixo
    box(0.5, 0.25, 0.028, body, 0, 0.0, -0.022, mon);                                          // corpo do computador atrás da tela
    { const sc = mesh(new T.PlaneGeometry(0.578, 0.32), new T.MeshStandardMaterial({ map: scr, roughness: 0.2, metalness: 0, emissive: 0xffffff, emissiveMap: scr, emissiveIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); sc.position.set(0, 0.016, 0.0085); mon.add(sc); }
    { const lb = mesh(new T.PlaneGeometry(0.05, 0.0125), decal(lbl)); lb.position.set(0, -0.177, 0.0105); mon.add(lb); }
    cyz(0.003, 0.002, mat(0x2A3140, 0.2, 0.4), 0, 0.18, 0.009, mon, 10);                      // webcam
    box(0.1, 0.1, 0.008, dkg, 0, 0.0, -0.04, mon);                                              // placa VESA
    // braço articulado: base com grampo, coluna, dois segmentos e cabeçote
    box(0.1, 0.012, 0.1, dkg, 0.68, 0.926, -0.1); box(0.05, 0.02, 0.05, dkg, 0.68, 0.91, -0.1);
    const jt = (p, r) => { const o = mesh(new T.SphereGeometry(r, 14, 10), dkg); o.position.copy(p); g.add(o); };
    const P0 = v3(0.68, 0.93, -0.1), P1 = v3(0.68, 1.2, -0.1), P2 = v3(0.5, 1.26, -0.06), P3 = v3(0.31, 1.38, -0.045);
    pipe(P0, P1, 0.017, dkg, g); jt(P1, 0.024); pipe(P1, P2, 0.014, dkg, g); jt(P2, 0.021); pipe(P2, P3, 0.013, dkg, g); jt(P3, 0.019);
    { const cv = new T.CatmullRomCurve3([v3(0.3, 1.24, -0.05), v3(0.42, 1.12, -0.06), v3(0.62, 0.99, -0.1), v3(0.68, 0.93, -0.2), v3(0.68, 0.925, -0.32)]); g.add(mesh(new T.TubeGeometry(cv, 24, 0.004, 6, false), blk)); }   // único cabo de energia
    // teclado compacto e mouse sem fio (sem cabos)
    const kb = canvasTex(256, 96, (c, w, h) => { c.fillStyle = "#101216"; c.fillRect(0, 0, w, h); c.fillStyle = "#2A2D33"; for (let r = 0; r < 5; r++) for (let k = 0; k < 17; k++) c.fillRect(6 + k * 14.5, 8 + r * 16, 12, 13); c.fillRect(175, 8, 70, 80); });
    { const k = mesh(new T.BoxGeometry(0.43, 0.012, 0.135), mat(0x15171B, 0.2, 0.6)); k.position.set(0.22, 0.926, 0.16); k.rotation.x = -0.05; g.add(k);
      const kt = mesh(new T.PlaneGeometry(0.42, 0.125), decal(kb)); kt.rotation.x = -Math.PI / 2 - 0.05; kt.position.set(0.22, 0.9335, 0.16); g.add(kt); }
    { const m = mesh(new T.SphereGeometry(0.03, 20, 12), mat(0x14161A, 0.3, 0.45)); m.scale.set(0.85, 0.5, 1.45); m.position.set(0.55, 0.93, 0.17); g.add(m); box(0.004, 0.004, 0.018, mat(0x3A3F46, 0.3, 0.5), 0.55, 0.947, 0.155); }
    return g;
  }

  function buildRoom(scene) {
    const RX = 5, RZ0 = -4, RZ1 = 5, RH = 3.2;
    // Piso granitina leve: mantém a referência visual de chão com textura procedural de baixa resolução.
    const floorTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = "#CFCAC2"; g.fillRect(0, 0, w, h);
      const cols = ["#8E8A84", "#6F6B66", "#A9A39A", "#E8E4DC", "#B8B0A3", "#5E5A55", "#D9D3C8"];
      for (let k = 0; k < 5200; k++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; const sz = Math.random() < 0.85 ? 1 + Math.random() * 2 : 2 + Math.random() * 4; g.globalAlpha = 0.3 + Math.random() * 0.5; g.fillRect(Math.random() * w, Math.random() * h, sz, sz * (0.6 + Math.random() * 0.8)); }
      g.globalAlpha = 1; g.strokeStyle = "#9C968D"; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    }, [10, 9]);
    const floor = mesh(new T.PlaneGeometry(RX * 2, RZ1 - RZ0), mat(0xffffff, 0, 0.8, { map: floorTex }), false, false);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (RZ0 + RZ1) / 2); scene.add(floor);
    // paredes brancas
    const wall = mat(0xF3F4F5, 0.0, 0.85);
    const back = mesh(new T.PlaneGeometry(RX * 2, RH), wall, false, true); back.position.set(0, RH / 2, RZ0); scene.add(back);
    const left = mesh(new T.PlaneGeometry(RZ1 - RZ0, RH), wall, false, true); left.rotation.y = Math.PI / 2; left.position.set(-RX, RH / 2, (RZ0 + RZ1) / 2); scene.add(left);
    const right = mesh(new T.PlaneGeometry(RZ1 - RZ0, RH), wall, false, true); right.rotation.y = -Math.PI / 2; right.position.set(RX, RH / 2, (RZ0 + RZ1) / 2); scene.add(right);
    // forro com luminárias de LED
    const ceil = mesh(new T.PlaneGeometry(RX * 2, RZ1 - RZ0), mat(0xF7F7F6, 0, 0.9), false, true);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, RH, (RZ0 + RZ1) / 2); scene.add(ceil);
    const ledM = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 });
    for (const x of [-2.6, 0, 2.6]) for (const z of [-2.4, 0.4, 3.2]) {
      scene.add(at(mesh(new T.BoxGeometry(0.62, 0.02, 0.62), mat(0xDADDE0, 0.3, 0.5), false), v3(x, RH - 0.01, z)));
      scene.add(at(mesh(new T.PlaneGeometry(0.56, 0.56).rotateX(Math.PI / 2), ledM, false, false), v3(x, RH - 0.022, z)));
    }
    // rodapé de granito
    const skirt = mat(0x8F8C86, 0.05, 0.4);
    scene.add(at(mesh(new T.BoxGeometry(RX * 2, 0.08, 0.02), skirt, false), v3(0, 0.04, RZ0 + 0.01)));
    scene.add(at(mesh(new T.BoxGeometry(0.02, 0.08, RZ1 - RZ0), skirt, false), v3(-RX + 0.01, 0.04, (RZ0 + RZ1) / 2)));
    scene.add(at(mesh(new T.BoxGeometry(0.02, 0.08, RZ1 - RZ0), skirt, false), v3(RX - 0.01, 0.04, (RZ0 + RZ1) / 2)));
    // janelas com caixilho azul
    const blue = mat(0x1E4FB4, 0.35, 0.45), glass = new T.MeshBasicMaterial({ color: 0xDDE7F1 }); // céu claro sem emissão: não estoura o brilho (bloom)
    const windowAt = (cx) => {
      const W = 2.0, H = 1.95, y0 = 0.95, z = RZ0 + 0.02;
      scene.add(at(mesh(new T.PlaneGeometry(W, H), glass, false, false), v3(cx, y0 + H / 2, z)));
      const bar = (w, h, x, y) => scene.add(at(mesh(new T.BoxGeometry(w, h, 0.05), blue, false), v3(x, y, z + 0.02)));
      bar(W + 0.08, 0.07, cx, y0); bar(W + 0.08, 0.07, cx, y0 + H); bar(0.07, H, cx - W / 2, y0 + H / 2); bar(0.07, H, cx + W / 2, y0 + H / 2); bar(0.05, H, cx, y0 + H / 2);
      for (let i = 1; i < 10; i++) bar(W, 0.025, cx, y0 + i * H / 10);
      scene.add(at(mesh(new T.BoxGeometry(W + 0.2, 0.03, 0.12), mat(0xE6E7E8, 0.05, 0.5), false), v3(cx, y0 - 0.03, z + 0.06)));
    };
    windowAt(-1.55); windowAt(1.75);
    // ar-condicionado
    const ac = new T.Group(); ac.position.set(0.1, 3.0, RZ0 + 0.13); scene.add(ac);
    ac.add(mesh(new T.BoxGeometry(1.0, 0.26, 0.22), mat(0xFAFAFA, 0.05, 0.4)));
    ac.add(at(mesh(new T.BoxGeometry(0.92, 0.04, 0.02), mat(0xD8DADC, 0.1, 0.5)), v3(0, -0.09, 0.11)));
    // placa ELETROMECÂNICA
    scene.add(at(mesh(new T.PlaneGeometry(0.42, 0.1), new T.MeshStandardMaterial({ map: canvasTex(420, 100, c => { c.fillStyle = "#2E9A4E"; c.fillRect(0, 0, 420, 100); c.fillStyle = "#fff"; c.font = "bold 36px Arial"; c.textAlign = "center"; c.fillText("ELETROMECÂNICA", 210, 64); }), roughness: 0.5 }), false), v3(0.1, 2.22, RZ0 + 0.012)));
    // caixas elétricas e eletroduto azul
    const box = (x, y, w, h) => { scene.add(at(mesh(new T.BoxGeometry(w, h, 0.14), mat(0xD9D9D6, 0.15, 0.55)), v3(x, y, RZ0 + 0.07))); scene.add(at(mesh(new T.BoxGeometry(0.06, 0.03, 0.02), mat(0x555A60)), v3(x + w * 0.3, y, RZ0 + 0.15))); };
    box(-0.25, 1.25, 0.36, 0.42); box(0.75, 1.25, 0.26, 0.32);
    const cond = mat(0x6FA9E0, 0.1, 0.45);
    pipe(v3(0.3, 1.0, RZ0 + 0.04), v3(0.3, 2.75, RZ0 + 0.04), 0.018, cond, scene);
    pipe(v3(-0.6, 0.95, RZ0 + 0.04), v3(1.1, 0.95, RZ0 + 0.04), 0.016, cond, scene);
    pipe(v3(-0.25, 0.95, RZ0 + 0.04), v3(-0.25, 1.04, RZ0 + 0.04), 0.014, cond, scene);
    scene.add(at(mesh(new T.BoxGeometry(0.12, 0.07, 0.05), mat(0x2F6DB5, 0.2, 0.5)), v3(-0.55, 0.92, RZ0 + 0.04)));
    // armários brancos (fundo, à direita)
    const white = mat(0xCDD2D8, 0.05, 0.42), handle = mat(0x2B2F36, 0.5, 0.4);
    const cabinet = (x, z, w, h, d, doors, rotY = 0) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
      g.add(at(mesh(new T.BoxGeometry(w, h, d), white), v3(0, h / 2 + 0.03, 0)));
      g.add(at(mesh(new T.BoxGeometry(w * 0.96, 0.03, d * 0.9), mat(0x9AA0A6)), v3(0, 0.015, 0)));
      for (let i = 1; i < doors; i++) g.add(at(mesh(new T.BoxGeometry(0.004, h * 0.98, 0.004), mat(0xC9CCCF)), v3(-w / 2 + i * w / doors, h / 2 + 0.03, d / 2 + 0.002)));
      if (doors === 2) for (const sx of [-1, 1]) g.add(at(mesh(new T.BoxGeometry(0.012, 0.14, 0.02), handle), v3(sx * 0.04, h * 0.62, d / 2 + 0.01)));
      return g;
    };
    cabinet(2.55, RZ0 + 0.32, 1.05, 1.65, 0.55, 2);
    cabinet(3.75, RZ0 + 0.32, 0.8, 1.55, 0.55, 2);
    // paredes de armários embutidos nas laterais
    const wardrobe = (x, z0, z1, rot) => { const len = z1 - z0, n = Math.round(len / 0.9); const g = new T.Group(); g.position.set(x, 0, (z0 + z1) / 2); g.rotation.y = rot; scene.add(g);
      g.add(at(mesh(new T.BoxGeometry(len, 2.9, 0.6), white), v3(0, 1.48, 0)));
      g.add(at(mesh(new T.BoxGeometry(len, 0.08, 0.58), mat(0x8F8C86, 0.05, 0.4)), v3(0, 0.04, 0)));
      for (let i = 1; i < n; i++) g.add(at(mesh(new T.BoxGeometry(0.006, 2.85, 0.006), mat(0xC5C9CD)), v3(-len / 2 + i * len / n, 1.5, 0.302)));
      for (let i = 0; i < n; i++) g.add(at(mesh(new T.BoxGeometry(len / n * 0.96, 0.006, 0.006), mat(0xD5D8DB)), v3(-len / 2 + (i + 0.5) * len / n, 2.25, 0.302)));
    };
    wardrobe(RX - 0.3, -1.2, RZ1, -Math.PI / 2);
    wardrobe(-RX + 0.3, 1.0, RZ1, Math.PI / 2);
    // bancada didática real (fundo, à esquerda): ver buildRealBench
    const alu = mat(0xC9CED4, 0.7, 0.35);
    buildRealBench(scene, -3.3, RZ0 + 0.55);
    // cone
    const cone = new T.Group(); cone.position.set(-2.35, 0, RZ0 + 0.6); scene.add(cone);
    cone.add(at(mesh(new T.BoxGeometry(0.34, 0.03, 0.34), mat(0x1F2328, 0.1, 0.8)), v3(0, 0.015, 0)));
    cone.add(at(mesh(new T.ConeGeometry(0.12, 0.6, 28, 1, true), mat(0xF26A21, 0.1, 0.5)), v3(0, 0.33, 0)));
    for (const y of [0.25, 0.4]) cone.add(at(mesh(new T.CylinderGeometry(0.12 - y * 0.17, 0.12 - (y - 0.05) * 0.17, 0.06, 28, 1, true), mat(0xF4F4F4, 0.1, 0.4)), v3(0, y + 0.03, 0)));
    // carrinho com motores (fundo, à direita)
    const cart = new T.Group(); cart.position.set(4.25, 0, -2.3); cart.rotation.y = -Math.PI / 2; scene.add(cart);
    for (const x of [-0.5, 0.5]) for (const z of [-0.3, 0.3]) cart.add(at(mesh(new T.BoxGeometry(0.035, 0.82, 0.035), alu), v3(x, 0.47, z)));
    cart.add(at(mesh(new T.BoxGeometry(1.06, 0.03, 0.66), white), v3(0, 0.88, 0)));
    cart.add(at(mesh(new T.BoxGeometry(1.04, 0.02, 0.64), white), v3(0, 0.2, 0)));
    for (const x of [-0.25, 0.1]) { cart.add(at(mesh(new T.CylinderGeometry(0.075, 0.075, 0.18, 24).rotateZ(Math.PI / 2), mat(0x2F6DB5, 0.4, 0.4)), v3(x, 0.3, 0.05))); }
    cart.add(at(mesh(new T.BoxGeometry(0.03, 0.8, 0.6), white), v3(0.5, 1.3, 0)));
    for (let i = 0; i < 10; i++) cart.add(at(mesh(new T.CylinderGeometry(0.018, 0.018, 0.01, 12).rotateZ(Math.PI / 2), mat([0xB83A2E, 0x2E8B4A, 0xE8C21C, 0x1F2328][i % 4])), v3(0.48, 1.15 + Math.floor(i / 5) * 0.2, -0.2 + (i % 5) * 0.1)));
  }

  /* ---------- TQ-01 ---------- */
  function topHolder(parent, x, z) {
    const y = 1.95 + 0.165 * Math.sqrt(1 - (Math.hypot(x, z) / 0.55) ** 2);
    const h = new T.Group(); h.position.set(x, y, z); parent.add(h);
    h.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.07, 20), M.steel));
    flange(v3(0, 0.035, 0), v3(0, 1, 0), 0.022, h, 4);
    return { holder: h, kind: "top", mount: v3(0, 0.045, 0) };
  }
  function sideHolder(parent, ang, y) {
    const n = v3(Math.sin(ang), 0, Math.cos(ang));
    const h = new T.Group(); h.position.set(n.x * 0.55, y, n.z * 0.55); h.rotation.y = ang; parent.add(h);
    h.add(at(mesh(cylZ(0.024, 0.06, 20), M.steel), v3(0, 0, 0.02)));
    flange(v3(0, 0, 0.05), v3(0, 0, 1), 0.02, h, 4);
    return { holder: h, kind: "side", mount: v3(0, 0, 0.06) };
  }
  function buildTank(root, slots) { S.tqG = new T.Group(); root.add(S.tqG); }

  /* ---------- bomba, linha e tanque de acrílico ---------- */
  function buildLine(root, slots) {
    const pump = new T.Group(); pump.position.set(1.05, 0, -0.95); root.add(pump); S.pumpG = pump; S.pumpBase = pump.position.clone();
    const P = (geo, m, p) => { const o = at(mesh(geo, m), p); pump.add(o); return o; };
    // base de perfil (skid)
    const skid = mat(0x4A525C, 0.5, 0.5);
    P(new T.BoxGeometry(0.74, 0.03, 0.3), skid, v3(0.09, 0.03, 0));
    for (const z of [-0.14, 0.14]) P(new T.BoxGeometry(0.74, 0.05, 0.02), skid, v3(0.09, 0.025, z));
    P(new T.BoxGeometry(0.72, 0.004, 0.28), mat(0x8A939C, 0.6, 0.4), v3(0.09, 0.047, 0));
    // motor elétrico (verde), aletas, tampas, caixa de ligação, pés e olhal
    const green = mat(0x1E7D3A, 0.35, 0.42), greenD = mat(0x186A30, 0.35, 0.45);
    S.pumpMats = [[green, new T.Color(0x1E7D3A)], [greenD, new T.Color(0x186A30)]]; S.pumpT = 25; S.pumpBurnt = false; S.pumpSmokeT = 0;
    S.clickables = S.clickables || []; S.clickables.push({ obj: pump, tag: 'BOMBA-MOTOR', fn: () => { if (S.pumpBurnt) replacePump(); else tip('<b>Motor da bomba</b> a ' + fmt(S.pumpT || 25, 0) + ' °C. Com o registro fechado ele gira sem vazão e sobreaquece.', ''); } });
    P(cylX(0.092, 0.25, 36), green, v3(0.27, 0.17, 0));
    for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(an)) < 0.3 && Math.cos(an) < 0) continue; P(new T.BoxGeometry(0.22, 0.012, 0.01), green, v3(0.27, 0.17 + Math.sin(an) * 0.096, Math.cos(an) * 0.096)).rotation.x = -an; }
    P(cylX(0.088, 0.03, 32), greenD, v3(0.135, 0.17, 0));
    P(cylX(0.088, 0.03, 32), greenD, v3(0.405, 0.17, 0));
    P(cylX(0.092, 0.06, 32), mat(0x2A6F3E, 0.4, 0.45), v3(0.45, 0.17, 0));
    P(new T.BoxGeometry(0.085, 0.06, 0.085), green, v3(0.27, 0.285, 0));
    P(new T.BoxGeometry(0.09, 0.008, 0.09), greenD, v3(0.27, 0.318, 0));
    gland(pump, v3(0.27, 0.285, -0.0425), v3(0, 0, -1), 0.008); // saída de cabos para trás, rumo à eletrocalha
    for (const x of [0.2, 0.34]) P(new T.BoxGeometry(0.05, 0.06, 0.2), greenD, v3(x, 0.08, 0));
    P(new T.TorusGeometry(0.014, 0.004, 8, 16).rotateY(Math.PI / 2), M.steel, v3(0.33, 0.275, 0));
    // ventilador (gira) visível na grade da tampa
    const fan = new T.Group(); fan.position.set(0.482, 0.17, 0); pump.add(fan); S.pumpFan = fan;
    for (let i = 0; i < 6; i++) { const sp = mesh(new T.BoxGeometry(0.004, 0.16, 0.016), mat(0x2B2F36, 0.4, 0.5), false); sp.rotation.x = i * Math.PI / 6; fan.add(sp); }
    fan.add(mesh(cylX(0.02, 0.008, 16), mat(0xB83A2E, 0.3, 0.5), false));
    for (let i = 1; i <= 3; i++) P(new T.TorusGeometry(i * 0.028, 0.003, 6, 32).rotateY(Math.PI / 2), mat(0x2A6F3E, 0.4, 0.45), v3(0.481, 0.17, 0));
    // eixo, protetor de acoplamento (cinza com borda amarela) e mancal
    P(cylX(0.013, 0.08, 16), M.chrome, v3(0.08, 0.17, 0));
    const guard = mat(0xB9C0C7, 0.5, 0.45), yellow = mat(0xE8C21C, 0.3, 0.45);
    const gd = P(new T.CylinderGeometry(0.075, 0.075, 0.075, 28, 1, true, 0, Math.PI), guard, v3(0.085, 0.17, 0)); gd.rotation.set(0, 0, Math.PI / 2); gd.material.side = T.DoubleSide;
    for (const x of [0.048, 0.122]) { const e = P(new T.TorusGeometry(0.075, 0.005, 6, 28, Math.PI), yellow, v3(x, 0.17, 0)); e.rotation.set(0, Math.PI / 2, 0); }
    P(cylX(0.048, 0.07, 24), mat(0x9AA3AD, 0.55, 0.4), v3(0.015, 0.17, 0));
    P(new T.BoxGeometry(0.06, 0.1, 0.12), mat(0x9AA3AD, 0.55, 0.4), v3(0.015, 0.1, 0));
    // voluta (carcaça) com nervuras, bocal axial de sucção e bocal de recalque no topo
    const casing = mat(0x9AA3AD, 0.6, 0.38);
    P(cylX(0.112, 0.075, 40), casing, v3(-0.04, 0.17, 0));
    g_spiral(pump, casing);
    for (let i = 0; i < 10; i++) { const an = i / 10 * Math.PI * 2; P(new T.BoxGeometry(0.006, 0.02, 0.012), casing, v3(-0.002, 0.17 + Math.sin(an) * 0.1, Math.cos(an) * 0.1)).rotation.x = -an; }
    for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; P(cylX(0.006, 0.012, 6), M.bolt, v3(-0.08, 0.17 + Math.sin(an) * 0.095, Math.cos(an) * 0.095)); }
    P(cylX(0.08, 0.02, 32), casing, v3(-0.085, 0.17, 0));
    P(cylX(0.032, 0.06, 20), casing, v3(-0.125, 0.17, 0));
    flange(v3(-0.155, 0.17, 0), v3(-1, 0, 0), 0.026, pump, 4);
    P(new T.CylinderGeometry(0.028, 0.034, 0.05, 20), casing, v3(-0.03, 0.29, 0));
    S.pumpLamp = new T.MeshStandardMaterial({ color: 0x224433, emissive: 0x000000 });
    P(new T.SphereGeometry(0.012, 12, 8), S.pumpLamp, v3(0.29, 0.31, 0.047));
    // sucção axial (sai do fundo do tanque de acrílico e entra pela frente da voluta)
    pipeRun([v3(1.7, 0.64, -1.0), v3(1.7, 0.17, -1.0), v3(1.7, 0.17, -0.62), v3(0.78, 0.17, -0.62), v3(0.78, 0.17, -0.95), v3(0.895, 0.17, -0.95)], 0.026, M.water, root, { flangeStart: true, flangeEnd: true });
    handValve(root, v3(0.78, 0.17, -0.79), v3(0, 0, -1), 0.026);
    handValve(root, v3(1.02, 0.45, -0.68), v3(0, 0, 1), 0.024);
    // recalque com trecho para a solenoide (VY)
    const Y = 0.45, Z = -0.35, R = 0.024;
    pipeRun([v3(1.02, 0.31, -0.95), v3(1.02, Y, -0.95), v3(1.02, Y, Z), v3(1.24, Y, Z)], R, M.water, root, { flangeStart: true, flangeEnd: true });
    pipe(v3(1.24, Y, Z), v3(2.26, Y, Z), R, M.water, root); flange(v3(2.26, Y, Z), v3(1, 0, 0), R, root, 4);
    pipeRun([v3(2.46, Y, Z), v3(2.75, Y, Z), v3(2.75, Y, -1.0), v3(2.75, 0.62, -1.0)], R, M.water, root, { flangeStart: true, flangeEnd: true });
    support(1.6, Z, Y, R, root, "x"); support(2.75, -0.7, Y, R, root, "z");
    pipe(v3(2.75, 0.62, -1.0), v3(2.75, 1.175, -1.0), R, M.water, root);
    handValve(root, v3(2.75, 0.45, -0.85), v3(0, 0, -1), 0.024);
    handValve(root, v3(2.52, 1.4, -1.0), v3(-1, 0, 0), 0.024);
    pipeRun([v3(2.75, 1.175, -1.0), v3(2.75, 1.4, -1.0), v3(2.23, 1.4, -1.0)], R, M.water, root, { flangeEnd: true });
    const inl = (x) => { const h = new T.Group(); h.position.set(x, Y, Z); root.add(h); return { holder: h, kind: "inline", mount: v3(0, 0, 0) }; };
    slots.vy = inl(2.36);
    // tanque de acrílico com tampa
    const ac = new T.Group(); ac.position.set(1.9, 0, -1.0); root.add(ac);
    for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) { ac.add(at(mesh(new T.BoxGeometry(0.04, 0.62, 0.04), M.support), v3(x, 0.31, z))); ac.add(at(mesh(new T.BoxGeometry(0.1, 0.01, 0.1), M.support), v3(x, 0.005, z))); }
    ac.add(at(mesh(new T.BoxGeometry(0.8, 0.03, 0.7), M.support), v3(0, 0.625, 0)));
    // acrílico: paredes com espessura (10 mm), verniz brilhante e bordas aparentes (o acrílico fica mais escuro/esverdeado na quina)
    const acr = new T.MeshPhysicalMaterial({ color: 0xE8F3FF, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.13, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, depthWrite: false, side: T.DoubleSide });
    const acrEdge = new T.MeshPhysicalMaterial({ color: 0xBFE0DA, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.5, clearcoat: 1, depthWrite: false });
    const AW = 0.66, AH = 0.9, AD = 0.56, AT = 0.01, AY = 1.09;
    for (const [w, h, d, x, y, z] of [[AW, AH, AT, 0, AY, AD / 2 - AT / 2], [AW, AH, AT, 0, AY, -AD / 2 + AT / 2], [AT, AH, AD - 2 * AT, AW / 2 - AT / 2, AY, 0], [AT, AH, AD - 2 * AT, -AW / 2 + AT / 2, AY, 0], [AW, AT, AD, 0, AY - AH / 2 + AT / 2, 0]])
      ac.add(at(mesh(new T.BoxGeometry(w, h, d), acr, false, false), v3(x, y, z)));
    const eb = (w, h, d, x, y, z) => ac.add(at(mesh(new T.BoxGeometry(w, h, d), acrEdge, false, false), v3(x, y, z)));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) eb(AT * 1.2, AH, AT * 1.2, sx * (AW / 2 - AT / 2), AY, sz * (AD / 2 - AT / 2));
    for (const sy of [-1, 1]) { for (const sz of [-1, 1]) eb(AW, AT * 1.2, AT * 1.2, 0, AY + sy * (AH / 2 - AT / 2), sz * (AD / 2 - AT / 2)); for (const sx of [-1, 1]) eb(AT * 1.2, AT * 1.2, AD, sx * (AW / 2 - AT / 2), AY + sy * (AH / 2 - AT / 2), 0); }
    ac.add(at(mesh(new T.BoxGeometry(0.7, 0.02, 0.6), new T.MeshPhysicalMaterial({ color: 0xDDEEFF, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }), false, false), v3(0, 1.55, 0)));
    // bocais passa-parede dentro do tanque: entrada de água (parede direita, y 1,4) e saída da sucção (fundo, x -0,2), ambos ocos
    pipe(v3(0.33, 1.4, 0), v3(0.26, 1.4, 0), 0.024, M.water, ac); openEnd(v3(0.26, 1.4, 0), v3(-1, 0, 0), 0.024, ac);
    pipe(v3(-0.2, 0.64, 0), v3(-0.2, 0.7, 0), 0.026, M.water, ac); openEnd(v3(-0.2, 0.7, 0), v3(0, 1, 0), 0.026, ac);
    S.water = mesh(new T.BoxGeometry(0.64, 1, 0.54), new T.MeshStandardMaterial({ color: 0xDE6FA3, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false }), false, false);
    ac.add(S.water);
    // Régua de nível em %: 0 % no fundo (y 0,65) e 100 % no nível máximo (y 1,53).
    const RY0 = 0.63, RY1 = 1.55, RH = 1024, ppm = RH / (RY1 - RY0), ry = (pct) => RH - (0.65 + 0.88 * pct / 100 - RY0) * ppm;
    ac.add(at(mesh(new T.PlaneGeometry(0.1, RY1 - RY0), new T.MeshBasicMaterial({ map: canvasTex(176, RH, (c, w) => {
      c.fillStyle = "rgba(255,255,255,0.92)"; c.fillRect(0, 0, w, RH);
      c.fillStyle = "#1F2A37"; c.fillRect(0, ry(100), 4, ry(0) - ry(100) + 3);
      c.textBaseline = "middle"; c.textAlign = "left";
      for (let p = 0; p <= 100; p += 5) {
        const y = ry(p), big = p % 10 === 0;
        c.fillStyle = p === 50 ? "#E87722" : "#1F2A37"; c.fillRect(0, y - (big ? 2 : 1), big ? 44 : 24, big ? 5 : 3);
        if (big) { c.font = "bold 40px Arial"; c.fillText(p === 100 ? "100%" : String(p), 52, y + 1); }
      }
    }), transparent: true }), false), v3(-0.278, (RY0 + RY1) / 2, 0.281)));
    const wallHolder = (y, x = 0.14) => { const h = new T.Group(); h.position.set(x, y, 0.28); ac.add(h); h.add(at(mesh(cylZ(0.028, 0.012, 20), M.dark), v3(0, 0, 0.006))); return { holder: h, kind: "side", mount: v3(0, 0, 0.012) }; };
    slots.lsh = wallHolder(1.38); slots.lsl = wallHolder(0.8); slots.tsh = wallHolder(1.2, -0.1);
    // PT100 (TE-104 + TT-104) pela tampa
    { const h = new T.Group(); h.position.set(-0.12, 1.56, 0.05); ac.add(h); h.add(at(mesh(new T.CylinderGeometry(0.03, 0.03, 0.04, 20), M.steel), v3(0, 0.02, 0))); flange(v3(0, 0.04, 0), v3(0, 1, 0), 0.022, h, 4);
      slots.te = { holder: h, kind: "top", mount: v3(0, 0.045, 0) };
      slots.tt = { holder: h, kind: "top", mount: v3(0, 0.045 + 0.215, 0), small: true }; }
    // transmissor de pressão de nível LT-101: fundo do tanque, parede direita (4–20 mA, 0–10 kPa → D1110)
    { const lg = new T.Group(); lg.position.set(0.335, 0.74, 0.02); ac.add(lg);
      lg.add(at(mesh(cylX(0.034, 0.012, 24), M.steel), v3(0.006, 0, 0)));
      lg.add(at(mesh(cylX(0.026, 0.07, 24), mat(0x2F6DB5, 0.4, 0.45)), v3(0.047, 0, 0)));
      lg.add(at(mesh(new T.BoxGeometry(0.06, 0.07, 0.07), mat(0x2A2F36, 0.4, 0.5)), v3(0.115, 0, 0)));
      S.ltScreen = screen(200, 100); S.ltScreen.draw(["--", "LT-101 cm"]);
      const lp = at(mesh(new T.PlaneGeometry(0.055, 0.03), new T.MeshBasicMaterial({ map: S.ltScreen.tex }), false), v3(0.1455, 0, 0)); lp.rotation.y = Math.PI / 2; lg.add(lp);
      gland(lg, v3(0.115, 0.035, 0), v3(0, 1, 0), 0.008); S.ltG = lg;
      S.clickables = S.clickables || []; S.clickables.push({ obj: lg, tag: "LT-101", fn: () => tip("<b>LT-101</b>, transmissor de pressão de nível no fundo do tanque: 0–10 kPa = 4–20 mA = 0–2000 contagens no <b>D1110</b> (1 contagem ≈ 0,051 cm).", "") }); }
    // resistência de aquecimento TZ-104: aquecedor tubular flangeado de 3 grampos (hairpins) com aleta helicoidal; ao ligar, o brilho incandescente corre pelo elemento
    { const tz = new T.Group(); tz.position.set(0, 0.74, -0.28); tz.rotation.y = Math.PI; ac.add(tz);
      flange(v3(0, 0, 0.012), v3(0, 0, 1), 0.05, tz, 8);
      tz.add(at(mesh(new T.BoxGeometry(0.13, 0.13, 0.1), M.paint), v3(0, 0, 0.075)));
      gland(tz, v3(0, -0.065, 0.075), v3(0, -1, 0), 0.01);
      const glowTex = canvasTex(256, 8, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#686868"); gr.addColorStop(0.3, "#ffffff"); gr.addColorStop(0.5, "#8c8c8c"); gr.addColorStop(1, "#686868"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
      glowTex.wrapS = T.RepeatWrapping; glowTex.repeat.set(6, 1); S.tzTex = glowTex;
      S.tzLamp = new T.MeshStandardMaterial({ color: 0x8C9199, metalness: 0.8, roughness: 0.35, emissive: 0x000000, emissiveMap: glowTex });
      const LH = 0.3, RB = 0.012, ZS = -0.05, RT = 0.0058;            // comprimento, meio-afastamento das pernas, início da parte quente
      const hairpin = (th) => {
        const cx = 0.03 * Math.cos(th), cy = 0.03 * Math.sin(th), px = -Math.sin(th), py = Math.cos(th), zb = -(LH - RB), pts = [];
        const leg = (s1, z0, z1) => { for (let i = 0; i <= 8; i++) pts.push(v3(cx + s1 * RB * px, cy + s1 * RB * py, z0 + (z1 - z0) * i / 8)); };
        leg(1, ZS, zb);
        for (let i = 1; i < 18; i++) { const a2 = Math.PI * i / 18; pts.push(v3(cx + px * RB * Math.cos(a2), cy + py * RB * Math.cos(a2), zb - RB * Math.sin(a2))); }
        leg(-1, zb, ZS);
        tz.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, "catmullrom", 0.5), 110, RT, 10, false), S.tzLamp));
        for (const s1 of [1, -1]) {       // terminais frios (sem brilho) e aleta helicoidal em volta de cada perna
          const lx = cx + s1 * RB * px, ly = cy + s1 * RB * py;
          tz.add(at(mesh(cylZ(RT, 0.05, 12), M.steel), v3(lx, ly, -0.025)));
          const hp = []; for (let i = 0; i <= 150; i++) { const t = i / 150, ang = t * 24 * Math.PI * 2, z = ZS + (zb - ZS) * t; hp.push(v3(lx + 0.0092 * Math.cos(ang), ly + 0.0092 * Math.sin(ang), z)); }
          tz.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hp), 150, 0.0016, 5, false), S.tzLamp));
        }
      };
      for (const th of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) hairpin(th);
      S.tzLight = new T.PointLight(0xFF3A10, 0, 0.9, 2); S.tzLight.position.set(0, 0.0, -0.18); tz.add(S.tzLight);
      S.clickables = S.clickables || []; S.clickables.push({ obj: tz, tag: "TZ-104", fn: () => { if (S.burnt) replaceHeater(); else tip("<b>TZ-104</b>: resistência a " + fmt(S.proc.Th, 0) + " °C (máximo 200 °C). Fora da água ela queima em segundos.", ""); } });
      S.tz = tz; S.tzGlow = 0; }
    // dreno
    pipeRun([v3(0.12, 0.64, 0.14), v3(0.12, 0.4, 0.14), v3(0.12, 0.4, 0.3)], 0.016, M.water, ac);   // a sucção sai em x -0,2 / z 0: o dreno fica do outro lado, sem cruzar
    openEnd(v3(0.12, 0.4, 0.3), v3(0, 0, 1), 0.016, ac); // boca do dreno (oca)
    { const bf = mesh(new T.CircleGeometry(0.0146, 20), M.bore, false, false); bf.rotation.x = -Math.PI / 2; bf.position.set(0.12, 0.641, 0.14); ac.add(bf); } // furo no fundo do tanque (ralo)
    // registro de esfera do dreno (mesmo modelo dos registros da linha): alavanca alinhada = aberto, de través = fechado
    { const vm = ballValve(ac, v3(0.12, 0.4, 0.22), v3(0, 0, 1), 0.016); S.drainLever = vm.lv; vm.lv.rotation.y = Math.PI / 2;
      S.clickables = S.clickables || [];
      S.clickables.push({ obj: vm.g, tag: "DRENO", fn: () => { S.lvl.drain = !S.lvl.drain; renderHud(); tip(S.lvl.drain ? "Registro do dreno <b>aberto</b>: a água sai do tanque." : "Registro do dreno <b>fechado</b>.", ""); } }); }
    S.ac = ac;
  }
  function setWater(L) { const h = Math.max(0.002, 0.88 * L / 100); S.water.scale.y = h; S.water.position.set(0, 0.65 + h / 2, 0); }

  /* ---------- painel com CLP Delta DVP-SX2 ---------- */
  function buildPanel(root) {
    const pn = new T.Group(); pn.position.set(-4.98, 0, -1.2); pn.rotation.y = Math.PI / 2; root.add(pn);
    const cab = mat(0xBFC3AE, 0.12, 0.6);
    // ---------- biblioteca de componentes de quadro elétrico: trilho DIN, canaleta ranhurada, bornes, fonte, etc. ----------
    const steelM = mat(0xC9D0D6, 0.7, 0.35), steelD = mat(0x6C747C, 0.5, 0.5), blkM = mat(0x1B1E22, 0.1, 0.7), whtM = mat(0xF2F3F4, 0.05, 0.55);
    const bx = (p, w, h, d, m, x, y, z) => { const o = mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
    const cyl = (p, r, l, m, x, y, z, seg = 14) => { const o = mesh(cylZ(r, l, seg), m); o.position.set(x, y, z); p.add(o); return o; };
    const decalM = (tex, rough = 0.6) => new T.MeshStandardMaterial({ map: tex, roughness: rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const screwHead = (p, x, y, z, r = 0.004) => { cyl(p, r, 0.003, steelD, x, y, z, 12); const s = bx(p, r * 1.5, 0.0009, 0.0008, blkM, x, y, z + 0.0018); s.rotation.z = 0.6; };
    // trilho DIN ômega (35 mm) com furos oblongos e parafusos de fixação
    const rail3d = (p, cx, y, len, screws = []) => {
      const z0 = 0.031;
      for (const s of [-1, 1]) { bx(p, len, 0.004, 0.0015, steelM, cx, y + s * 0.0155, z0); bx(p, len, 0.0015, 0.0075, steelM, cx, y + s * 0.0135, z0 + 0.0035); }
      bx(p, len, 0.027, 0.0015, steelM, cx, y, z0 + 0.0075);
      const n = Math.floor(len / 0.025), im = new T.InstancedMesh(new T.BoxGeometry(0.015, 0.0055, 0.0018), blkM, n), m4 = new T.Matrix4();
      for (let i = 0; i < n; i++) { m4.setPosition(cx - len / 2 + 0.0125 + i * 0.025, y, z0 + 0.0079); im.setMatrixAt(i, m4); }
      p.add(im);
      for (const sx of screws) screwHead(p, sx, y, z0 + 0.0105);
    };
    // canaleta ranhurada (dedos de plástico) com tampas nas pontas
    const ductTex = canvasTex(512, 96, (c, w, h) => {
      // vista de frente: tampa lisa no meio (voltada para a porta) e só os furos/dedos nas bordas de cima e de baixo, por onde entram os fios
      c.fillStyle = "#B6BCC2"; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 28) { c.fillStyle = "#454C52"; c.fillRect(x + 8, 3, 12, 15); c.fillRect(x + 8, h - 18, 12, 15); }
      c.fillStyle = "#8E959C"; c.fillRect(0, 19, w, 2); c.fillRect(0, h - 21, w, 2);
      c.fillStyle = "#CBD0D5"; c.fillRect(0, 22, w, 2);
    });
    // canaleta de PVC cinza-escuro, funda (quase a profundidade dos componentes): tampa lisa na frente e rasgos (dedos) só nas faixas de cima e de baixo, por onde os fios entram
    const ductM = mat(0x666A70, 0.1, 0.72), ductLid = mat(0x7B8087, 0.1, 0.62), slitM = mat(0x2A2D31, 0.1, 0.8), DD = 0.075;
    const slits = (p, n, w, h, x0, y0, dx, dy, z, hor) => { const im = new T.InstancedMesh(new T.BoxGeometry(w, h, 0.002), slitM, n), m4 = new T.Matrix4(); for (let i = 0; i < n; i++) { m4.setPosition(x0 + dx * i, y0 + dy * i, z); im.setMatrixAt(i, m4); } p.add(im); };
    const duct3d = (p, cx, y, len) => {
      const H = 0.06, zf = 0.03 + DD;
      bx(p, len, H, DD, ductM, cx, y, 0.03 + DD / 2);
      bx(p, len - 0.004, H - 0.032, 0.004, ductLid, cx, y, zf + 0.002);              // tampa lisa de frente (voltada para a porta)
      const n = Math.floor((len - 0.02) / 0.016);
      for (const sy of [-1, 1]) slits(p, n, 0.007, 0.0135, cx - (n - 1) * 0.008, y + sy * (H / 2 - 0.0085), 0.016, 0, zf + 0.0011);   // rasgos nas bordas de cima e de baixo
      for (const sx of [-1, 1]) bx(p, 0.004, H + 0.002, DD + 0.002, ductLid, cx + sx * (len / 2 + 0.002), y, 0.03 + DD / 2);          // tampas das pontas
    };
    const vduct3d = (p, cx, y0, y1) => {      // canaleta vertical lateral (moldura do quadro), mesma construção
      const W = 0.05, L = y1 - y0, cy = (y0 + y1) / 2, zf = 0.03 + DD;
      bx(p, W, L, DD, ductM, cx, cy, 0.03 + DD / 2);
      bx(p, W - 0.032, L - 0.004, 0.004, ductLid, cx, cy, zf + 0.002);
      const n = Math.floor((L - 0.02) / 0.016);
      for (const sx of [-1, 1]) slits(p, n, 0.0135, 0.007, cx + sx * (W / 2 - 0.0085), cy - (n - 1) * 0.008, 0, 0.016, zf + 0.0011);
      for (const sy of [-1, 1]) bx(p, W + 0.002, 0.004, DD + 0.002, ductLid, cx, cy + sy * (L / 2 + 0.002), 0.03 + DD / 2);
    };
    // régua de bornes modulares (cinza/bege, PE amarelo-verde, azul do neutro) com parafuso frontal, entradas de fio, marcador e fim de linha
    const termCols = [0xB1B6BB, 0xE3C93C, 0x4A7FC4, 0x8F959B];
    const termGeo = new T.BoxGeometry(0.0058, 0.05, 0.04), entryGeo = new T.BoxGeometry(0.0034, 0.0075, 0.0012), mkGeo = new T.BoxGeometry(0.0046, 0.0105, 0.0010), scGeo = cylZ(0.0019, 0.002, 10);
    const entryM = mat(0xF08A1C, 0.05, 0.5), mkM = whtM, greenM = mat(0x2EA84F, 0.05, 0.6);
    const terminalStrip = (p, x0, y, kinds) => {
      const P = 0.0062; let x = x0;
      kinds.forEach((k, i) => {
        const w = k === 3 ? 0.004 : 0.0058, cx = x + w / 2;
        const body = mesh(k === 3 ? new T.BoxGeometry(0.004, 0.05, 0.04) : termGeo, mat(termCols[k], 0.05, 0.6)); body.position.set(cx, y, 0.06); p.add(body);
        if (k !== 3) {
          for (const s of [-1, 1]) { const e = mesh(entryGeo, entryM); e.position.set(cx, y + s * 0.0185, 0.0807); p.add(e); const hole = mesh(scGeo, blkM); hole.position.set(cx, y + s * 0.0095, 0.0808); p.add(hole); }
          const m = mesh(mkGeo, mkM); m.position.set(cx, y, 0.0806); p.add(m);
          if (k === 1) { const g = mesh(new T.BoxGeometry(0.0058, 0.012, 0.0012), greenM); g.position.set(cx, y - 0.003, 0.0809); p.add(g); }
        }
        x += (k === 3 ? 0.004 : P);
      });
      bx(p, 0.0062 * 4, 0.0028, 0.0022, steelM, x0 + 0.0062 * 2.2, y + 0.0215, 0.0808);   // ponte (jumper) nos primeiros bornes
    };
    // fonte chaveada 24 V para trilho DIN
    const psu = (p, x, y) => {
      const g = new T.Group(); g.position.set(x, y, 0.04); p.add(g);
      bx(g, 0.14, 0.1, 0.085, mat(0x5E656D, 0.25, 0.55), 0, 0, 0.0425);
      for (const s of [-1, 1]) bx(g, 0.12, 0.014, 0.02, mat(0x2DBE4E, 0.05, 0.55), 0, s * 0.057, 0.058);
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) bx(g, 0.012, 0.0045, 0.002, entryM, -0.05 + i * 0.02, s * 0.057, 0.0685);
      const lbl = canvasTex(256, 100, c => { c.fillStyle = "#DFE3E7"; c.fillRect(0, 0, 256, 100); c.fillStyle = "#1F2933"; c.font = "bold 26px Arial"; c.textAlign = "center"; c.fillText("FONTE 24 Vcc", 128, 38); c.font = "20px Arial"; c.fillText("IN 100-240 Vca · OUT 5 A", 128, 70); });
      const pl = mesh(new T.PlaneGeometry(0.1, 0.039), decalM(lbl)); pl.position.set(-0.012, 0.004, 0.0856); g.add(pl);
      cyl(g, 0.0075, 0.006, mat(0xE87722, 0.2, 0.5), 0.05, -0.02, 0.0875, 16);                 // trimpot
      cyl(g, 0.0042, 0.004, mat(0x2EE07A, 0.1, 0.4, { emissive: 0x1BAA55, emissiveIntensity: 0.9 }), 0.05, 0.016, 0.087, 12);   // LED DC OK
      return g;
    };
    // disjuntor modular DIN (estilo Acti9): corpo branco, alavanca escura, parafusos nos bornes e etiqueta amarela
    const breaker3d = (p, x, y, poles, tag) => {
      const g = new T.Group(); g.position.set(x, y, 0.04); p.add(g); const W = 0.036 * poles;
      bx(g, W, 0.1, 0.062, mat(0xEEF0F2, 0.05, 0.55), 0, 0, 0.031);
      for (let i = 1; i < poles; i++) bx(g, 0.0012, 0.1, 0.0625, mat(0xBFC4C9, 0.1, 0.6), -W / 2 + i * 0.036, 0, 0.031);
      for (let i = 0; i < poles; i++) { const cx = -W / 2 + i * 0.036 + 0.018;
        bx(g, 0.018, 0.026, 0.014, mat(0x1F2328, 0.2, 0.55), cx, 0.016, 0.066);
        for (const sy of [-1, 1]) { bx(g, 0.026, 0.014, 0.006, blkM, cx, sy * 0.044, 0.063); cyl(g, 0.0055, 0.003, steelM, cx, sy * 0.044, 0.0675, 12); } }
      bx(g, W, 0.007, 0.0645, mat(0x2EA84F, 0.05, 0.55), 0, 0.0335, 0.031);
      const tg = canvasTex(160, 48, c => { c.fillStyle = "#F0CF18"; c.fillRect(0, 0, 160, 48); c.fillStyle = "#111"; c.font = "bold 28px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(tag, 80, 25); });
      const pl = mesh(new T.PlaneGeometry(Math.max(0.05, W * 0.8), 0.016), decalM(tg)); pl.position.set(0, -0.016, 0.0642); g.add(pl);
      return g;
    };
    // barra de terra (PE) com parafusos e fio verde-amarelo
    const earthBar = (p, cx, y) => {
      bx(p, 0.26, 0.014, 0.012, mat(0xB96F32, 0.4, 0.45), cx, y, 0.045);
      for (let i = 0; i < 8; i++) { screwHead(p, cx - 0.105 + i * 0.03, y, 0.0515, 0.0042); cyl(p, 0.0036, 0.004, mat(0xD9C21E, 0.1, 0.5), cx - 0.105 + i * 0.03, y + 0.011, 0.052, 10); }
    };
    // acabamentos externos comuns: guarnição de borracha, aba contra chuva e orelhas de fixação
    const cabinetShell = (p, ycen, hh) => {
      const rim = mat(0xB4B8A3, 0.12, 0.6);
      // dobra da boca do gabinete (para dentro) e ressalto externo em volta da abertura
      for (const sx of [-1, 1]) { bx(p, 0.026, hh, 0.012, rim, sx * 0.417, ycen, 0.314); bx(p, 0.012, hh + 0.012, 0.014, rim, sx * 0.456, ycen, 0.313); }
      for (const sy of [-1, 1]) { bx(p, 0.86, 0.026, 0.012, rim, 0, ycen + sy * (hh / 2 - 0.013), 0.314); bx(p, 0.924, 0.012, 0.014, rim, 0, ycen + sy * (hh / 2 + 0.006), 0.313); }
    };
    // furos da chapa de montagem: parafusos nos cantos
    const plateScrews = (p, ycen) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) screwHead(p, sx * 0.405, ycen + sy * 0.595, 0.031, 0.0055); };
    cabinetShell(pn, 1.45, 1.3); plateScrews(pn, 1.45); earthBar(pn, -0.2, 0.87);
    vduct3d(pn, -0.395, 0.86, 2.04); vduct3d(pn, 0.395, 0.86, 2.04);
    // caixa aberta (fundo + laterais)
    pn.add(at(mesh(new T.BoxGeometry(0.9, 1.3, 0.02), cab), v3(0, 1.45, 0.01)));
    pn.add(at(mesh(new T.BoxGeometry(0.02, 1.3, 0.32), cab), v3(-0.44, 1.45, 0.16)));
    pn.add(at(mesh(new T.BoxGeometry(0.02, 1.3, 0.32), cab), v3(0.44, 1.45, 0.16)));
    pn.add(at(mesh(new T.BoxGeometry(0.9, 0.02, 0.32), cab), v3(0, 2.09, 0.16)));
    pn.add(at(mesh(new T.BoxGeometry(0.9, 0.02, 0.32), cab), v3(0, 0.81, 0.16)));
    pn.add(at(mesh(new T.BoxGeometry(0.84, 1.24, 0.01), mat(0xD8651B, 0.12, 0.42)), v3(0, 1.45, 0.025)));
    // porta com articulação à direita: abre para a sala (clique na porta). Na face externa: sinaleiros, seletora da resistência, LIGA, DESLIGA e EMERGÊNCIA
    S.clickables = S.clickables || [];
    const hinge = new T.Group(); hinge.position.set(0.45, 1.45, 0.32); hinge.rotation.y = 0; pn.add(hinge);
    S.door = { hinge, open: false, ang: 0 };
    const rrShape = (w, h, r) => { const sh = new T.Shape(), x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; };
    const doorGeo = new T.ExtrudeGeometry(rrShape(0.91, 1.31, 0.01), { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 }); doorGeo.translate(0, 0, -0.007);
    const doorM = at(mesh(doorGeo, cab), v3(-0.45, 0, 0)); hinge.add(doorM);
    const DZ = 0.011, DXc = -0.45, dp = (x, y, z = DZ) => v3(DXc + x, y, z);
    S.clickables.push({ obj: doorM, tag: "PORTA", fn: () => { S.door.open = !S.door.open; tip(S.door.open ? "Porta do painel <b>aberta</b>: o CLP e os inversores aparecem. Clique na porta de novo para fechar." : "Porta <b>fechada</b>: use a seletora, LIGA, DESLIGA e EMERGÊNCIA. Clique na porta (fora dos botões) para abrir.", ""); } });
    S.panelScreen = screen(256, 128);
    hinge.add(at(mesh(new T.PlaneGeometry(0.3, 0.15), new T.MeshBasicMaterial({ map: S.panelScreen.tex }), false), dp(0, 0.5)));
    const plate = (txt, x, y, w, col = "#1F2328", fg = "#fff", fs = 34) => hinge.add(at(mesh(new T.PlaneGeometry(w, w * 0.3), new T.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, map: canvasTex(200, 60, (c) => { c.fillStyle = col; c.fillRect(0, 0, 200, 60); c.fillStyle = fg; c.font = "bold " + fs + "px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, 100, 32); }) }), false), dp(x, y)));
    const bezel = mat(0x2A2F36, 0.4, 0.5);
    // acabamento simples (gabinete metálico de parede): porta lisa com dobra de retorno e gaxeta preta em anel, fechadura de came de 1/4 de volta, dobradiças pequenas e plaqueta
    { const chrome = mat(0xD3D8DD, 0.8, 0.28), dkM = mat(0x2A2F36, 0.4, 0.5);
      for (const sx of [-1, 1]) hinge.add(at(mesh(new T.BoxGeometry(0.008, 1.314, 0.026), cab), v3(DXc + sx * 0.457, 0, -0.019)));
      for (const sy of [-1, 1]) hinge.add(at(mesh(new T.BoxGeometry(0.914, 0.008, 0.026), cab), v3(DXc, sy * 0.653, -0.019)));
      const gs = rrShape(0.86, 1.24, 0.03); gs.holes.push(new T.Path(rrShape(0.844, 1.224, 0.026).getPoints(10)));
      const gasket = mesh(new T.ExtrudeGeometry(gs, { depth: 0.009, bevelEnabled: false, curveSegments: 8 }), mat(0x15171A, 0.05, 0.9)); gasket.position.set(DXc, 0, -0.0195); hinge.add(gasket);
      const hp = dp(-0.405, 0.05);
      hinge.add(at(mesh(cylZ(0.02, 0.01, 24), dkM), v3(hp.x, hp.y, DZ + 0.005)));
      hinge.add(at(mesh(cylZ(0.013, 0.012, 20), chrome), v3(hp.x, hp.y, DZ + 0.012)));
      hinge.add(at(mesh(new T.BoxGeometry(0.003, 0.016, 0.002), blkM), v3(hp.x, hp.y, DZ + 0.0185)));
      for (const sy of [-0.5, 0, 0.5]) {                          // dobradiças pequenas (tambor + folha)
        const y = 1.45 + sy;
        const b = mesh(new T.CylinderGeometry(0.008, 0.008, 0.08, 14), chrome); b.position.set(0.462, y, 0.324); b.userData.ext = true; pn.add(b);
        { const lf = at(mesh(new T.BoxGeometry(0.03, 0.08, 0.003), chrome), v3(0.446, y, 0.3185)); lf.userData.ext = true; pn.add(lf); }
      }
      const np = canvasTex(256, 128, c => { c.fillStyle = "#C9CED3"; c.fillRect(0, 0, 256, 128); c.strokeStyle = "#7B838B"; c.lineWidth = 4; c.strokeRect(5, 5, 246, 118); c.fillStyle = "#1F2933"; c.font = "bold 28px Arial"; c.textAlign = "center"; c.fillText("QDC-01 · CLP", 128, 40); c.font = "bold 22px Arial"; c.fillText("220 V · 60 Hz · IP54", 128, 72); c.font = "18px Arial"; c.fillText("SENAI · Eletromecânica", 128, 104); });
      hinge.add(at(mesh(new T.PlaneGeometry(0.12, 0.06), decalM(np, 0.35)), dp(0.3, -0.55, DZ + 0.0008)));
    }
    // sinaleiros
    S.doorLamps = [["LIGADO", 0x2EE07A], ["NÍV. ALTO", 0xE0503C], ["NÍV. BAIXO", 0xFFD21F], ["RESISTÊNCIA", 0xFF8A1F], ["EMERGÊNCIA", 0xF2F3F4]].map(([t, c], i) => {
      const x = -0.34 + i * 0.17, m = mat(c, 0.1, 0.35, { emissive: c, emissiveIntensity: 0.05 });
      hinge.add(at(mesh(cylZ(0.034, 0.012, 24), bezel), dp(x, 0.3, DZ + 0.006)));
      hinge.add(at(mesh(cylZ(0.026, 0.02, 24), m), dp(x, 0.3, DZ + 0.016)));
      plate(t, x, 0.235, 0.15, "#E8E8E8", "#1F2328", 28); return m;
    });
    // botões: S.btn[nome] = { cap, z0 }
    S.btn = {};
    const pushbtn = (name, txt, x, y, col, big) => {
      const g = new T.Group(); g.position.copy(dp(x, y)); hinge.add(g);
      g.add(at(mesh(cylZ(big ? 0.068 : 0.04, 0.012, 28), big ? mat(0xE8C21C, 0.3, 0.5) : bezel), v3(0, 0, 0.006)));
      const cap = at(mesh(cylZ(big ? 0.05 : 0.027, big ? 0.036 : 0.022, 28), mat(col, 0.2, 0.4)), v3(0, 0, big ? 0.03 : 0.022)); g.add(cap);
      S.btn[name] = { cap, z0: cap.position.z, g };
      plate(txt, x, y - (big ? 0.1 : 0.068), big ? 0.17 : 0.13, "#E8E8E8", "#1F2328", 30);
      return g;
    };
    const press = (name, on) => { const b = S.btn[name]; if (b) b.cap.position.z = b.z0 - (on ? 0.012 : 0); };
    const pulse = (name, set) => { press(name, true); set(true); setTimeout(() => { press(name, false); set(false); }, 380); };
    const gl = pushbtn("liga", "LIGA", -0.12, -0.04, 0x1FA64A), gd = pushbtn("desl", "DESLIGA", 0.07, -0.04, 0xC0392B), ge = pushbtn("emerg", "EMERGÊNCIA", 0.31, -0.04, 0xD62718, true);
    S.clickables.push({ obj: gl, tag: "LIGA", fn: () => { const io = window.PLC && PLC.io; pulse("liga", v => { if (io) io.btn.X2 = v; if (window.MD) MD.liga = v; }); } });
    S.clickables.push({ obj: gd, tag: "DESLIGA", fn: () => { const io = window.PLC && PLC.io; pulse("desl", v => { if (io) io.btn.X3 = v; if (window.MD) MD.desl = v; }); } });
    S.clickables.push({ obj: ge, tag: "EMERGENCIA", fn: () => {
      S.ui.emerg = !S.ui.emerg; press("emerg", S.ui.emerg);
      tip(S.ui.emerg ? "<b>EMERGÊNCIA acionada</b>: bomba, válvula e resistência são desenergizadas na hora. O botão fica travado; clique de novo para destravar (rearme)." : "Emergência <b>rearmada</b>. A bancada pode ser ligada de novo.", S.ui.emerg ? "bad" : "");
    } });
    // seletor rotativo de painel (22 mm): aro cromado, colar, botão preto de lateral ranhurada e ponteiro com linha indicadora branca
    const knob3d = (par, z0) => {
      const chrome = mat(0xD3D8DD, 0.8, 0.28), blkK = mat(0x15181C, 0.25, 0.45), grv = mat(0x2C3036, 0.2, 0.55);
      par.add(at(mesh(cylZ(0.046, 0.008, 36), chrome), v3(0, 0, z0 + 0.004)));
      par.add(at(mesh(cylZ(0.039, 0.01, 36), mat(0x23272D, 0.3, 0.5)), v3(0, 0, z0 + 0.011)));
      const lv = new T.Group(); lv.position.set(0, 0, z0 + 0.016); par.add(lv);
      lv.add(at(mesh(new T.CylinderGeometry(0.027, 0.031, 0.024, 32).rotateX(Math.PI / 2), blkK), v3(0, 0, 0.012)));
      const rg = new T.InstancedMesh(new T.BoxGeometry(0.0035, 0.006, 0.02), grv, 20), m4 = new T.Matrix4(), q4 = new T.Quaternion(), zz = new T.Vector3(0, 0, 1), one = new T.Vector3(1, 1, 1);
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; q4.setFromAxisAngle(zz, a - Math.PI / 2); m4.compose(new T.Vector3(Math.cos(a) * 0.0305, Math.sin(a) * 0.0305, 0.012), q4, one); rg.setMatrixAt(i, m4); }
      lv.add(rg);
      lv.add(at(mesh(new T.BoxGeometry(0.02, 0.056, 0.012), blkK), v3(0, 0.016, 0.03)));       // ponteiro (lingueta)
      lv.add(at(mesh(cylZ(0.01, 0.012, 18), blkK), v3(0, 0.044, 0.03)));
      lv.add(at(mesh(new T.BoxGeometry(0.004, 0.05, 0.0015), mat(0xF2F3F4, 0.05, 0.5)), v3(0, 0.02, 0.0365)));   // linha branca
      return lv;
    };
    // seletora da resistência (2 posições): DESL / LIG
    { const g = new T.Group(); g.position.copy(dp(-0.31, -0.04)); hinge.add(g);
      const lv = knob3d(g, 0); S.selRes = lv; lv.rotation.z = 0.6;
      const lp = canvasTex(256, 120, c => { c.fillStyle = "#E8E8E8"; c.fillRect(0, 0, 256, 66); c.fillStyle = "#1F2328"; c.font = "bold 36px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("RESISTÊNCIA", 128, 34); c.fillRect(0, 66, 256, 54); c.fillStyle = "#fff"; c.font = "bold 30px Arial"; c.fillText("DESL ◄   ► LIG", 128, 94); });
      hinge.add(at(mesh(new T.PlaneGeometry(0.16, 0.075), new T.MeshBasicMaterial({ map: lp, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), dp(-0.31, -0.128)));   // uma só plaqueta (antes eram duas sobrepostas e piscavam)
      S.clickables.push({ obj: g, tag: "SELRES", fn: () => {
        S.ui.selRes = !S.ui.selRes; const P = S.proc;
        if (window.PLC && PLC.io) PLC.io.btn.X6 = S.ui.selRes;
        if (!(window.PLC && PLC.run) && P) { P.run = S.ui.selRes; if (P.run && P.trip) { if (P.T > P.lim - 5) { tip("O termostato de segurança ainda está atuado: espere a água esfriar alguns graus para rearmar.", "bad"); P.run = false; S.ui.selRes = false; } else P.trip = false; } }
        tip(S.ui.selRes ? "Seletora da resistência em <b>LIG</b>" + (window.PLC && PLC.run ? ": o sinal chega ao CLP em X6 (o programa decide se liga a resistência)." : ": o termostato mantém a água no setpoint.") : "Seletora da resistência em <b>DESL</b>.", "");
      } }); }
    // trilhos DIN e canaletas
    rail3d(pn, 0, 1.78, 0.78, [-0.37, 0, 0.37]); rail3d(pn, 0, 1.38, 0.78, [-0.37, -0.07, 0.3, 0.37]); rail3d(pn, -0.2, 1.04, 0.32, [-0.35, -0.05]);
    for (const y of [1.97, 1.58, 1.16]) duct3d(pn, 0, y, 0.78);
    // CLP DVP20SX2 (modelo baseado no equipamento real, em escala 2:1 para ficar legível)
    const PW = 0.16, PH = 0.2, PD = 0.11;
    S.plcScreen = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 640; const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return { c, t }; })();
    const plc = new T.Group(); plc.position.set(-0.2, 1.78, 0.04); pn.add(plc);
    const body = mat(0xE6E8EA, 0.05, 0.55);
    plc.add(at(mesh(new T.BoxGeometry(PW, PH, PD), body), v3(0, 0, PD / 2)));
    plc.add(at(mesh(new T.BoxGeometry(0.014, PH * 0.97, PD * 0.92), mat(0xD3D6D9, 0.05, 0.6)), v3(-PW / 2 - 0.007, 0, PD / 2)));
    for (let i = 0; i < 6; i++) plc.add(at(mesh(new T.BoxGeometry(0.002, PH * 0.6, 0.006), mat(0xBFC3C7)), v3(-PW / 2 - 0.0145, 0, 0.02 + i * 0.014)));
    for (const x of [-0.045, 0.045]) plc.add(at(mesh(new T.BoxGeometry(0.03, 0.014, 0.03), body), v3(x, PH / 2 + 0.007, PD * 0.55)));
    plc.add(at(mesh(new T.PlaneGeometry(PW, PH), new T.MeshStandardMaterial({ map: S.plcScreen.t, roughness: 0.55 }), false), v3(0, 0, PD + 0.0006)));
    // bornes verdes destacáveis
    const bt = canvasTex(128, 384, (g) => {
      g.fillStyle = "#2DBE4E"; g.fillRect(0, 0, 128, 384);
      for (let i = 0; i < 9; i++) { const y = 21 + i * 42.6;
        g.fillStyle = "#1E8A39"; g.fillRect(4, y - 19, 120, 2);
        g.fillStyle = "#145C27"; g.fillRect(14, y - 11, 34, 22);
        g.fillStyle = "#9AA0A6"; g.beginPath(); g.arc(88, y, 14, 0, 7); g.fill();
        g.strokeStyle = "#4A4F57"; g.lineWidth = 4; g.beginPath(); g.moveTo(80, y - 6); g.lineTo(96, y + 6); g.stroke(); }
    });
    const green = mat(0x2DBE4E, 0.05, 0.5), frontB = new T.MeshStandardMaterial({ map: bt, roughness: 0.5 });
    const P2 = (cx, cy) => v3((cx / 512 - 0.5) * PW, (0.5 - cy / 640) * PH, PD);
    const BL = [[262, 342, 84, 330], [262, 342, 350, 598], [408, 488, 84, 330], [408, 488, 350, 598]];
    const wireCols = [0x2F6DB5, 0x1F2328, 0xB83A2E, 0x2F6DB5, 0x6E7782];
    BL.forEach(([x0, x1, y0, y1], bi) => {
      const w = (x1 - x0) / 512 * PW, h = (y1 - y0) / 640 * PH, c = P2((x0 + x1) / 2, (y0 + y1) / 2);
      plc.add(at(mesh(new T.BoxGeometry(w, h, 0.018), [green, green, green, green, frontB, green]), v3(c.x, c.y, PD + 0.009)));
      // fios saindo dos bornes para a canaleta
      const up = bi % 2 === 0, yEdge = up ? c.y + h / 2 : c.y - h / 2, yTo = up ? 0.165 : -0.175;
      for (let k = 0; k < 3; k++) { const x = c.x - w * 0.3 + k * w * 0.3; pipe(v3(x, yEdge, PD + 0.012), v3(x, yTo, PD + 0.012), 0.0022, mat(wireCols[(bi + k) % wireCols.length], 0.1, 0.6), plc); }
    });
    S.plc3d = plc;
    drawPlc();
    // Contatores e relés de interface no trilho DIN: as janelas verdes indicam bobinas energizadas.
    S.coilLamps = {};
    const switchgear = (tag, x, y, kind) => {
      const contactor = kind === "contator", w = contactor ? 0.118 : 0.078, h = contactor ? 0.136 : 0.117, d = contactor ? 0.11 : 0.062;
      const g = new T.Group(); g.position.set(x, y, 0.04); pn.add(g);
      const shell = mat(contactor ? 0xDDE1E5 : 0xD6DCE1, 0.05, 0.72), dark = mat(0x252B31, 0.05, 0.72), metal = mat(0xAEB6BE, 0.35, 0.42), copper = mat(0xB96F32, 0.25, 0.48);
      g.add(at(mesh(new T.BoxGeometry(w, h, d), shell), v3(0, 0, d / 2)));
      // Terminais embutidos com parafusos 3D; as coordenadas coincidem com as pontas dos fios.
      const screw = (sx, sy, sw = 0.024) => {
        g.add(at(mesh(new T.BoxGeometry(sw, 0.022, 0.006), dark), v3(sx, sy, d + 0.002)));
        g.add(at(mesh(cylZ(0.006, 0.004, 12), metal), v3(sx, sy, d + 0.007)));
        const slot = at(mesh(new T.BoxGeometry(0.007, 0.0015, 0.001), dark), v3(sx, sy, d + 0.0095)); slot.rotation.z = Math.PI / 4; g.add(slot);
      };
      const rows = contactor ? [[0.022, [-0.024, 0, 0.024]], [-0.050, [-0.024, 0, 0.024]]] : [[0.047, [-0.012, 0.012]], [-0.047, [-0.012, 0.012]]];
      rows.forEach(([sy, xs]) => xs.forEach(sx => screw(sx, sy, contactor ? 0.022 : 0.018)));
      let lamp;
      if (contactor) {
        // Frente do contator: câmara de acionamento, armadura móvel e janela de estado.
        g.add(at(mesh(new T.BoxGeometry(w * 0.72, h * 0.47, 0.008), dark), v3(0, -0.012, d + 0.004)));
        g.add(at(mesh(new T.BoxGeometry(w * 0.31, h * 0.18, 0.012), mat(0xB9C0C6, 0.15, 0.55)), v3(-0.004, -0.012, d + 0.014)));
        g.add(at(mesh(new T.BoxGeometry(0.012, 0.018, 0.012), mat(0x555D65, 0.2, 0.6)), v3(0.015, 0.006, d + 0.015)));
        lamp = new T.MeshStandardMaterial({ color: 0x344039, emissive: 0x000000 });
        g.add(at(mesh(new T.BoxGeometry(0.012, 0.008, 0.006), lamp), v3(0.034, -0.026, d + 0.012)));
        // Bobina A1/A2 no alto do contator.
        for (const sx of [-0.014, 0.014]) screw(sx, 0.055, 0.014);
      } else {
        // Relé de interface: base, bobina de cobre e tampa âmbar transparente.
        g.add(at(mesh(cylX(0.009, 0.026, 16), copper), v3(0, 0.004, d * 0.63)));
        g.add(at(mesh(new T.BoxGeometry(0.009, h * 0.35, 0.008), metal), v3(0.011, -0.004, d * 0.7)));
        const cover = new T.MeshStandardMaterial({ color: 0xD89145, transparent: true, opacity: 0.42, roughness: 0.28, metalness: 0.05, depthWrite: false });
        g.add(at(mesh(new T.BoxGeometry(w * 0.78, h * 0.56, d * 0.55), cover, false, false), v3(0, -0.002, d * 0.77)));
        lamp = new T.MeshStandardMaterial({ color: 0x38433A, emissive: 0x000000 });
        g.add(at(mesh(new T.SphereGeometry(0.005, 10, 8), lamp), v3(-0.018, -0.036, d + 0.012)));
        g.add(at(mesh(new T.BoxGeometry(0.012, 0.012, 0.006), mat(0xE77B27, 0.05, 0.62)), v3(0.012, -0.036, d + 0.012)));
      }
      const label = canvasTex(240, 64, c => { c.fillStyle = "#F0CF18"; c.fillRect(0, 0, 240, 64); c.fillStyle = "#111"; c.font = "bold 34px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(tag, 120, 32); });
      g.add(at(mesh(new T.PlaneGeometry(w * 1.3, 0.014), new T.MeshBasicMaterial({ map: label, toneMapped: false }), false), v3(0, -h / 2 - 0.009, d + 0.012)));
      // engate no trilho (aba laranja), frestas de ventilação e bloco de contato auxiliar
      g.add(at(mesh(new T.BoxGeometry(0.034, 0.012, 0.014), mat(0xE0731B, 0.15, 0.6)), v3(0, -h / 2 - 0.005, 0.012)));
      for (let i = 0; i < 3; i++) g.add(at(mesh(new T.BoxGeometry(w * 0.46, 0.0028, 0.002), dark), v3(0, h * 0.5 - 0.008 - i * 0.0065, d + 0.0005)));
      if (contactor) { g.add(at(mesh(new T.BoxGeometry(0.024, h * 0.62, d * 0.62), mat(0xC4CAD0, 0.05, 0.65)), v3(w / 2 + 0.012, 0, d * 0.42))); g.add(at(mesh(new T.BoxGeometry(0.018, 0.012, 0.002), dark), v3(w / 2 + 0.012, 0.012, d * 0.73 + 0.0006))); }
      S.coilLamps[tag] = lamp;
      return g;
    };
    switchgear("K1 · BOMBA", 0.22, 1.78, "contator");
    breaker3d(pn, 0.01, 1.78, 3, "QM1");
    switchgear("KA1 · BOMBA", -0.30, 1.38, "rele");
    switchgear("KA2 · RES", -0.18, 1.38, "rele");
    switchgear("K2 · RES", 0.08, 1.38, "contator");
    S.k1Lamp = S.coilLamps["K1 · BOMBA"];
    // Fiação guiada pelas canaletas: os trechos internos ficam ocultos; só aparecem entradas, derivações e terminais.
    const wireM = [0x24282D, 0x6B4226, 0x2F8FD6, 0x2F8FD6, 0x6B4226].map(c => mat(c, 0, 0.72));   // preto, marrom e azul como nos quadros reais
    const yelM = mat(0xF4F4F4, 0.05, 0.6), ferM = mat(0xC9CED3, 0.7, 0.3), tieB = mat(0x15181C, 0.1, 0.7);
    const wireEnds = (pts, radius) => {       // ponteira metálica na ponta e marcador amarelo de identificação perto do terminal
      for (const [i, j] of [[0, 1], [pts.length - 1, pts.length - 2]]) {
        const a = v3(pts[i][0], pts[i][1], pts[i][2]), dir = v3(pts[j][0], pts[j][1], pts[j][2]).sub(a).normalize();
        const mk = mesh(new T.CylinderGeometry(radius * 1.55, radius * 1.55, 0.008, 8), yelM); mk.position.copy(a).addScaledVector(dir, 0.022); orientY(mk, dir); pn.add(mk);
        const fe = mesh(new T.CylinderGeometry(radius * 1.25, radius * 1.25, 0.008, 8), ferM); fe.position.copy(a).addScaledVector(dir, 0.004); orientY(fe, dir); pn.add(fe);
        const fl = mesh(new T.BoxGeometry(0.0016, 0.012, 0.007), yelM); fl.position.copy(a).addScaledVector(dir, 0.026); fl.position.x += radius * 2.4; pn.add(fl);   // bandeirola de identificação
        const tb = mesh(new T.CylinderGeometry(radius * 1.45, radius * 1.45, 0.0025, 8), tieB); tb.position.copy(a).addScaledVector(dir, 0.062); orientY(tb, dir); pn.add(tb);   // abraçadeira
      }
    };
    const wire = (pts, color, radius = 0.0022) => {
      const curve = new T.CatmullRomCurve3(pts.map(p => v3(p[0], p[1], p[2])), false, "centripetal");
      pn.add(mesh(new T.TubeGeometry(curve, Math.max(16, pts.length * 8), radius, 6, false), color, false, false));
      wireEnds(pts, radius);
    };
    const phases = [-0.024, 0, 0.024], phaseMat = [wireM[0], wireM[1], wireM[2]], faceZ = 0.160, relayFaceZ = 0.113, ductZ = 0.055, ductFaceZ = 0.088;
    phases.forEach((dx, i) => {
      const x = 0.22 + dx, top = 1.78 + 0.022, bottom = 1.78 - 0.050;
      wire([[0.34 + i * 0.012, 2.10, 0.12], [0.34 + i * 0.012, 2.00, ductFaceZ], [0.34 + i * 0.012, 1.97, ductZ], [x, 1.97, ductZ], [x, 1.94, ductFaceZ], [x, top, faceZ]], phaseMat[i], 0.0032);
      const outX = 0.15 + i * 0.02;
      wire([[x, bottom, faceZ], [x, 1.61, ductFaceZ], [x, 1.58, ductZ], [outX, 1.58, ductZ], [outX, 1.55, ductFaceZ], [outX, 1.19, ductFaceZ], [outX, 1.16, ductZ], [outX, 1.13, ductFaceZ], [outX, 0.84, 0.14]], phaseMat[i], 0.0032);
      const k2x = 0.08 + dx;
      wire([[x, top, faceZ], [x, 1.61, ductFaceZ], [x, 1.58, ductZ], [k2x, 1.58, ductZ], [k2x, 1.61, ductFaceZ], [k2x, 1.46, ductFaceZ], [k2x, 1.38 + 0.022, faceZ]], phaseMat[i], 0.0028);
      const k2out = 0.145 + i * 0.02;
      wire([[k2x, 1.38 - 0.050, faceZ], [k2x, 1.19, ductFaceZ], [k2x, 1.16, ductZ], [k2out, 1.16, ductZ], [k2out, 1.13, ductFaceZ], [k2out, 0.84, 0.14]], phaseMat[i], 0.0028);
    });
    // Y0/Y4 acionam KA1/KA2; os contatos dos relés alimentam as bobinas de K1/K2.
    const controlZ = relayFaceZ;
    [[-0.30, wireM[3], wireM[4]], [-0.18, wireM[3], wireM[4]]].forEach(([rx, pos, neg], n) => {
      const topY = 1.38 + 0.047, botY = 1.38 - 0.047;
      const x1 = rx - 0.012, x2 = rx + 0.012, plcX = -0.145 + n * 0.025;
      wire([[plcX, 1.73, 0.16], [plcX, 1.61, ductFaceZ], [plcX, 1.58, ductZ], [x1, 1.58, ductZ], [x1, 1.61, ductFaceZ], [x1, topY, controlZ]], pos, 0.0018);
      wire([[plcX + 0.018, 1.73, 0.16], [plcX + 0.018, 1.61, ductFaceZ], [plcX + 0.018, 1.58, ductZ], [x2, 1.58, ductZ], [x2, 1.61, ductFaceZ], [x2, topY, controlZ]], neg, 0.0018);
      const targetX = n ? 0.08 : 0.22, targetY = n ? 1.38 + 0.055 : 1.78 + 0.055;
      const tx1 = targetX - 0.014, tx2 = targetX + 0.014;
      if (!n) {
        wire([[x1, botY, controlZ], [x1, 1.61, ductFaceZ], [x1, 1.58, ductZ], [tx1, 1.58, ductZ], [tx1, 1.61, ductFaceZ], [tx1, targetY, faceZ]], pos, 0.0018);
        wire([[x2, botY, controlZ], [x2, 1.61, ductFaceZ], [x2, 1.58, ductZ], [tx2, 1.58, ductZ], [tx2, 1.61, ductFaceZ], [tx2, targetY, faceZ]], neg, 0.0018);
      } else {
        wire([[x1, botY, controlZ], [x1, 1.19, ductFaceZ], [x1, 1.16, ductZ], [tx1, 1.16, ductZ], [tx1, 1.19, ductFaceZ], [tx1, targetY, faceZ]], pos, 0.0018);
        wire([[x2, botY, controlZ], [x2, 1.19, ductFaceZ], [x2, 1.16, ductZ], [tx2, 1.16, ductZ], [tx2, 1.19, ductFaceZ], [tx2, targetY, faceZ]], neg, 0.0018);
      }
    });
    // painel do inversor de frequência, ao lado do painel do CLP
    const dg = new T.Group(); dg.position.set(-1.0, 0, 0); pn.add(dg); S.drvPanel = dg;
    dg.add(at(mesh(new T.BoxGeometry(0.9, 1.3, 0.02), cab), v3(0, 1.45, 0.01)));
    for (const sx of [-1, 1]) dg.add(at(mesh(new T.BoxGeometry(0.02, 1.3, 0.32), cab), v3(sx * 0.44, 1.45, 0.16)));
    for (const y of [2.09, 0.81]) dg.add(at(mesh(new T.BoxGeometry(0.9, 0.02, 0.32), cab), v3(0, y, 0.16)));
    dg.add(at(mesh(new T.BoxGeometry(0.84, 1.24, 0.01), mat(0xD8651B, 0.12, 0.42)), v3(0, 1.45, 0.025)));
    for (const y of [1.97, 1.2]) duct3d(dg, 0, y, 0.78);
    rail3d(dg, 0, 1.6, 0.78, [-0.37, 0.37]); rail3d(dg, -0.03, 0.98, 0.3, [-0.16, 0.1]);
    cabinetShell(dg, 1.45, 1.3); plateScrews(dg, 1.45); earthBar(dg, 0.0, 0.87);
    vduct3d(dg, -0.395, 0.86, 2.04); vduct3d(dg, 0.395, 0.86, 2.04);
    dg.add(at(mesh(new T.PlaneGeometry(0.42, 0.06), new T.MeshBasicMaterial({ map: canvasTex(560, 80, (c) => { c.fillStyle = "#1F2328"; c.fillRect(0, 0, 560, 80); c.fillStyle = "#fff"; c.font = "bold 34px Arial"; c.textAlign = "center"; c.fillText("PAINEL DE INVERSORES", 280, 52); }) }), false), v3(0, 2.17, 0.02)));
    terminalStrip(dg, -0.16, 0.98, [3, 1, 1, 0, 0, 0, 0, 2, 2, 0, 0, 0, 3]);
    S.drv3d = {}; S.clickables = S.clickables || [];
    const DRV_TIP = {
      pf525: "Inversor <b>PowerFlex 525</b>: clique nas <b>teclas do próprio inversor</b> (Esc, Sel, ↵, setas, Start verde, Stop vermelho e o potenciômetro). O checklist e a próxima tecla ficam no painel ao lado.",
      atv12: "Inversor <b>Altivar ATV12</b>: <b>MODE</b> troca REF/MON/CONF; no <b>botão giratório</b>, clique à esquerda/direita para girar e no centro para <b>ENT</b> (segure 2 s quando pedir). RUN e STOP ficam na tampa oval.",
      cfw500: "Inversor <b>WEG CFW500</b>: <b>MENU/ENTER</b> entra e salva, <b>BACK/ESC</b> volta, ▲▼ navegam. <b>I</b> gira e <b>O</b> para. O checklist e a próxima tecla ficam no painel ao lado.",
    };
    const mkDrive = (key, x, w, h, d, body) => {
      const g = new T.Group(); g.position.set(x, 1.6, 0.04); dg.add(g);
      g.add(at(mesh(new T.BoxGeometry(w, h, d), mat(body, 0.25, 0.55)), v3(0, 0, d / 2)));
      const pf = key === "pf525";
      if (pf) g.add(at(mesh(new T.BoxGeometry(w * 0.98, h * 0.42, 0.012), mat(0xD9DBDD, 0.05, 0.6)), v3(0, -h * 0.29, d + 0.004)));
      for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) g.add(at(mesh(new T.BoxGeometry(0.004, h * 0.5, 0.006), mat(0x2A2D32, 0.3, 0.6)), v3(sx * (w / 2 + 0.002), h * 0.08, 0.03 + i * (d - 0.04) / 8)));
      g.add(at(mesh(new T.BoxGeometry(w + 0.03, h + 0.02, 0.006), M.alu), v3(0, 0, 0.003)));
      const D = window.DRV && window.DRV.list[key], FW = (D && D.FW) || 400, FH = (D && D.FH) || 855;
      const scr = (() => { const c = document.createElement("canvas"); c.width = FW; c.height = FH; const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return { c, t }; })();
      const front = at(mesh(new T.PlaneGeometry(w * 0.98, h * 0.98), new T.MeshStandardMaterial({ map: scr.t, roughness: 0.5 }), false), v3(0, 0, d + (pf ? 0.0115 : 0.002))); g.add(front);
      // cabos de saída do inversor descendo para a canaleta
      for (let k = 0; k < 3; k++) pipe(v3(-0.03 + k * 0.03, -h / 2, d * 0.6), v3(-0.03 + k * 0.03, 1.23 - 1.6, d * 0.6), 0.0035, mat([0x1F2328, 0x6E4A2C, 0x6E7782][k], 0.1, 0.6), g);
      S.drv3d[key] = { g, front, scr, h };
      if (D) D.paint3D(scr.c);
      S.clickables.push({ obj: g, tag: key, fn: (hit, ev) => {
        const DD = window.DRV && window.DRV.list[key];
        // painel do inversor aberto: o clique na frente aperta a tecla correspondente
        if (DD && window.isVfdDockOpen && window.isVfdDockOpen() === key && hit && hit.object === front && hit.uv) { const k = DD.pressAt(hit.uv.x, hit.uv.y, ev); if (k) { DD.paint3D(scr.c); scr.t.needsUpdate = true; return; } }
        if (window.openVfd) window.openVfd(key); else goView("inv-" + key);
        tip(DRV_TIP[key], "");
      } });
    };
    mkDrive("pf525", 0.28, 0.13, 0.27, 0.17, 0x1B1D21);
    mkDrive("atv12", 0, 0.14, 0.252, 0.15, 0xE2E4E6);
    mkDrive("cfw500", -0.28, 0.135, 0.353, 0.17, 0x3B4047);
    S.vfd = S.drv3d.pf525.g; S.vfdFront = S.drv3d.pf525.front; S.vfdScreen = S.drv3d.pf525.scr;
    // seletora de partida na porta, 4 posições: DIRETA (K1) / PF525 / ATV12 / CFW500
    const selG = new T.Group(); selG.position.set(-0.45, -0.42, 0.012); hinge.add(selG);
    selG.add(at(mesh(new T.PlaneGeometry(0.22, 0.075), new T.MeshBasicMaterial({ map: canvasTex(440, 150, (c) => { c.fillStyle = "#1F2328"; c.fillRect(0, 0, 440, 150); c.fillStyle = "#fff"; c.font = "bold 28px Arial"; c.textAlign = "center"; c.fillText("PARTIDA DA BOMBA", 220, 36); c.font = "bold 22px Arial"; [["DIRETA", 52, 96], ["PF525", 160, 82], ["ATV12", 280, 82], ["CFW500", 388, 96]].forEach(([t, x, y]) => c.fillText(t, x, y)); }) }), false), v3(0, 0.085, 0)));
    S.selHandle = knob3d(selG, 0.002);
    S.clickables.push({ obj: selG, tag: "SELETORA", fn: () => {
      const DV = window.DRV; if (!DV) return; const o = Object.keys(DV.names); DV.setSel(o[(o.indexOf(DV.sel) + 1) % o.length]);
      tip(DV.sel === "direta" ? "Seletora em <b>DIRETA</b>: a bomba parte pelo contator K1, direto na rede, em 60 Hz e sem rampa." : `Seletora em <b>${DV.names[DV.sel]}</b>: a bomba parte por este inversor, com rampa e velocidade ajustável. Toque nele, no painel de inversores, para abrir a IHM.`, ""); renderHud(); } });
    // fonte 24 V e régua de bornes
    psu(pn, 0.27, 1.38);
    terminalStrip(pn, -0.33, 1.04, [3, 1, 1, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3]);
    S.panel = pn;
    { const ih = pn.children.indexOf(hinge); S.panelInterior = pn.children.slice(ih + 1).filter(c => c !== dg && !(c.userData && c.userData.ext)); }   // interior do quadro do CLP: só desenhado com a porta aberta
    // eletrocalha
    // eletrocalha galvanizada suspensa no forro (tirantes) e eletrodutos cinza-escuro até os instrumentos
    const galv = mat(0xB4BCC4, 0.75, 0.38), TY = 2.72;
    const trayX = (x0, x1, z) => { const L = x1 - x0, cx = (x0 + x1) / 2; root.add(at(mesh(new T.BoxGeometry(L, 0.006, 0.2), galv), v3(cx, TY, z))); for (const dz of [-0.1, 0.1]) root.add(at(mesh(new T.BoxGeometry(L, 0.06, 0.006), galv), v3(cx, TY + 0.03, z + dz))); };
    const trayZ = (z0, z1, x) => { const L = z1 - z0, cz = (z0 + z1) / 2; root.add(at(mesh(new T.BoxGeometry(0.2, 0.006, L), galv), v3(x, TY, cz))); for (const dx of [-0.1, 0.1]) root.add(at(mesh(new T.BoxGeometry(0.006, 0.06, L), galv), v3(x + dx, TY + 0.03, cz))); };
    const rodM = mat(0x8A939C, 0.7, 0.4);
    for (const x of [-4.2, -3.2, -2.2, -1.2]) for (const dz of [-0.1, 0.1]) { root.add(at(mesh(new T.CylinderGeometry(0.005, 0.005, 3.2 - TY, 8), rodM), v3(x, (3.2 + TY) / 2, -1.2 + dz))); root.add(at(mesh(new T.BoxGeometry(0.03, 0.01, 0.24), rodM), v3(x, TY - 0.008, -1.2))); }
    for (const x of [-2.9, -1.9, -0.95]) for (const dz of [-0.1, 0.1]) { root.add(at(mesh(new T.CylinderGeometry(0.005, 0.005, 3.2 - TY, 8), rodM), v3(x, (3.2 + TY) / 2, -1.2 + dz))); root.add(at(mesh(new T.BoxGeometry(0.03, 0.01, 0.24), rodM), v3(x, TY - 0.008, -1.2))); }
    // eletrocalha + cabos: os cabos saem do TOPO DO QUADRO (prensa-cabos), sobem pela descida da calha, correm DENTRO da calha lado a lado e saem por baixo (gravidade) sobre cada peça. Entradas das derivações são vãos nas paredes da calha principal (T limpo, sem sobreposição).
    const unid = mat(0x8A939C, 0.8, 0.35), bush = mat(0x2B2F36, 0.3, 0.6), tieM = mat(0xDADDE0, 0.1, 0.6);
    const tieMatD = tieM.clone(); tieMatD.side = T.DoubleSide;
    const CR = 0.0045;                                   // raio do cabo (fino)
    const YT = TY + 0.0075;                              // altura do cabo deitado no fundo da calha
    const ZB = -0.52, XL = { LSH: 2.31, TSH: 2.326, LSL: 2.342, VY: 2.358 };   // faixas do feixe (bancada): quem se separa mais alto fica à esquerda
    const BR = { front: 2.334 + DX, te: 2.03 + DX, tz: 1.9 + DX };            // x (mundo) das derivações
    const RX = -4.897;                                                         // chapa de fundo da descida da calha (mundo)
    // ---- calha principal (fundo + paredes com vãos nas derivações) e descida até o quadro
    { const x0 = -4.9, x1 = 2.55 + DX, W = 0.2, cx = (x0 + x1) / 2, L = x1 - x0;
      root.add(at(mesh(new T.BoxGeometry(L, 0.006, W), galv), v3(cx, TY, -1.2)));
      const wall = (z, gaps) => { let a = x0; const g = gaps.slice().sort((p, q) => p[0] - q[0]); for (const [g0, g1] of [...g, [x1, x1]]) { if (g0 > a) root.add(at(mesh(new T.BoxGeometry(g0 - a, 0.06, 0.006), galv), v3((a + g0) / 2, TY + 0.03, z))); a = g1; } };
      wall(-1.3, [[BR.tz - 0.07, BR.tz + 0.07]]);
      wall(-1.1, [[BR.te - 0.07, BR.te + 0.07], [BR.front - 0.07, BR.front + 0.07]]);
      const H = TY - 2.1;                                     // descida: chapa de fundo + paredes laterais, apoiada no topo do quadro
      root.add(at(mesh(new T.BoxGeometry(0.006, H, W), galv), v3(RX, (TY + 2.1) / 2, -1.2)));
      for (const dz of [-0.1, 0.1]) root.add(at(mesh(new T.BoxGeometry(0.06, H, 0.006), galv), v3(RX + 0.03, (TY + 2.1) / 2, -1.2 + dz)));
      // placa de entrada de cabos no topo do quadro
      root.add(at(mesh(new T.BoxGeometry(0.1, 0.012, 0.26), mat(0x5E656D, 0.3, 0.5)), v3(RX + 0.05, 2.1, -1.2))); }
    const trayBr = (xw, zA, zB2, w) => {                      // derivação: começa no vão da parede da calha principal
      const L = Math.abs(zB2 - zA), cz = (zA + zB2) / 2;
      root.add(at(mesh(new T.BoxGeometry(w, 0.006, L), galv), v3(xw, TY, cz)));
      for (const dx of [-w / 2, w / 2]) { root.add(at(mesh(new T.BoxGeometry(0.006, 0.06, L), galv), v3(xw + dx, TY + 0.03, cz))); root.add(at(mesh(new T.CylinderGeometry(0.005, 0.005, 3.2 - TY, 8), rodM), v3(xw + dx, (3.2 + TY) / 2, zB2))); }
      root.add(at(mesh(new T.BoxGeometry(w + 0.02, 0.01, 0.024), rodM), v3(xw, TY - 0.008, zB2)));
    };
    trayBr(BR.front, -1.1, -0.44, 0.11);        // frente do tanque (boias, termostato, solenoide)
    trayBr(BR.te, -1.1, -0.9, 0.12);            // tampa (TE/TT)
    trayBr(BR.tz, -1.3, -1.5, 0.12);            // atrás do tanque (resistência)
    S.conduits = []; S.cab = {};
    const ZIN = { "VY-01": -1.262, "LSL-101": -1.246, "TSH-104": -1.23, "LSH-101": -1.214, "TZ-104": -1.28, "TE-104": -1.17, "BOMBA": -1.14 };   // faixas dentro da calha (sem cruzamentos)
    // glândulas no topo do quadro (um por cabo)
    for (const t in ZIN) root.add(at(mesh(new T.CylinderGeometry(0.0095, 0.0095, 0.022, 14), bush), v3(RX + 0.0165, 2.117, ZIN[t])));
    const v = (x, y, z) => v3(x, y, z);
    const XR = RX + 0.003 + CR - DX;                          // x (bancada) do cabo na descida
    // trechos reutilizáveis (coordenadas da bancada): sobe pela descida e dobra para dentro da calha; dobra no plano xz; desce
    const arc = (cx, cy, r, a0, a1, f, n = 4) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push(f(cx + r * Math.cos(a), cy + r * Math.sin(a))); } return o; };
    const riseTo = (zi) => [v(XR, 2.1, zi), v(XR, 2.3, zi), v(XR, TY - 0.38, zi), ...arc(XR + 0.11, YT - 0.11, 0.11, Math.PI, Math.PI / 2, (x, y) => v(x, y, zi))];   // sobe e entra deitado na calha
    const turnZ = (xl, zi, dir, rt = 0.1) => { const o = []; for (let i = 0; i <= 4; i++) { const f = (Math.PI / 2) * i / 4; o.push(v(xl - rt + rt * Math.sin(f), YT, zi + dir * (rt - rt * Math.cos(f)))); } return o; };           // curva em planta (+z ou -z)
    const dropAt = (x, zi, rd = 0.06) => [...arc(x - rd, YT - rd, rd, Math.PI / 2, 0, (xx, y) => v(xx, y, zi)), v(x, TY - 0.25, zi)];       // do trilho horizontal para baixo
    const tie = (g, p, dir, sx, sz) => {     // enforca-gato: fita elíptica fina + cabeça e rabicho (sx, sz = escalas locais)
      const o = new T.Group(); o.position.copy(p); o.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.clone().normalize()); g.add(o);
      const band = mesh(new T.CylinderGeometry(1, 1, 0.0035, 18, 1, true), tieMatD); band.scale.set(sx, 1, sz); o.add(band);
      o.add(at(mesh(new T.BoxGeometry(0.0065, 0.0045, 0.0045), tieM), v3(sx, 0, 0)));
      const tail = at(mesh(new T.BoxGeometry(0.011, 0.0009, 0.0022), tieM), v3(sx + 0.007, 0, 0.002)); tail.rotation.y = 0.5; o.add(tail);
    };
    const dispose = g => g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    const makeCable = (tag, ptsBench, o = {}) => {
      S.conduits = S.conduits.filter(c => { if (c.tag === tag) { root.remove(c.g); dispose(c.g); return false; } return true; });
      const pts = ptsBench.map(p => p.clone().add(v3(DX, 0, 0)));
      const curve = new T.CatmullRomCurve3(pts, false, "centripetal"), len = curve.getLength();
      const g = new T.Group(); root.add(g);
      g.add(mesh(new T.TubeGeometry(curve, Math.min(1100, Math.max(80, Math.ceil(len / 0.01))), CR, 8, false), M.conduit));
      const e = pts[pts.length - 1], d = curve.getTangent(1).normalize();
      const u2 = new T.Group(); u2.position.copy(e); u2.quaternion.setFromUnitVectors(v3(0, 1, 0), d); g.add(u2);   // conexão rosqueada no prensa-cabo
      u2.add(at(mesh(new T.CylinderGeometry(0.0072, 0.0072, 0.02, 14), unid), v3(0, -0.01, 0)));
      u2.add(at(mesh(new T.CylinderGeometry(0.0088, 0.0088, 0.006, 6), unid), v3(0, -0.002, 0)));
      S.conduits.push({ tag, g, always: !!o.always });
      S.cab[tag] = { samples: curve.getSpacedPoints(Math.max(30, Math.ceil(len / 0.03))).map(p => ({ p })), lane: o.lane, yPeel: o.yPeel == null ? -1 : o.yPeel, zi: ZIN[tag] };
      return g;
    };
    // enforca-gatos só onde há 2 ou mais cabos juntos: na descida, na calha principal e no feixe do tanque; refeitos a cada peça instalada
    const BUNDLE = ["LSH-101", "TSH-104", "LSL-101", "VY-01"];
    const buildBundleTies = () => {
      if (S.bundleTies) { root.remove(S.bundleTies); dispose(S.bundleTies); S.conduits = S.conduits.filter(c => c.g !== S.bundleTies); }
      const g = new T.Group(); root.add(g); S.bundleTies = g; S.conduits.push({ tag: "__ties", g, always: true });
      const vis = Object.keys(ZIN).filter(t => S.cab[t] && (t === "TZ-104" || t === "BOMBA" || S.installed[t])); if (vis.length < 2) return;
      const zs = vis.map(t => ZIN[t]), zlo = Math.min(...zs), zhi = Math.max(...zs), zc = (zlo + zhi) / 2, zw = (zhi - zlo) / 2 + CR + 0.0018;
      for (const y of [2.22, 2.4, 2.58]) tie(g, v(RX + 0.003 + CR, y, zc), v(0, 1, 0), CR + 0.0018, zw);                       // descida
      const xs = vis.map(t => (S.cab[t].lane != null ? S.cab[t].lane : 1.3) + DX);                                                     // fim da faixa comum na calha principal
      for (let x = -4.4; x < 1.2 + DX + 3.65 - 3.65; x += 0.55) { const run = vis.filter(t => (S.cab[t].lane != null ? S.cab[t].lane : (t === "BOMBA" ? 1.3 : t === "TE-104" ? 2.03 : 1.9)) + DX > x + 0.1); if (run.length < 2) continue; const zz = run.map(t => ZIN[t]), a = Math.min(...zz), b = Math.max(...zz); tie(g, v(x, YT, (a + b) / 2), v(1, 0, 0), CR + 0.0018, (b - a) / 2 + CR + 0.0018); }   // calha principal
      const act = BUNDLE.filter(t => S.cab[t] && S.installed[t]); if (act.length < 2) return;
      for (let yT = 2.5; yT > 0.85; yT -= 0.19) {                                                                                      // feixe vertical da frente
        const run = act.filter(t => S.cab[t].yPeel < yT - 0.06); if (run.length < 2) continue;
        const lanes = run.map(t => S.cab[t].lane), lo = Math.min(...lanes), hi = Math.max(...lanes);
        tie(g, v((lo + hi) / 2 + DX, yT, ZB), v(0, 1, 0), (hi - lo) / 2 + CR + 0.0018, CR + 0.0018);
      }
    };
    // ponta do cabo = prensa-cabo da peça (posição final, mesmo durante a animação de encaixe)
    const glandOf = (part, pick) => {
      const gl = []; part.traverse(o => { if (o.userData && o.userData.gland === true) gl.push(o); }); const go = pick ? pick(gl) : gl[0]; if (!go) return null;
      const keep = part.position.clone(); if (part.userData.anim) part.position.copy(part.userData.anim.to); part.updateWorldMatrix(true, true);
      const tip = root.worldToLocal(go.localToWorld(v3(0, 0.057, 0))), q = go.getWorldQuaternion(new T.Quaternion()), dir = v3(0, 1, 0).applyQuaternion(q).normalize();
      part.position.copy(keep); part.updateWorldMatrix(true, true);
      return { tip: tip.sub(v3(DX, 0, 0)), dir };
    };
    // frente do tanque: calha principal -> curva em planta para a derivação -> desce em feixe -> abre na altura da peça
    const front = (tag, lane, gl) => {
      const { tip, dir } = gl, down = dir.y < -0.5, yP = down ? tip.y - 0.13 : tip.y, mx = (lane + tip.x) / 2, sag = 0.012 + 0.03 * Math.abs(lane - tip.x), zi = ZIN[tag];
      const tray = [...riseTo(zi), v(lane - 0.6, YT, zi), ...turnZ(lane, zi, +1), v(lane, YT, ZB - 0.14)];
      // curva em perfil (z,y): do trilho horizontal (+z) para descer em ZB
      const bend = []; for (let i = 0; i <= 4; i++) { const a = (Math.PI / 2) * i / 4; bend.push(v(lane, YT - 0.1 + 0.1 * Math.cos(a), ZB - 0.1 + 0.1 * Math.sin(a))); }
      const top = [...tray, ...bend, v(lane, TY - 0.45, ZB), v(lane, yP + 0.34, ZB), v(lane, yP + 0.14, ZB), v(lane - 0.03, yP + 0.03, ZB), v(mx, yP - sag, ZB)];
      const end = down
        ? [v(tip.x + 0.05, yP - 0.004, ZB), v(tip.x + 0.006, yP, ZB - 0.03), v(tip.x, yP + 0.006, tip.z + 0.02), v(tip.x, tip.y - 0.05, tip.z), tip]
        : [v(tip.x + 0.06, yP - 0.004, ZB), v(tip.x + 0.014, yP, ZB - 0.012), v(tip.x, yP, tip.z + 0.045), tip];
      makeCable(tag, [...top, ...end], { lane, yPeel: yP });
    };
    S.rebuildCables = (tag) => {
      const part = S.parts[tag];
      if ((tag === "LSH-101" || tag === "LSL-101" || tag === "TSH-104") && part) { const gl = glandOf(part); if (gl) front(tag, tag === "LSH-101" ? XL.LSH : tag === "LSL-101" ? XL.LSL : XL.TSH, gl); buildBundleTies(); }
      else if ((tag === "TE-104" || tag === "TT-104") && S.parts["TE-104"]) {
        const gl = S.parts["TT-104"] ? glandOf(S.parts["TT-104"]) : glandOf(S.parts["TE-104"]); if (!gl) return;
        const { tip } = gl, x0 = 2.03, z0 = tip.z, zi = ZIN["TE-104"];
        makeCable("TE-104", [...riseTo(zi), v(x0 - 0.6, YT, zi), ...turnZ(x0, zi, +1, 0.05), v(x0, YT, z0 - 0.07), ...dropAtZ(x0, z0), v(x0, tip.y + 0.5, z0), v(x0, tip.y + 0.17, z0), v(x0 - 0.02, tip.y + 0.04, z0), v(x0 - 0.06, tip.y - 0.008, z0), v((x0 + tip.x) / 2, tip.y - 0.012, z0), v(tip.x + 0.05, tip.y - 0.003, z0), tip], { lane: undefined });
        buildBundleTies();
      } else if (tag === "VY-01") buildBundleTies();
    };
    // desce em perfil (z,y) a partir do trilho horizontal que segue em +z
    function dropAtZ(x, zEnd) { const o = []; for (let i = 0; i <= 4; i++) { const a = (Math.PI / 2) * i / 4; o.push(v(x, YT - 0.06 + 0.06 * Math.cos(a), zEnd - 0.06 + 0.06 * Math.sin(a))); } return o; }
    // cabos fixos: resistência TZ-104 (por trás do tanque), motor da bomba e solenoide VY-01
    const tzE = v3(1.9, 0.675, -1.355);
    { const zi = ZIN["TZ-104"], xd = 1.9;       // curva em planta para -z, depois desce pela derivação de trás
      const tt = []; for (let i = 0; i <= 4; i++) { const f = (Math.PI / 2) * i / 4; tt.push(v(xd - 0.07 + 0.07 * Math.sin(f), YT, zi - (0.07 - 0.07 * Math.cos(f)))); }
      const dz = []; for (let i = 0; i <= 4; i++) { const a = (Math.PI / 2) * i / 4; dz.push(v(xd, YT - 0.06 + 0.06 * Math.cos(a), -1.39 - 0.06 * Math.sin(a))); }
      makeCable("TZ-104", [...riseTo(zi), v(xd - 0.6, YT, zi), ...tt, v(xd, YT, -1.37), ...dz, v(xd, TY - 0.25, -1.45), v(xd, 1.6, -1.45), v(xd, 0.9, -1.45), v(xd, 0.66, -1.44), v(xd, 0.545, -1.41), v(xd, 0.56, -1.375), tzE], { always: true }); }
    { const zi = ZIN["BOMBA"], xd = 1.3;        // sai da calha principal para baixo (trajeto clássico até a caixa do motor)
      makeCable("BOMBA", [...riseTo(zi), v(xd - 0.6, YT, zi), ...dropAt(xd, zi), v(1.3, 2.4, -1.16), v(1.28, 1.8, -1.3), v(1.3, 0.6, -1.3), v(1.32, 0.24, -1.17), v(1.32, 0.285, -1.1), v(1.32, 0.285, -1.052)], { always: true }); }
    { const zi = ZIN["VY-01"], lane = XL.VY;
      const bend = []; for (let i = 0; i <= 4; i++) { const a = (Math.PI / 2) * i / 4; bend.push(v(lane, YT - 0.1 + 0.1 * Math.cos(a), ZB - 0.1 + 0.1 * Math.sin(a))); }
      makeCable("VY-01", [...riseTo(zi), v(lane - 0.6, YT, zi), ...turnZ(lane, zi, +1), v(lane, YT, ZB - 0.14), ...bend, v(lane, TY - 0.45, ZB), v(lane, 1.2, ZB), v(lane, 0.96, ZB), v(lane + 0.002, 0.86, ZB + 0.05), v(2.36, 0.76, -0.385), v(2.36, 0.7, -0.35), v(2.36, 0.657, -0.35)], { lane, yPeel: 0.9 }); }
    buildBundleTies();
  }
  function drawPlc() {
    if (!S.plcScreen) return;
    const { c, t } = S.plcScreen, g = c.getContext("2d"), PL = window.PLC;
    const X = PL ? PL.io.X : [], Y = PL ? PL.io.Y : [], run = !!(PL && PL.run);
    g.fillStyle = "#E6E8EA"; g.fillRect(0, 0, 512, 640);
    g.fillStyle = "#DADDE0"; g.fillRect(0, 0, 512, 24); g.fillRect(0, 616, 512, 24);
    g.fillStyle = "#4A4F57"; g.font = "bold 40px Arial"; g.textAlign = "left"; g.fillText("DVP20SX2", 22, 66);
    const led = (x, y, on, col) => { if (on) { g.fillStyle = col; g.globalAlpha = 0.35; g.fillRect(x - 5, y - 12, 32, 20); g.globalAlpha = 1; } g.fillStyle = on ? col : "#3A3F46"; g.fillRect(x, y - 7, 22, 10); };
    g.font = "18px Arial";
    [["POWER", true, "#3BE07A"], ["RUN", run, "#3BE07A"], ["ERROR", false, "#FF4A3A"], ["USB", false, "#FFB020"]].forEach(([l, on, col], i) => { led(22, 112 + i * 30, on, col); g.fillStyle = "#3A3F46"; g.fillText(l, 54, 116 + i * 30); });
    ["RS-232", "RS-485"].forEach((l, i) => { led(22, 250 + i * 30, false, "#3BE07A"); g.fillStyle = "#3A3F46"; g.fillText(l, 54, 254 + i * 30); });
    g.fillStyle = "#3A3F46"; g.fillRect(28, 318, 40, 24); g.fillRect(104, 318, 54, 24);
    g.fillStyle = "#fff"; g.font = "bold 16px Arial"; g.fillText("IN", 37, 336); g.fillText("OUT", 111, 336);
    g.font = "16px Arial";
    for (let i = 0; i < 8; i++) { led(26, 364 + i * 26, X[i], "#3BE07A"); g.fillStyle = "#3A3F46"; g.fillText(i, 56, 369 + i * 26); }
    for (let i = 0; i < 6; i++) { led(104, 364 + i * 26, Y[i], "#FF8A3D"); g.fillStyle = "#3A3F46"; g.fillText(i, 134, 369 + i * 26); }
    // USB, RUN/STOP, potenciômetros, mini-DIN
    g.fillStyle = "#2B2F36"; g.fillRect(28, 566, 40, 16); g.fillStyle = "#3A3F46"; g.font = "13px Arial"; g.fillText("USB", 32, 600);
    g.fillStyle = "#3A3F46"; g.font = "bold 15px Arial"; g.fillText("RUN", 168, 548); g.fillText("STOP", 164, 612);
    g.fillStyle = "#2B2F36"; g.fillRect(176, 556, 24, 40); g.fillStyle = "#B83A2E"; g.fillRect(179, run ? 559 : 575, 18, 18);
    [[74, 0], [124, 1]].forEach(([x, n]) => { g.fillStyle = "#D7DBDF"; g.beginPath(); g.arc(x, 640 - 40, 17, 0, 7); g.fill(); g.fillStyle = "#2F6DB5"; g.beginPath(); g.arc(x, 640 - 40, 12, 0, 7); g.fill(); g.fillStyle = "#fff"; g.fillRect(x - 1.5, 640 - 50, 3, 20); g.fillStyle = "#3A3F46"; g.font = "13px Arial"; g.fillText(n, x - 4, 640 - 12); });
    g.fillStyle = "#1F2328"; g.beginPath(); g.arc(300, 600, 30, 0, 7); g.fill(); g.fillStyle = "#555B63"; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.arc(300 + Math.cos(a) * 15, 600 + Math.sin(a) * 15, 3, 0, 7); g.fill(); }
    // legendas dos bornes
    const col = (labels, x, y0, y1) => { const st = (y1 - y0) / labels.length; g.textAlign = "right"; labels.forEach((l, i) => g.fillText(l, x, y0 + st * (i + 0.5) + 6)); g.textAlign = "left"; };
    g.fillStyle = "#3A3F46"; g.font = "bold 16px Arial";
    col(["V0+", "I0+", "VI0-", "V1+", "I1+", "VI1-", "V2+", "I2+", "VI2-"], 256, 84, 330);
    col(["V3+", "I3+", "VI3-", "FE", "VO0", "IO0", "VO1", "IO1", "AG"], 256, 350, 598);
    col(["S/S", "X0", "X1", "X2", "X3", "X4", "X5", "X6", "X7"], 402, 84, 330);
    col(["C0", "Y0", "Y1", "Y2", "•", "C1", "Y3", "Y4", "Y5"], 402, 350, 598);
    g.strokeStyle = "#3A3F46"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(210, 90); g.lineTo(204, 90); g.lineTo(204, 590); g.lineTo(210, 590); g.stroke();
    g.font = "bold 14px Arial"; g.fillText("A/D", 166, 230); g.fillText("D/A", 166, 500);
    g.fillStyle = "#3A3F46"; g.fillRect(412, 30, 40, 22); g.fillRect(412, 330, 50, 18); g.fillStyle = "#fff"; g.font = "bold 14px Arial"; g.fillText("IN", 422, 46); g.fillText("OUT", 418, 344);
    t.needsUpdate = true;
  }

  /* ---------- modelos das peças ---------- */
  function partModel(tag) {
    const g = new T.Group();
    const add = (geo, m, p) => { const o = at(mesh(geo, m), p); g.add(o); return o; };
    if (tag === "TE-104") {
      add(new T.CylinderGeometry(0.009, 0.007, 0.9, 12), M.steel, v3(0, -0.45, 0));
      add(new T.CylinderGeometry(0.024, 0.024, 0.03, 6), M.steel, v3(0, 0.015, 0));
      add(new T.CylinderGeometry(0.011, 0.011, 0.11, 12), M.steel, v3(0, 0.085, 0));
      add(new T.CylinderGeometry(0.02, 0.02, 0.02, 6), M.steel, v3(0, 0.145, 0));
      const head = mat(0x4A4F57, 0.45, 0.45);
      add(new T.CylinderGeometry(0.046, 0.04, 0.06, 32), head, v3(0, 0.185, 0));
      add(new T.CylinderGeometry(0.038, 0.038, 0.004, 32), mat(0x15191E, 0.2, 0.8), v3(0, 0.214, 0));
      add(cylX(0.016, 0.03, 16), head, v3(0.055, 0.185, 0));
      gland(g, v3(0.07, 0.185, 0), v3(1, 0, 0), 0.009);
    } else if (tag === "TT-104") {
      // transmissor de temperatura Smar TT301: módulo de ligação dentro do cabeçote, adaptador sextavado, pescoço e carcaça com display
      add(new T.CylinderGeometry(0.03, 0.03, 0.012, 32), mat(0xF4F6F8, 0.05, 0.5), v3(0, -0.004, 0));
      const ss = mat(0xC4C9CE, 0.85, 0.25);
      add(new T.CylinderGeometry(0.047, 0.047, 0.012, 32), mat(0x4A4F57, 0.45, 0.45), v3(0, 0.006, 0));
      add(new T.CylinderGeometry(0.02, 0.02, 0.016, 6), ss, v3(0, 0.02, 0));
      add(new T.CylinderGeometry(0.013, 0.015, 0.03, 20), ss, v3(0, 0.04, 0));
      S.ttScreen = smarScreen("TT-104", 200); S.ttScreen.draw(["----", "°C"]);
      smarHousing(g, v3(0, 0.094, 0), 0.044, 0.078, S.ttScreen);
      gland(g, v3(0.058, 0.094, -0.0234), v3(1, 0, 0), 0.0075);                       // entrada elétrica lateral do transmissor
    } else if (tag === "TSH-104") {
      add(cylZ(0.009, 0.35, 12), M.steel, v3(0, 0, -0.17));
      add(cylZ(0.022, 0.026, 6), M.steel, v3(0, 0, 0.013));
      add(cylZ(0.05, 0.06, 32), M.paint, v3(0, 0, 0.056));
      add(cylZ(0.052, 0.012, 32), M.dark, v3(0, 0, 0.09));
      add(cylZ(0.02, 0.016, 20), mat(0xB83A2E, 0.2, 0.4), v3(0, 0, 0.102));
      add(new T.BoxGeometry(0.004, 0.03, 0.004), mat(0xffffff, 0, 0.5), v3(0, 0.008, 0.111));
      gland(g, v3(0, -0.05, 0.056), v3(0, -1, 0), 0.008);
      S.tshLamp = new T.MeshStandardMaterial({ color: 0x225533, emissive: 0x1a6b3a, emissiveIntensity: 0.6 });
      add(new T.SphereGeometry(0.008, 12, 8), S.tshLamp, v3(0.034, 0.025, 0.097));
    } else if (tag === "PG") {
      add(cylZ(0.011, 0.05, 12), M.steel, v3(0, 0, 0.025));
      add(cylZ(0.016, 0.014, 6), M.steel, v3(0, 0, 0.012));
      add(cylZ(0.072, 0.035, 48), M.steel, v3(0, 0, 0.075));
      const bez = mesh(new T.TorusGeometry(0.07, 0.006, 10, 48), M.chrome); bez.position.set(0, 0, 0.094); g.add(bez);
      const face = canvasTex(256, 256, (c) => {
        c.fillStyle = "#fff"; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
        c.strokeStyle = "#1F2A37"; c.fillStyle = "#1F2A37"; c.textAlign = "center"; c.font = "bold 26px Arial";
        for (let i = 0; i <= 30; i++) { const an = (-225 + i * 9) * Math.PI / 180, big = i % 5 === 0; c.lineWidth = big ? 5 : 2; c.beginPath(); c.moveTo(128 + Math.cos(an) * (big ? 98 : 108), 128 + Math.sin(an) * (big ? 98 : 108)); c.lineTo(128 + Math.cos(an) * 118, 128 + Math.sin(an) * 118); c.stroke(); if (big) c.fillText(i / 5, 128 + Math.cos(an) * 76, 137 + Math.sin(an) * 76); }
        c.fillStyle = "#5B6B80"; c.font = "20px Arial"; c.fillText("bar", 128, 196); c.font = "14px Arial"; c.fillText("cl. 1,6", 128, 216);
      });
      add(new T.CircleGeometry(0.066, 48), new T.MeshStandardMaterial({ map: face, roughness: 0.3 }), v3(0, 0, 0.0935));
      const nd = new T.Group(); nd.position.set(0, 0, 0.096); g.add(nd);
      nd.add(at(mesh(new T.BoxGeometry(0.003, 0.058, 0.002), mat(0x1F2A37, 0.1, 0.5)), v3(0, 0.024, 0)));
      nd.add(mesh(new T.CylinderGeometry(0.005, 0.005, 0.004, 12).rotateX(Math.PI / 2), mat(0x1F2A37)));
      add(new T.CircleGeometry(0.068, 48), new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, roughness: 0, depthWrite: false }), v3(0, 0, 0.1));
      S.pgNeedle = nd; setNeedle(0);
    } else if (tag === "LSH-101" || tag === "LSL-101") {
      // chave boia horizontal de polipropileno preto: cabeça sextavada + arruela cinza (fixação na parede), rosca com anéis de vedação, rabicho e boia articulada
      const blk = mat(0x1B1D20, 0.1, 0.55), grey = mat(0xBBC0C6, 0.05, 0.5);
      add(new T.CylinderGeometry(0.021, 0.021, 0.014, 6).rotateX(Math.PI / 2), blk, v3(0, 0, -0.007));
      add(cylZ(0.024, 0.005, 28), grey, v3(0, 0, 0.003));
      add(cylZ(0.0125, 0.024, 20), blk, v3(0, 0, 0.017));
      for (const z of [0.012, 0.02]) add(cylZ(0.0138, 0.002, 20), blk, v3(0, 0, z));
      add(new T.BoxGeometry(0.026, 0.026, 0.046), blk, v3(0, 0, 0.052));
      add(new T.BoxGeometry(0.004, 0.012, 0.006), grey, v3(0, 0.0132, 0.052));
      for (const sx of [-1, 1]) add(new T.BoxGeometry(0.003, 0.018, 0.03), blk, v3(sx * 0.0095, 0, -0.03));   // garfo da articulação
      const pv = new T.Group(); pv.position.set(0, 0, -0.03); g.add(pv); S[tag === "LSH-101" ? "lshPivot" : "lslPivot"] = pv;
      pv.add(mesh(cylX(0.0035, 0.026, 10), blk));                                                     // pino
      pv.add(at(mesh(new T.BoxGeometry(0.011, 0.008, 0.07), blk), v3(0, 0, -0.035)));               // haste
      pv.add(at(mesh(new T.BoxGeometry(0.011, 0.016, 0.014), blk), v3(0, 0.004, -0.012)));           // ressalto da articulação
      pv.add(at(mesh(cylZ(0.019, 0.09, 24), blk), v3(0, -0.012, -0.095)));                           // boia cilíndrica
      pv.add(at(mesh(cylZ(0.013, 0.004, 20), mat(0x0B0C0E, 0.1, 0.7)), v3(0, -0.012, -0.141)));      // boca da boia
      gland(g, v3(0, 0, 0.074), v3(0, 0, 1), 0.007);
      g.scale.setScalar(0.7);                                                                           // chave boia 30% menor
      const lamp = new T.MeshStandardMaterial({ color: 0x225533, emissive: 0x1a6b3a, emissiveIntensity: 0.6 });
      add(new T.SphereGeometry(0.005, 12, 8), lamp, v3(0, 0.0145, 0.036));
      S[tag === "LSH-101" ? "lshLamp" : "lslLamp"] = lamp;
    } else if (tag === "VY-01") {
      add(new T.BoxGeometry(0.1, 0.07, 0.07), M.brass, v3(0, 0, 0));
      add(cylX(0.03, 0.18, 20), M.brass, v3(0, 0, 0));
      for (const x of [-0.095, 0.095]) flange(v3(x, 0, 0), v3(1, 0, 0), 0.024, g, 4);
      add(new T.CylinderGeometry(0.014, 0.014, 0.03, 16), M.steel, v3(0, 0.05, 0));
      add(new T.BoxGeometry(0.07, 0.085, 0.07), mat(0x1F2A37, 0.3, 0.6), v3(0, 0.105, 0));
      add(new T.BoxGeometry(0.05, 0.05, 0.03), mat(0x2B2F36, 0.2, 0.6), v3(0, 0.105, 0.05));
      add(new T.CylinderGeometry(0.004, 0.004, 0.01, 8), M.bolt, v3(0, 0.12, 0.068));
      gland(g, v3(0, 0.1475, 0), v3(0, 1, 0), 0.007);
      S.vyLamp = new T.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 });
      add(new T.SphereGeometry(0.007, 12, 8), S.vyLamp, v3(0.015, 0.09, 0.066));
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.tag = tag; } });
    return g;
  }
  function setNeedle(bar) { if (S.pgNeedle) S.pgNeedle.rotation.z = -((-225 + clamp(bar, 0, 6) / 6 * 270) + 90) * Math.PI / 180; }

  /* ---------- áreas de encaixe ---------- */
  function makeGhost(id, s) {
    let geo, off;
    if (s.kind === "inline") { geo = new T.BoxGeometry(0.24, 0.2, 0.15); off = v3(0, 0.03, 0); }
    else if (s.kind === "top") { const hgt = id === "te" ? 0.26 : id === "lit" ? 0.15 : s.small ? 0.07 : 0.2; geo = new T.BoxGeometry(s.small ? 0.11 : 0.14, hgt, s.small ? 0.11 : 0.14); off = v3(0, hgt / 2, 0); }
    else { const sm = s.small || id === "lsh" || id === "lsl"; geo = sm ? new T.BoxGeometry(0.12, 0.11, 0.1) : new T.BoxGeometry(0.16, 0.15, 0.16); off = v3(0, 0, sm ? 0.05 : 0.08); }
    const m = mesh(geo, new T.MeshBasicMaterial({ color: 0x48D1FF, transparent: true, opacity: 0.28, depthWrite: false }), false, false);
    m.position.copy(s.mount).add(off);
    m.add(new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: 0x9BEBFF, transparent: true, opacity: 0.9 })));
    m.userData.slot = id; m.renderOrder = 2;
    s.holder.add(m); s.ghost = m;
    m.visible = !SLOTDEF[id].req;
  }

  /* ---------- rótulos ---------- */
  function addLabel(key, parent, pos, html, cls = "") {
    const d = document.createElement("div"); d.className = "l3 " + cls; d.innerHTML = html;
    const o = new T.CSS2DObject(d); o.position.copy(pos); parent.add(o);
    S.labels[key] = { el: d, obj: o };
    return d;
  }
  const LPOS = { "TE-104": v3(-0.15, 0.12, 0), "TT-104": v3(0, 0.17, 0), "TSH-104": v3(0, 0.12, 0.08), "PG": v3(0, 0.11, 0.08),
    "LSH-101": v3(0.1, 0.05, 0.06), "LSL-101": v3(0.1, 0.05, 0.06), "VY-01": v3(0, 0.22, 0) };

  /* ---------- UI ---------- */
  function tip(html, kind = "") { const t = $("#tip3d"); t.className = "tip3d " + kind; t.innerHTML = `<span class="dica">${kind === "bad" ? "ATENÇÃO" : kind === "ok" ? "CERTO" : "DICA"}</span>${html}`; }
  function renderTray() {
    const tr = $("#tray3d");
    const cards = PARTS.filter(p => !S.installed[p.tag]).map(p => `<button class="pc ${S.sel === p.tag ? "sel" : ""}" data-t="${p.tag}" title="${p.name}"><svg viewBox="0 0 64 64">${ICONS[p.icon]}</svg><span>${p.name}</span><em>${p.label || p.tag}</em></button>`);
    if (!cards.length) cards.push('<div class="small" style="color:var(--muted);padding:6px 2px">Todas as peças foram usadas.</div>');
    const collapsed = $("#box3d").classList.contains("tray-collapsed");
    tr.innerHTML = `<div class="trh"><span>Bancada de Peças</span><button class="tray-toggle" id="trayToggle" aria-expanded="${!collapsed}">${collapsed ? "＋ Expandir" : "− Recolher"}</button></div><div class="trs">${cards.join("")}</div>`;
    $("#trayToggle").onclick = () => {
      const on = $("#box3d").classList.toggle("tray-collapsed");
      $("#trayToggle").textContent = on ? "＋ Expandir" : "− Recolher";
      $("#trayToggle").setAttribute("aria-expanded", String(!on));
      try { localStorage.setItem("nivel-tray3d-collapsed", on ? "1" : "0"); } catch (e) { }
      window.dispatchEvent(new Event("resize"));
    };
    tr.querySelectorAll(".pc[data-t]").forEach(b => b.onclick = () => selectPart(b.dataset.t));
    renderHud(); renderClp();
  }
  function selectPart(tag) {
    S.sel = S.sel === tag ? null : tag;
    const p = PARTS.find(x => x.tag === tag);
    const need = p.slot && SLOTDEF[p.slot].req;
    if (!S.sel) tip("Escolha uma peça na Bancada de Peças e toque na área azul onde ela deve ser instalada.");
    else if (need && !S.installed[PARTS.find(x => x.slot === need).tag]) tip(`<b>${p.name} ${p.tag}</b>: instale primeiro o sensor PT100 para encaixar o transmissor de cabeçote.`);
    else tip(`<b>${p.name}${p.label ? "" : " " + p.tag}</b> selecionado. As áreas azuis piscando marcam os pontos de instalação. Leia a tag e toque no ponto certo.`);
    renderTray();
  }
  const count = grp => PARTS.filter(p => p.grp === grp && S.installed[p.tag]).length;
  const total = grp => PARTS.filter(p => p.grp === grp).length;
  const ready = grp => count(grp) === total(grp);

  function tryInstall(slotId) {
    const p = PARTS.find(x => x.tag === S.sel);
    const sd = SLOTDEF[slotId];
    if (!p) { tip(`Ponto de instalação: <b>${sd.hint}</b>. Escolha uma peça na Bancada de Peças.`); return; }
    if (p.slot === slotId) { install(p, slotId); return; }
    S.errors++; flash(slotId);
    const hint = sd.hint.charAt(0).toLowerCase() + sd.hint.slice(1);
    if (!p.slot) tip(p.other, "bad");
    else if ((p.slot === "lsh" && slotId === "lsl") || (p.slot === "lsl" && slotId === "lsh")) tip(`<b>${p.tag}</b>: a última letra diz o limite, <b>${p.tag[2] === "H" ? "H = alto (high)" : "L = baixo (low)"}</b>. Este ponto fica ${slotId === "lsh" ? "perto do topo: é o lugar da chave de nível alto" : "perto do fundo: é o lugar da chave de nível baixo"}.`, "bad");
    else if (p.slot === "tt") tip("O transmissor de cabeçote vai <b>dentro do cabeçote do sensor PT100</b>, não aqui.", "bad");
    else tip(`<b>${p.name} ${p.tag}</b> não vai aqui. Este ponto é: ${hint}.`, "bad");
  }
  function flash(id) { const g = S.slots[id].ghost; g.material.color.set(0xE0503C); g.userData.flash = 0.6; }
  function install(p, slotId) {
    const s = S.slots[slotId];
    const g = partModel(p.tag);
    const off = s.kind === "side" ? v3(0, 0, 0.35) : v3(0, 0.35, 0);
    g.userData.anim = { from: s.mount.clone().add(off), to: s.mount.clone(), t: 0 };
    g.position.copy(g.userData.anim.from);
    s.holder.add(g); S.parts[p.tag] = g;
    s.ghost.visible = false;
    S.installed[p.tag] = true; S.sel = null;
    if (S.rebuildCables) S.rebuildCables(p.tag);
    for (const k in SLOTDEF) if (SLOTDEF[k].req === slotId && S.slots[k].ghost) S.slots[k].ghost.visible = true;
    addLabel(p.tag, s.holder, s.mount.clone().add(LPOS[p.tag]), `<b>${p.tag}</b><i></i>`);
    const r = window.readTag ? window.readTag(p.tag).text : "";
    tip(`<b>${p.tag}</b> instalado: ${r}.${p.tag === "TE-104" ? " O cabeçote ficou aberto: agora instale o transmissor de cabeçote." : p.tag === "TT-104" ? " Cabeçote fechado." : ""}`, "ok");
    renderTray();
    for (const grp of ["tq", "ln"]) if (ready(grp) && !S.done[grp]) {
      S.done[grp] = true;
      const all = ready("tq") && ready("ln");
      setTimeout(() => tip(all ? `<b>Bancada completa!</b> ${S.errors === 0 ? "Sem nenhum erro." : `Com ${S.errors} tentativa(s) errada(s).`} Opere as malhas no painel ao lado ou programe o CLP no <b>ISPSoft</b> (aba <b>CLP</b>). Clique nas boias e no termostato para forçar os contatos.`
        : grp === "tq" ? "<b>Sensores de temperatura montados!</b> Faça a ligação do TT-104 e inicie o aquecimento no painel ao lado."
          : "<b>Tanque e tubulação montados!</b> Agora use o comando direto ou programe o controle de nível no <b>ISPSoft</b>.", "ok"), 900);
    }
  }

  function renderHud() {
    const h = $("#h3d");
    let html = `<div class="hudtop"><b>Painel do processo</b><button class="b3" id="hudHide" title="Ocultar o painel">✕ Ocultar</button></div>`;
    const Ld = S.lvl, drainCtl = Ld ? `<div class="row3"><button class="b3 ${Ld.drain ? "on" : ""}" id="b4drain">${Ld.drain ? "Fechar dreno" : "Abrir dreno"}</button></div>
        <label class="small" for="b4drainPct" style="display:block;margin-top:6px">Abertura do dreno (velocidade de esvaziamento): <b id="b4drainPctVal">${Ld.drainPct}%</b></label>
        <input type="range" id="b4drainPct" min="0" max="100" step="5" value="${Ld.drainPct}" title="Controla a vazão quando o dreno está aberto" style="width:100%">` : "";
    if (ready("tq")) {
      const wired = !!window.__ttWired, P = S.proc;
      html += `<div class="sec3"><div class="hh">Malha de temperatura</div>
        <div class="small">${wired ? "TT-104 ligado ao CLP ✔" : "TT-104 ainda sem ligação: o CLP lê 0 mA"} · Comando: <b>${PLCo().run ? "CLP (Y4)" : "local (TIC-104)"}</b></div>
        <label class="small" style="display:block;margin-top:8px">Setpoint de temperatura (D200): <b id="b3spt"></b></label>
        <input type="range" id="b3sp" min="30" max="200" step="1" value="${P.sp}" style="width:100%">
        ${drainCtl}
        <div class="row3">
        ${PLCo().run ? "" : `<button class="b3 pri" id="b3run">${P.run ? "Desligar" : "Aquecer"}</button>`}
        <button class="b3 ${P.stuck ? "on" : ""}" id="b3stuck">Relé colado</button>
        <button class="b3 pri" id="b3repl" style="display:none">Substituir resistência</button></div>
        <table class="t3" id="t3"></table></div>`;
    }
    if (ready("ln")) {
      const L = S.lvl, clp = PLCo().run, isp = !!(window.ISP && ISP.active);
      html += `<div class="sec3"><div class="hh">Malha de nível e vazão</div>
        <div class="small">Modo: <b>${isp ? "programa no ISPSoft" : clp ? "CLP em RUN" : "simulação sem programa"}</b></div>
        <div id="mdCtl"></div>
        <div class="row3">${clp || window.MD ? "" : `<button class="b3 pri" id="b4pump">${L.pump ? "Desligar bomba" : "Ligar bomba"}</button>`}<button class="b3 pri" id="b4repl" style="display:none">Substituir bomba</button><button class="b3" id="b4goClp" title="Conexão com o ISPSoft, mapa de entradas e saídas e partida da bomba">Configurar o CLP ›</button></div>
        ${ready("tq") ? "" : drainCtl}
        <table class="t3" id="t4"></table></div>`;
    }
    html += `<div class="sec3"><details id="profBox" ${S.profOpen ? "open" : ""}><summary class="hh" style="cursor:pointer">Professor (erros injetados)</summary>
        <label class="small" style="display:block;margin-top:8px">Erro de zero do TT-104 (temperatura): <b id="b3zt"></b></label>
        <input type="range" id="b3zero" min="-10" max="10" step="0.5" value="${ttZero}" style="width:100%">
        <div class="row3"><button class="b3" id="b3cal">Calibrar TT-104</button></div>
        <label class="small" style="display:block;margin-top:8px">Erro de zero do LT-101 (nível, cm): <b id="b4zt"></b></label>
        <input type="range" id="b4zero" min="-10" max="10" step="0.5" value="${ltZero}" style="width:100%">
        <div class="row3"><button class="b3" id="b4cal">Calibrar LT-101</button></div></details></div>`;
    h.innerHTML = html;
    $("#hudHide").onclick = () => setHud(false);
    { const pb = $("#profBox"); if (pb) pb.ontoggle = () => { S.profOpen = pb.open; };
      const z3 = $("#b3zero"); if (z3) z3.oninput = e => setTtZero(+e.target.value);
      const c3 = $("#b3cal"); if (c3) c3.onclick = () => { setTtZero(0); z3.value = 0; tip("TT-104 <b>calibrado</b>: o erro de zero voltou a 0 °C.", ""); };
      const z4 = $("#b4zero"); if (z4) z4.oninput = e => setLtZero(+e.target.value);
      const c4 = $("#b4cal"); if (c4) c4.onclick = () => { setLtZero(0); z4.value = 0; tip("LT-101 <b>calibrado</b>: o erro de zero voltou a 0 cm.", ""); }; }
    { const bdn = $("#b4drain"); if (bdn) bdn.onclick = () => { S.lvl.drain = !S.lvl.drain; renderHud(); };
      const bd = $("#b4drainPct"); if (bd) bd.oninput = e => { S.lvl.drainPct = +e.target.value; const v = $("#b4drainPctVal"); if (v) v.textContent = S.lvl.drainPct + "%"; }; }
    if (ready("tq")) {
      $("#b3sp").oninput = e => { api.setSp(+e.target.value); };
      const br = $("#b3run"); if (br) br.onclick = () => { const P = S.proc; P.run = !P.run; if (P.run && P.trip) { if (P.T > P.lim - 5 || P.P > P.plim - 0.15) { tip("A proteção ainda está atuada: espere o TQ-01 esfriar alguns graus para rearmar.", "bad"); P.run = false; } else P.trip = false; } S.ui.selRes = P.run; renderHud(); };
      $("#b3stuck").onclick = () => { S.proc.stuck = !S.proc.stuck; renderHud(); };
      $("#b3repl").onclick = () => replaceHeater();
    }
    if (ready("ln")) {
      if (window.MD) MD.renderCtl($("#mdCtl"));
      const bp = $("#b4pump");
      if (bp) bp.onclick = () => { const L = S.lvl; if (!L.pump && L.trip) { if (L.L >= 80) { tip("O <b>LSH-101</b> ainda está atuado: o nível precisa baixar de 80% para religar a bomba. Abra o dreno.", "bad"); return; } L.trip = false; } L.pump = !L.pump; renderHud(); };
      const br4 = $("#b4repl"); if (br4) br4.onclick = () => replacePump();
      const bg = $("#b4goClp"); if (bg) bg.onclick = () => { if (window.show) window.show("clpcfg"); };
    }
    renderClpTab();
    updateReadings();
  }

  /* ---------- aba CLP: modo de comando, partida/inversor, conexão com o ISPSoft e mapa de E/S ---------- */
  function renderClpTab() {
    const md = document.getElementById("cfgMd"), dv = document.getElementById("cfgDrv"), ip = document.getElementById("cfgIsp");
    if (!md || !dv || !ip) return;
    if (window.MD) MD.render(md, true);
    if (window.ISP) ISP.render(ip);
    const DV = window.DRV;
    dv.innerHTML = `<div class="small">Partida da bomba: <b>${DV ? DV.names[DV.sel] : "Direta (K1)"}</b></div>
      <div class="row3"><button class="b3" id="cfgMode">Trocar a partida</button><button class="b3" id="cfgVfd">Abrir ${DV && DV.sel !== "direta" ? "o inversor" : "os inversores"}</button></div>
      ${DV && DV.applyAuto ? `<div class="small" style="margin-top:8px" title="Grava no inversor os dados de placa, rampas e a partida pelo CLP (Y0 + 4–20 mA)">Parametrizar automático (placa, rampas e partida pelo CLP):</div><div class="row3"><button class="b3" data-ap="pf525">PF525</button><button class="b3" data-ap="atv12">ATV12</button><button class="b3" data-ap="cfw500">CFW500</button></div>` : ""}`;
    const bm = dv.querySelector("#cfgMode"); if (bm) bm.onclick = () => { if (DV) { const o = Object.keys(DV.names); DV.setSel(o[(o.indexOf(DV.sel) + 1) % o.length]); } renderHud(); };
    dv.querySelectorAll("[data-ap]").forEach(b => b.onclick = () => { const k = b.dataset.ap, nm = DV.names[k]; b.disabled = true; setTimeout(() => { try { DV.applyAuto(k); tip("<b>" + nm + "</b> parametrizado: placa, rampas e partida pelo CLP.", ""); } catch (e) { tip("Não consegui parametrizar o " + nm + ": " + e.message, "bad"); } b.disabled = false; }, 30); });
    const bv = dv.querySelector("#cfgVfd"); if (bv) bv.onclick = () => window.openVfd && window.openVfd(DV && DV.sel !== "direta" ? DV.sel : undefined);
  }

  /* ---------- integração com o CLP programável (app-clp.js) ---------- */
  const RAW = 2000, RAO = 4000; // DVP-SX2: AI 4–20 mA → 0..2000 · AO 4–20 mA → 0..4000
  const PLCo = () => window.PLC;
  function plcInputs() {
    const io = PLCo().io, L = S.lvl;
    io.X[0] = L.L <= 17;                                                           // LSL: boia desce (nível baixo) abaixo de ~17 % (posição da chave)
    io.X[1] = L.L >= 83 ? true : L.L <= 81 ? false : io.X[1];                      // LSH: boia sobe (nível alto) a partir de ~83 %
    const P = S.proc, ttOk = ready("tq") && !!window.__ttWired;
    io.D[1110] = ltInfo(L.L).counts;                                               // LT-101: 0–10 kPa → 0..2000
    io.D[1111] = ttOk ? Math.round(clamp(Tm(P), 0, 200) / 200 * RAW) : 0;          // 10 contagens = 1 °C
    io.X[5] = ready("tq") && (P.T >= P.lim ? true : P.T <= P.lim - 5 ? false : io.X[5]); // TSH-104
    if (S.force.LSL != null) io.X[0] = !S.force.LSL; if (S.force.LSH != null) io.X[1] = S.force.LSH; if (S.force.TSH != null) io.X[5] = S.force.TSH;
    io.D[200] = Math.round(P.sp * 10);                                             // SP na escala do TT-104
    io.D[222] = Math.round(L.av * RAO / 100);
  }
  function plcCycle(dt) { if (!window.PLC) return; plcInputs(); const AD = window.DRV && window.DRV.active(); PLCo().io.X[7] = !!(AD && AD.faulted); if (window.ISP && ISP.active) { ISP.cycle(dt, PLCo().io); return; } PLCo().scan(dt); }
  // inversores (PF525, ATV12, CFW500): rodam em tempo real (as rampas valem em segundos de verdade).
  // Só o escolhido na seletora recebe o comando (Y0 → borne 02 / LI1 / DI1) e a referência (D1116 → AI) e gira o motor.
  const SEL_ANG = { direta: 0.95, pf525: 0.32, atv12: -0.32, cfw500: -0.95 };
  function stepDrive(dt) {
    const DV = window.DRV, L = S.lvl; if (!DV || !L) return;
    const PL = PLCo(), clp = !!(PL && PL.run);
    const cmd = !S.ui.emerg && (clp ? !!PL.io.Y[0] : !!L.pump);                                   // Y0 (ou botão local) fecha a entrada de partida
    let ai = clp ? (PL.aoUsed() ? clamp((PL.io.D[1116] || 0) / RAO, 0, 1) : clamp(L.fvCmd / 100, 0, 1)) : null;   // AO CH0 do CLP (D1116) → entrada 4–20 mA
    if (clp && ai != null && !((PL.io.D[1116] || 0) > 0)) ai = 1;   // parâmetros automáticos: se o programa não manda velocidade (D1116 = 0), o inversor vai a 100 % (60 Hz) para encher o tanque
    const sel = DV.sel;
    S.vfdT = (S.vfdT || 0) + dt; const pt = S.vfdT > 0.15; if (pt) S.vfdT = 0;
    for (const k in DV.list) {
      const D = DV.list[k], on = k === sel, r = D.step(dt, { di02: on && cmd, di1: on && cmd, ai: on ? ai : null });
      if (on) { L.motorN = Math.abs(r.n); L.motorDir = r.n < 0 ? -1 : 1; }
      const o = S.drv3d && S.drv3d[k]; if (o && pt) { D.paint3D(o.scr.c); o.scr.t.needsUpdate = true; }
    }
    if (S.selHandle) S.selHandle.rotation.z = SEL_ANG[sel] || 0;
  }
  // o inversor escolhido está pronto para partir pelos bornes? (senão, a dica explica o que falta)
  function drvExtMsg(k) {
    const D = window.DRV && window.DRV.list[k]; if (!D) return "";
    if (k === "pf525") return D.param("P046") === 2 ? "" : "o PF525 está com <b>P046 = " + D.param("P046") + "</b>: ele só parte pela tecla verde da IHM. Para partir pelo CLP/botão (borne 02), use <b>P046 = 2</b> e <b>t062 = 48</b>.";
    if (k === "cfw500") { const p = D.param("P0220"), rem = p === 1 || ((p === 2 || p === 3) && D.state.rem); return rem && D.param("P0227") === 1 && D.param("P0263") === 1 ? "" : "o CFW500 " + (rem ? "está em REMOTO, mas" : "está em <b>LOCAL</b> e") + " só parte pelas teclas da HMI. Para partir pela DI1, use <b>P0220 = 1</b> (ou LOC/REM em REM), <b>P0227 = 1</b> e <b>P0263 = 1</b>."; }
    if (k === "atv12") return D.param("Fr1") === 0 && D.param("tCC") === 0 ? "" : "o ATV12 " + (D.param("Fr1") === 3 ? "está com <b>Fr1 = AIU1</b> (comando pela IHM: RUN/STOP)" : "não está em 2 fios") + ". Para partir pela LI1, use <b>Fr1 = AI1</b> e <b>tCC = 2C</b>.";
    return "";
  }
  function setHud(on) {
    S.hudOn = on; S.wrap.classList.toggle("hud-off", !on); try { localStorage.setItem("nivel-hud3d", on ? "1" : "0"); } catch (e) { } }
  function renderClp() { if (window.PLC && PLCo().refresh) PLCo().refresh(); }

  // texto da boia: posição (levantada/baixa) e, com o ISPSoft conectado, o contato escolhido na aba CLP (NA/NF) e o valor enviado ao CLP
  function floatTxt(k, up, alarm) {
    const m = window.ISP && ISP.active && ISP.cfg && ISP.cfg.x[k], pos = up ? "levantada" : "baixa";
    let t = "boia " + pos;
    if (m && m.n != null) { const closed = !!(ISP.sentX && ISP.sentX[m.n]); t += " · contato " + (m.nf ? "NF" : "NA") + " " + (closed ? "fechado" : "aberto") + " (X" + m.n.toString(8) + " = " + (closed ? 1 : 0) + ")"; }
    return alarm ? "<span class='al'>" + t + "</span>" : t;
  }
  function updateReadings() {
    const P = S.proc, L = S.lvl;
    const lab = (k, txt, alarm) => { const l = S.labels[k]; if (l) { l.el.querySelector("i").textContent = txt; l.el.classList.toggle("alarm", !!alarm); } };
    { const q = ltInfo(S.lvl ? S.lvl.L : 0);
      if (S.ltScreen) S.ltScreen.draw([fmt(q.cm), "LT-101 cm"]);
      if (S.lvRefScreen) S.lvRefScreen.draw([fmt(q.cmReal), "PADRÃO cm"]);
      lab("LT-101", fmt(q.cm) + " cm · " + fmt(q.mA, 2) + " mA");
      const z4 = $("#b4zt"); if (z4) z4.textContent = (ltZero > 0 ? "+" : "") + fmt(ltZero) + " cm" + (ltZero === 0 ? " (calibrado)" : " (descalibrado)"); }
    if (S.refScreen && P) { S.refScreen.draw([fmt(P.T), "PADRÃO °C"]); }
    if (P && ready("tq")) {
      const wired = !!window.__ttWired;
      const mA = wired ? 4 + 16 * clamp(Tm(P), 0, 200) / 200 : 0;
      const z = $("#b3zt"); if (z) z.textContent = (ttZero > 0 ? "+" : "") + fmt(ttZero) + " °C" + (ttZero === 0 ? " (calibrado)" : " (descalibrado)");
      const t3 = $("#t3"), spt = $("#b3spt"); if (spt) spt.textContent = P.sp + " °C · D200 = " + Math.round(P.sp * 10);
      if (t3) t3.innerHTML = `
        <tr><td><b>Padrão (real)</b></td><td>${fmt(P.T)} °C</td><td>referência</td></tr>
        <tr><td><b>TT-104 (lido)</b></td><td>${wired ? fmt(Tm(P)) + " °C" : "FALHA"}</td><td>${fmt(mA, 2)} mA</td></tr>
        <tr><td><b>Resistência</b></td><td colspan="2">${S.burnt ? "<span class='al'>QUEIMADA: substituir</span>" : fmt(P.Th, 0) + " °C (máx. 200)"}</td></tr>
        <tr><td><b>${window.PLC && window.PLC.run ? "CLP Y4" : "TIC-104"}</b></td><td>SP ${P.sp} °C</td><td>${P.trip ? "bloqueado" : P.heat ? "aquecendo" : "parado"}</td></tr>
        <tr><td><b>TSH-104</b></td><td colspan="2">${P.trip === "tsh" ? "<span class='al'>ATUOU a " + P.lim + " °C</span>" : "vigiando (" + P.lim + " °C)"}</td></tr>`;
      lab("TT-104", wired ? fmt(Tm(P)) + " °C · " + fmt(mA, 2) + " mA" : "0 mA · sem ligação", !wired);
      lab("TZ-104", S.burnt ? "QUEIMADA" : fmt(P.Th, 0) + " °C", S.burnt);
      { const rb = $("#b3repl"); if (rb) rb.style.display = S.burnt ? "" : "none"; }
      { const rb4 = $("#b4repl"); if (rb4) rb4.style.display = S.pumpBurnt ? "" : "none"; }
      lab("PG", fmt(P.P, 1) + " bar");
      lab("TSH-104", S.force.TSH != null ? "FORÇADO " + (S.force.TSH ? "atuado" : "livre") : (P.trip === "tsh" ? "ATUOU" : "OK"), S.force.TSH != null || P.trip === "tsh");
      if (S.ttScreen) S.ttScreen.draw([wired ? fmt(Tm(P)) : "----", "°C"]);
      setNeedle(P.P);
      S.panelScreen.draw(wired ? ["TIC-104", `PV ${fmt(Tm(P))} · SP ${P.sp} °C`] : ["TIC-104", "FALHA TT-104"], "#1F2A37");
    }
    if (window.DRV) for (const k in window.DRV.list) { const D = window.DRV.list[k], s = D.state; lab("VFD-" + k, D.faulted ? "FALHA" : (window.DRV.sel === k ? "⚡ bomba · " : "") + fmt(s.outF, 1) + " Hz · " + fmt(s.I, 2) + " A", D.faulted); }
    if (L && ready("ln")) {
      const PL = { X: PLCo().io.X };
      const t4 = $("#t4");
      const q4 = ltInfo(L.L), d1110 = PLCo().io.D[1110];
      if (t4) t4.innerHTML = `
        <tr><td><b>Nível padrão (real)</b></td><td>${fmt(q4.cmReal)} cm</td><td>referência</td></tr>
        <tr><td><b>LT-101 (lido)</b></td><td>${fmt(q4.cm)} cm · ${fmt(q4.kPa, 2)} kPa</td><td>${fmt(q4.mA, 2)} mA · D1110 = ${d1110}</td></tr>
        <tr><td><b>VY-01</b></td><td colspan="2">${L.vy ? "aberta (bobina energizada)" : "fechada"}</td></tr>
        <tr><td><b>Bomba</b></td><td colspan="2">${fmt(S.pumpT || 25, 0)} °C ${S.blocked ? "<span class='al'>REGISTRO FECHADO</span>" : ""}${S.thermalTrip ? " <span class='al'>RELÉ TÉRMICO</span>" : ""}${S.pumpBurnt ? " <span class='al'>QUEIMADA</span>" : ""}</td></tr>
        <tr><td><b>LSH-101</b></td><td colspan="2">${floatTxt("LSH", !!PL.X[1], L.trip || PL.X[1])}</td></tr>
        <tr><td><b>LSL-101</b></td><td colspan="2">${floatTxt("LSL", !PL.X[0], PL.X[0])}</td></tr>`;
      lab("VY-01", L.vy ? "aberta" : "fechada");
      lab("LSH-101", S.force.LSH != null ? "FORÇADA " + (S.force.LSH ? "▲" : "▼") : (L.trip || PL.X[1] ? "ATUOU" : "OK"), S.force.LSH != null || L.trip || PL.X[1]);
      lab("LSL-101", S.force.LSL != null ? "FORÇADA " + (S.force.LSL ? "▲" : "▼") : (PL.X[0] ? "ALARME" : "OK"), S.force.LSL != null || PL.X[0]);
      drawPlc();
    }
    renderClp();
  }
  function replaceHeater() {
    if (!S.burnt) { tip("A resistência está <b>boa</b>: não precisa substituir.", ""); return; }
    const P = S.proc;
    if (P.cmdOn) { tip("Antes de trocar, <b>desenergize a resistência</b>: seletora em DESL (ou emergência acionada) e relé não colado.", "bad"); return; }
    S.burnt = false; S.smokeT = 0; P.Th = P.T; P.burnT = 0;
    tip("<b>Resistência nova instalada.</b> Confira se há água cobrindo ela antes de ligar de novo.", "ok"); updateReadings();
  }
  function stepProc(dt) {
    const P = S.proc;
    const wired = !!window.__ttWired;
    const PL = window.PLC, clp = !!(PL && PL.run);
    let ctrl = false;
    if (!clp && window.MD) ctrl = MD.heat(P);
    else if (!clp && P.run && wired) { const e = P.sp - P.T; ctrl = e > 1 ? true : e < -1 ? false : P.ctrl; }
    P.ctrl = ctrl;
    if (S.force.TSH === true) P.trip = "tsh"; else if (S.force.TSH === false) { if (P.trip === "tsh") P.trip = false; } else if (!P.trip && P.T >= P.lim) P.trip = "tsh";
    if (clp && P.trip && S.force.TSH !== true && P.T <= P.lim - 5 && P.P <= P.plim - 0.15) P.trip = false; // rearme automático no comando pelo CLP
    const cmd = !S.ui.emerg && (clp ? PL.io.Y[4] : (P.run && ctrl));
    P.cmdOn = !P.trip && (P.stuck || cmd);   // comando de aquecimento energizado (mesmo com a resistência queimada)
    P.heat = P.cmdOn && !S.burnt;
    // água: menos água esquenta mais depressa; a 100 °C ferve (não passa disso) e evapora devagar
    const Lw = S.lvl ? S.lvl.L : 40, sub = Lw > 16;   // resistência coberta pela água
    const rate = P.heat && sub ? 1.6 * 40 / Math.max(Lw, 8) * clamp((P.Th - P.T) / 35, 0, 1) : 0;   // vai diminuindo ao se aproximar da temperatura da resistência (200 °C)
    P.T += (rate - 0.01 * (P.T - 25)) * dt;
    if (P.T > 200) P.T = 200;
    if (P.heat && sub && P.T >= 98 && S.lvl) S.lvl.L = Math.max(0, S.lvl.L - 0.25 * dt * clamp((P.T - 95) / 10, 0, 1));   // acima de ~100 °C: fervura e evaporação
    // elemento da resistência (máx. 200 °C): seca = sobe rápido e queima; molhada acompanha a água
    if (P.heat && !sub) P.Th = Math.min(200, P.Th + 45 * dt);
    else { const tg = P.heat ? Math.min(200, P.T + 35) : (sub ? P.T : 25); P.Th += (tg - P.Th) * Math.min(1, dt * (P.heat ? 1.5 : 0.25)); }
    if (P.heat && !sub && P.Th >= 200) { P.burnT += dt; if (P.burnT > 1.2 && !S.burnt) { S.burnt = true; S.smokeT = 18; P.heat = false; tip("<b>RESISTÊNCIA QUEIMADA!</b> Ela ficou ligada sem água e passou de 200 °C. Desligue o comando e <b>substitua a resistência</b> (botão no painel ou clique nela).", "bad"); } } else P.burnT = 0;
    if (S.burnt) S.smokeT = Math.max(0, (S.smokeT || 0) - dt); else S.smokeT = 0;
    P.smoke = S.burnt ? clamp(S.smokeT / 18, 0, 1) : (P.heat && !sub ? clamp((P.Th - 110) / 90, 0, 1) * 0.6 : 0);   // resistência seca esquentando ou queimada: solta fumaça
    P.boil = sub ? Math.max(clamp((P.Th - 95) / 45, 0, 1), clamp((P.T - 90) / 10, 0, 1) * 0.85) * (P.heat ? 1 : 0.35) : 0;   // intensidade das bolhas na resistência
    P.P = Math.max(0, (P.T - 25) * 0.035);
    // cor pela temperatura do elemento (60 → 200 °C); queimada = preta
    { const g = S.burnt ? 0 : clamp((P.Th - 60) / 140, 0, 1); S.tzGlow = g;
      if (S.burnt) { S.tzLamp.color.setHex(0x1c1816); S.tzLamp.emissive.setHex(0x000000); S.tzLamp.emissiveIntensity = 0; }
      else { S.tzLamp.color.setRGB(0.55 + 0.45 * g, 0.57 - 0.45 * g, 0.6 - 0.55 * g); S.tzLamp.emissive.setRGB(1, 0.1 + 0.55 * g * g, 0.02 + 0.4 * g * g * g); S.tzLamp.emissiveIntensity = 7 * g; }
      if (S.tzLight) S.tzLight.intensity = 3.6 * g; }
    if (S.tshLamp) { S.tshLamp.emissive.setHex(P.trip === "tsh" ? 0xE0503C : 0x1a6b3a); S.tshLamp.emissiveIntensity = P.trip === "tsh" ? 5 : 0.6; }
  }
  // sinaleiros e animação da porta/botões
  function updateDoor(PL) {
    const L = S.lvl, P = S.proc, blink = Math.floor(performance.now() / 350) % 2 === 0;
    const on = [L.pumpOn && !S.ui.emerg, L.trip || PL.io.X[1], PL.io.X[0], !!(P && P.heat), S.ui.emerg ? blink : !!(P && P.trip)];
    if (S.doorLamps) S.doorLamps.forEach((m, i) => { m.emissiveIntensity = on[i] ? 3.2 : 0.05; });
    if (S.selRes) S.selRes.rotation.z = S.ui.selRes ? -0.6 : 0.6;
    if (S.drainLever) S.drainLever.rotation.y += ((L.drain ? 0 : Math.PI / 2) - S.drainLever.rotation.y) * 0.25;
  }
  // clicar no sensor: automático → forçado atuado → forçado livre → automático
  const FKEY = { "LSH-101": "LSH", "LSL-101": "LSL", "TSH-104": "TSH" };
  function cycleForce(tag) {
    const k = FKEY[tag], cur = S.force[k]; S.force[k] = cur == null ? true : cur === true ? false : null;
    const v = S.force[k], fl = k !== "TSH";
    const txt = v == null ? "volta ao <b>automático</b> (segue a água)" : fl ? (v ? "<b>FORÇADA para cima</b> (água acima do ponto: contato fechado)" : "<b>FORÇADA para baixo</b> (água abaixo do ponto)") : (v ? "<b>FORÇADO atuado</b> (temperatura alta, contato do termostato aberto)" : "<b>FORÇADO livre</b> (nunca atua, mesmo quente)");
    tip("<b>" + tag + "</b> " + txt + ". Clique de novo para trocar.", v == null ? "" : "bad");
    updateReadings();
  }
  function releaseForce() { S.force.LSL = S.force.LSH = S.force.TSH = null; }
  function stepLevel(dt) {
    const L = S.lvl, PL = PLCo();
    let pumpCmd, vyCmd;
    if (PL.run) {
      pumpCmd = PL.io.Y[0]; vyCmd = PL.io.Y[1]; L.trip = false; L.pump = false;
      if (PL.io.X[1] && pumpCmd && !L.lshMsg) { L.lshMsg = true; tip("<b>LSH-101 atuado (X1 = 1)</b>, mas a bomba continua ligada: o programa não usa o X1 para proteger. Coloque um contato NF de X1 na rede do Y0.", "bad"); }
      if (!PL.io.X[1]) L.lshMsg = false;
    } else {
      if (window.MD) { MD.emerg = S.ui.emerg; MD.level(L, PL.io, dt); }
      else if (L.L >= 83 && L.pump) { L.trip = true; L.pump = false; renderHud(); tip("<b>LSH-101 atuou!</b> Nível alto: a chave desligou a bomba e a VY-01 fechou. É intertravamento: protege contra transbordar.", "bad"); }
      pumpCmd = L.pump; vyCmd = L.pump;
      // no comando local, a VY-01 também abre quando o motor gira pelo inversor (partida pela tecla verde da IHM)
      if (window.DRV && window.DRV.sel !== "direta" && (L.motorN || 0) > 0.03 && !L.trip) vyCmd = true;
    }
    if (pumpCmd && !vyCmd) { if (!L.deadMsg) { L.deadMsg = true; tip("Bomba ligada (Y0) com a <b>VY-01 fechada</b> (Y1 = 0): não há vazão. Ligue o Y1 junto com o Y0.", "bad"); } } else L.deadMsg = false;
    if (S.thermalTrip || S.pumpBurnt) { pumpCmd = false; vyCmd = false; if (window.MD) MD.k1 = false; }
    if (S.ui.emerg) { pumpCmd = false; vyCmd = false; if (window.MD) MD.k1 = false; }
    L.fv = 100;   // válvula manual do processo sempre aberta: a vazão varia só pela rotação da bomba
    L.vy = vyCmd;
    // seletora: DIRETA = contator K1 (60 Hz na hora) · INVERSOR = rotação vem do PowerFlex 525 (stepDrive)
    const dsel = window.DRV ? window.DRV.sel : "direta", inv = dsel !== "direta";
    if (!inv) { L.motorN = pumpCmd ? 1 : 0; L.motorDir = 1; }
    else if (pumpCmd && !window.DRV.list[dsel].state.run && !L.vfdMsg) { const m = drvExtMsg(dsel); if (m) { L.vfdMsg = true; tip("A bomba recebeu o comando, mas " + m, "bad"); } }
    if (!pumpCmd) L.vfdMsg = false;
    L.pumpOn = (L.motorN || 0) > 0.03;
    if (S.pumpBurnt) { L.motorN = 0; L.pumpOn = false; }
    const blocked = !!(S.valves && S.valves.some(x => !x.open)); S.blocked = blocked;
    const nEff = clamp(L.motorN || 0, 0, 1.25) * (L.motorDir < 0 ? 0.25 : 1);   // vazão ∝ rotação (lei de afinidade); ao contrário, a centrífuga entrega pouco
    L.Q = vyCmd && L.pumpOn && !blocked ? 30 * L.fv / 100 * nEff : 0;
    // bomba com registro fechado: gira sem vazão e sobreaquece; no inversor dispara falha de sobrecarga, na partida direta atua o relé térmico
    if (L.pumpOn && blocked) S.pumpT += 1.1 * nEff * dt; else S.pumpT += (25 - S.pumpT) * Math.min(1, 0.025 * dt);
    if (S.pumpT >= 70 && !S.pumpWarn) { S.pumpWarn = true; tip("<b>Bomba sobreaquecendo!</b> Ela está girando com o registro fechado, sem vazão. Abra o registro ou desligue a bomba.", "bad"); } else if (S.pumpT < 55) S.pumpWarn = false;
    if (S.pumpT >= 90) {
      if (inv) { const D0 = window.DRV.list[dsel]; if (L.pumpOn && D0 && !D0.faulted && D0.trip) { D0.trip(); S.pumpBurnt = true; S.pumpSmokeT = 20; tip("<b>Falha no inversor " + window.DRV.names[dsel] + "!</b> Sobrecarga: a <b>bomba queimou</b> por trabalhar com o registro fechado (sem vazão, sem refrigeração). Abra o registro, <b>substitua a bomba</b> e resete a falha no inversor.", "bad"); } }
      else if (pumpCmd && !S.thermalTrip) { S.thermalTrip = true; S.pumpBurnt = true; S.pumpSmokeT = 20; tip("<b>Relé térmico atuou e a bomba queimou!</b> Ela trabalhou com o registro fechado, sem vazão e sem refrigeração. Abra o registro e <b>substitua a bomba</b>.", "bad"); }
    }
    if (S.pumpT < 50) S.thermalTrip = false;
    const out = (L.drain ? 60 * clamp(L.drainPct, 0, 100) / 100 : 0) * Math.sqrt(Math.max(L.L, 0) / 100);   // dreno fechado = sem saída (antes vazava 3 L/min)
    L.L = clamp(L.L + (L.Q - out) / 60 / 300 * 100 * dt * 4, 0, 100);
    if (L.L >= 99.5 && L.Q > 0) { if (!L.overMsg) { L.overMsg = true; tip("<b>Transbordou!</b> O tanque de acrílico encheu até a borda. Nada desligou a bomba: use o LSH-101 (X1, contato NF) como proteção no programa.", "bad"); } } else if (L.L < 95) L.overMsg = false;
    setWater(L.L);
    S.pumpLamp.emissive.setHex(L.pumpOn ? 0x2EE07A : 0); S.pumpLamp.emissiveIntensity = L.pumpOn ? 3 : 0;
    const k1 = pumpCmd && !inv; S.k1Lamp.emissive.setHex(k1 ? 0x2EE07A : 0); S.k1Lamp.emissiveIntensity = k1 ? 3 : 0;
    const coils = S.coilLamps || {}, setCoil = (tag, on) => { const m = coils[tag]; if (m) { m.emissive.setHex(on ? 0x2EE07A : 0); m.emissiveIntensity = on ? 3 : 0; } };
    setCoil("KA1 · BOMBA", PL.run && dsel === "direta" && pumpCmd);
    setCoil("KA2 · RES", PL.run && PL.io.Y[4] && !S.ui.emerg);
    setCoil("K2 · RES", !!S.proc.heat && !S.ui.emerg);
    updateDoor(PL);
    if (S.vyLamp) { S.vyLamp.emissive.setHex(vyCmd ? 0xFFB020 : 0); S.vyLamp.emissiveIntensity = vyCmd ? 3 : 0; }
    if (S.lshLamp) { const on = L.trip || PL.io.X[1]; S.lshLamp.emissive.setHex(on ? 0xE0503C : 0x1a6b3a); S.lshLamp.emissiveIntensity = on ? 5 : 0.6; }
    if (S.lslLamp) { const on = PL.io.X[0]; S.lslLamp.emissive.setHex(on ? 0xE0503C : 0x1a6b3a); S.lslLamp.emissiveIntensity = on ? 5 : 0.6; }
  }

  /* ---------- animações das variáveis ---------- */
  const A = { t: 0, flowDist: 0, pumpW: 0, thermal: false, bubbles: [], steam: [], bubAcc: 0, steamAcc: 0 };
  function texArrow() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d");
    g.strokeStyle = "rgba(240,130,185,1)"; g.lineWidth = 9; // setas na cor do fluido (rosa) g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(14, 46); g.lineTo(32, 22); g.lineTo(50, 46); g.stroke();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function texStreak() {
    const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d");
    g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(0, 0, 128, 32); // base neutra: a cor vem do material (fluido rosa)
    for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255," + (0.2 + Math.random() * 0.6) + ")"; g.fillRect(Math.random() * 128, Math.random() * 32, 6 + Math.random() * 20, 1 + Math.random() * 2); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function texPuff() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.5, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function flowSleeves(parent, runs, r) {
    const list = [], R = r * 3.2, base = texArrow();
    for (const pts of runs) {
      const n = pts.length, dirs = [];
      for (let i = 0; i < n - 1; i++) dirs.push(new T.Vector3().subVectors(pts[i + 1], pts[i]).normalize());
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i].clone(), b = pts[i + 1].clone();
        if (i > 0) a.addScaledVector(dirs[i], R);
        if (i < n - 2) b.addScaledVector(dirs[i], -R);
        const len = a.distanceTo(b); if (len < 0.03) continue;
        const tex = base.clone(); tex.needsUpdate = true; tex.repeat.set(3, len / 0.11);
        const m = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
        const o = mesh(new T.CylinderGeometry(r * 1.2, r * 1.2, len, 18, 1, true), m, false, false);
        o.position.copy(a).addScaledVector(new T.Vector3().subVectors(b, a), 0.5); orientY(o, new T.Vector3().subVectors(b, a));
        o.renderOrder = 3; o.visible = false; parent.add(o); list.push({ o, tex, m });
      }
    }
    return list;
  }
  function initAnims(root) {
    // superfície da água (malha com ondas)
    const sg = new T.PlaneGeometry(0.636, 0.536, 36, 30).rotateX(-Math.PI / 2);
    A.surfBase = sg.attributes.position.array.slice();
    A.surf = mesh(sg, new T.MeshStandardMaterial({ color: 0xD4639A, transparent: true, opacity: 0.34, roughness: 0.04, metalness: 0.2, depthWrite: false, side: T.DoubleSide }), false, false);
    A.surf.renderOrder = 4; S.ac.add(A.surf);
    // jato de entrada
    A.jetTex = texStreak(); A.jetMat = new T.MeshStandardMaterial({ map: A.jetTex, color: 0xE07FAD, transparent: true, opacity: 0.88, roughness: 0.1, depthWrite: false });
    A.jet = null; A.jetKey = ""; A.jetAnchorY = null; A.jetP = []; A.jetAcc = 0;
    A.jetMesh = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), new T.MeshStandardMaterial({ color: 0xE07FAD, transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false }), 140);
    A.jetMesh.count = 0; A.jetMesh.renderOrder = 5; A.jetMesh.frustumCulled = false; S.ac.add(A.jetMesh);
    // bolhas
    A.bub = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), new T.MeshStandardMaterial({ color: 0xFFF3FA, transparent: true, opacity: 0.88, roughness: 0.05, emissive: 0x553344, emissiveIntensity: 0.35 }), 420);
    A.bub.count = 0; A.bub.renderOrder = 5; A.bub.frustumCulled = false; S.ac.add(A.bub);   // sem isso a esfera de culling (calculada com poucas bolhas) escondia as bolhas com o zoom perto
    // gotas (respingo do jato, ebulição e dreno): pool fixo de 96, mesma cor das bolhas
    A.drops = []; A.dropAcc = 0; A.dropAcc2 = 0; A.sl = 0; A.prevQ = 0; A.prevDrain = false;
    A.dropMesh = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), new T.MeshStandardMaterial({ color: 0xF8D6E6, transparent: true, opacity: 0.8, roughness: 0.05, depthWrite: false }), 96);
    A.dropMesh.count = 0; A.dropMesh.renderOrder = 6; A.dropMesh.frustumCulled = false; S.ac.add(A.dropMesh);
    // dreno: filete balístico que sai do cano, cai no piso e cai no ralo
    A.drainTex = texStreak(); A.drainMat = new T.MeshStandardMaterial({ map: A.drainTex, color: 0xE07FAD, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });
    A.drainG = streamGeo(); A.drain = mesh(A.drainG, A.drainMat, false, false); A.drain.renderOrder = 5; A.drain.frustumCulled = false; A.drain.visible = false; S.ac.add(A.drain);
    S.ac.add(at(mesh(new T.BoxGeometry(0.16, 0.006, 0.32), mat(0x5A6068, 0.6, 0.4), false), v3(0.12, 0.003, 0.52)));
    for (let i = 0; i < 6; i++) S.ac.add(at(mesh(new T.BoxGeometry(0.14, 0.008, 0.008), mat(0x2B2F36), false), v3(0.12, 0.007, 0.39 + i * 0.05)));
    // setas de fluxo na tubulação
    A.suc = flowSleeves(S.bench, [
      [v3(1.7, 0.64, -1.0), v3(1.7, 0.17, -1.0), v3(1.7, 0.17, -0.62), v3(0.78, 0.17, -0.62), v3(0.78, 0.17, -0.95), v3(0.895, 0.17, -0.95)]], 0.026);
    A.dis = flowSleeves(S.bench, [
      [v3(1.02, 0.31, -0.95), v3(1.02, 0.45, -0.95), v3(1.02, 0.45, -0.35), v3(1.24, 0.45, -0.35)],
      [v3(1.46, 0.45, -0.35), v3(1.74, 0.45, -0.35)], [v3(1.98, 0.45, -0.35), v3(2.26, 0.45, -0.35)],
      [v3(2.46, 0.45, -0.35), v3(2.75, 0.45, -0.35), v3(2.75, 0.45, -1.0), v3(2.75, 0.62, -1.0)],
      [v3(2.75, 1.175, -1.0), v3(2.75, 1.4, -1.0), v3(2.23, 1.4, -1.0)]], 0.024);
    // vapor
    const puff = texPuff();
    for (let i = 0; i < 30; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: puff, transparent: true, opacity: 0, depthWrite: false, color: 0x7F8C99 })); sp.visible = false; root.add(sp); A.steam.push({ sp, life: 1 }); }
    A.smoke = [];
    for (let i = 0; i < 80; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: puff, transparent: true, opacity: 0, depthWrite: false, color: 0x22201F })); sp.visible = false; root.add(sp); A.smoke.push({ sp, life: 1 }); }
  }
  const NJS = 28, MJS = 7;
  function streamGeo() {
    const g = new T.BufferGeometry(), n = (NJS + 1) * (MJS + 1), uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i <= NJS; i++) for (let m = 0; m <= MJS; m++) { uv[(i * (MJS + 1) + m) * 2] = i / NJS * 3; uv[(i * (MJS + 1) + m) * 2 + 1] = m / MJS; }
    for (let i = 0; i < NJS; i++) for (let m = 0; m < MJS; m++) { const p0 = i * (MJS + 1) + m, p1 = p0 + 1, p2 = p0 + MJS + 1, p3 = p2 + 1; idx.push(p0, p2, p1, p1, p2, p3); }
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute("uv", new T.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  // filete que sai na horizontal (hx,hz) com velocidade vh e cai sob gravidade; afina, ondula e abre em leque no impacto
  function fillStream(g, o) {
    const P3 = g.attributes.position.array, lx = -o.hz, lz = o.hx;
    for (let i = 0; i <= NJS; i++) {
      const u = i / NJS, tt = o.te * u, px = o.x + o.hx * o.vh * tt, pz = o.z + o.hz * o.vh * tt, py = o.y - 1.6 * tt * tt;
      const w = o.wob * u * Math.sin(u * 13 - o.ph * 0.6), r = o.r0 * (1 - 0.3 * u) * (1 + 0.9 * Math.pow(u, 10)) * (1 + 0.2 * Math.sin(u * 22 - o.ph) * u + 0.1 * Math.sin(u * 9 - o.ph * 0.7));
      let tx = o.hx * o.vh, ty = -3.2 * tt, tz = o.hz * o.vh; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const bx = ty * lz, by = tz * lx - tx * lz, bz = -ty * lx;                      // B = T x L
      for (let m = 0; m <= MJS; m++) { const a = m / MJS * 6.2832, c = Math.cos(a) * r, sn = Math.sin(a) * r, k = (i * (MJS + 1) + m) * 3;
        P3[k] = px + (w + c) * lx + sn * bx; P3[k + 1] = py + sn * by; P3[k + 2] = pz + (w + c) * lz + sn * bz; }
    }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }
  const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _sc = new T.Vector3(), _p = new T.Vector3(), _v3 = new T.Vector3(), _yUp = new T.Vector3(0, 1, 0);
  function stepAnims(dt) {
    A.t += dt; const t = A.t;
    if (S.panelInterior && S.door) { const vis = S.door.open || S.door.ang > 0.03; if (S.panelIntVis !== vis) { S.panelIntVis = vis; for (const o of S.panelInterior) o.visible = vis; } }
    for (const vv of (S.valves || [])) vv.lv.rotation.y += ((vv.open ? 0 : Math.PI / 2) - vv.lv.rotation.y) * Math.min(1, dt * 8);
    if (S.pumpMats) { const k = clamp(((S.pumpT || 25) - 35) / 55, 0, 1), hot = new T.Color(0xD2461C), char = new T.Color(0x2B2623); for (const [m, c0] of S.pumpMats) { m.color.copy(c0).lerp(hot, k); if (S.pumpBurnt) { m.color.copy(char); m.emissiveIntensity = 0; } else { m.emissive.setRGB(0.9 * k, 0.18 * k, 0.02 * k); m.emissiveIntensity = 0.6 * k; } } }
    { const kp = S.pumpBurnt ? clamp((S.pumpSmokeT || 0) / 20, 0, 1) : ((S.pumpT || 25) > 70 ? clamp(((S.pumpT || 25) - 70) / 20, 0, 1) * 0.6 : 0);
      if (S.pumpBurnt) S.pumpSmokeT = Math.max(0, (S.pumpSmokeT || 0) - dt);
      A.smokeAccP = (A.smokeAccP || 0) + dt * kp * 14;
      while (A.smokeAccP > 1 && S.pumpG) { A.smokeAccP--; const p = A.smoke.find(x => x.life >= 1); if (!p) break; const o = S.pumpG.localToWorld(v3(0.27 + (Math.random() - 0.5) * 0.1, 0.34, (Math.random() - 0.5) * 0.08)); p.life = 0; p.sp.position.copy(o); p.vx = (Math.random() - 0.5) * 0.05; p.vz = (Math.random() - 0.5) * 0.05; p.s0 = 0.05 + Math.random() * 0.04; } }
    if (A.qSeen !== qName) {
      A.qSeen = qName;
      if (qName === "baixa") { if (A.surf) { const pa = A.surf.geometry.attributes.position.array; for (let i = 1; i < pa.length; i += 3) pa[i] = 0; A.surf.geometry.attributes.position.needsUpdate = true; A.surf.geometry.computeVertexNormals(); } drawPcScreen(0); }
    }
    A.pcT = (A.pcT || 0) + dt; if (A.pcT > QUAL[qName].pc) { A.pcT = 0; drawPcScreen(t); }
    if (S.door) { const tg = S.door.open ? 1.75 : 0; S.door.ang += (tg - S.door.ang) * Math.min(1, dt * 3.5); S.door.hinge.rotation.y = S.door.ang; }
    if (S.conduits) for (const c of S.conduits) c.g.visible = S.showCond !== false && (c.always || !!S.installed[c.tag]);
    const L = S.lvl, P = S.proc;
    const Q = ready("ln") ? L.Q : 0, pumpOn = ready("ln") && L.pumpOn;
    const topY = 0.65 + 0.88 * L.L / 100;
    // ---- superfície com ondas e ondulação no ponto de impacto
    const submerged = topY >= 1.38, jetOn = Q > 0.2 && !submerged;
    // A trajetória é ancorada ao nível no início do fluxo; com vazão constante, não acompanha a subida da superfície.
    const jetCurve = (q, ty) => { const g = 3.2, te = Math.sqrt(2 * Math.max(1.4 - ty, 0.02) / g), vx = Math.min(0.3 + 0.9 * q / 30, 0.5 / te), pts = []; for (let i = 0; i <= 10; i++) { const tt = te * i / 10; pts.push(v3(0.31 - vx * tt, 1.4 - 0.5 * g * tt * tt, 0)); } return pts; };
    if (jetOn && A.jetAnchorY == null) A.jetAnchorY = topY;
    if (!jetOn) A.jetAnchorY = null;
    const jpts = jetOn ? jetCurve(Q, topY) : null;
    const ix = submerged ? 0.3 : jpts ? jpts[10].x : 0.17, iz = 0;
    const pos = A.surf.geometry.attributes.position, base = A.surfBase;
    const amp = 0.0015 + 0.005 * Q / 30 + (L.drain ? 0.0015 : 0) + 0.0045 * (S.proc ? S.proc.boil : 0), rip = Q > 0.2 ? 0.007 * (0.4 + Q / 30) : 0;
    // balanço (slosh): mudanças de vazão/dreno excitam modos estacionários da superfície que amortecem aos poucos
    const dQ = Math.abs(Q - A.prevQ) / 30 + (!!L.drain !== A.prevDrain ? 0.25 : 0); A.prevQ = Q; A.prevDrain = !!L.drain;
    A.sl = Math.min(1.5, A.sl * Math.exp(-0.55 * dt) + dQ * 1.2);
    const sA = 0.0045 * A.sl + 0.0008 * Q / 30, c1 = Math.cos(t * 5.2), c2 = Math.cos(t * 7.6 + 1), c3 = Math.sin(t * 3.1);
    const wvq = QUAL[qName].wv, doWave = wvq > 0 && ((A.wvN = (A.wvN || 0) + 1) % wvq) === 0;
    if (doWave) for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      const d = Math.hypot(x - ix, z - iz);
      const y = amp * (0.5 * Math.sin(x * 23 + t * 2.6) + 0.3 * Math.sin(z * 29 - t * 2.1) + 0.2 * Math.sin((x + z) * 41 + t * 3.7))
        + rip * Math.sin(d * 70 - t * 10) * Math.exp(-d * 9)
        + sA * (Math.cos(x * 4.9) * c1 + 0.6 * Math.cos(z * 5.8) * c2 + 0.4 * Math.sin(x * 9.8) * Math.cos(z * 5.8) * c3);
      pos.array[i * 3 + 1] = y;
    }
    if (doWave) { pos.needsUpdate = true; A.surf.geometry.computeVertexNormals(); }
    A.surf.position.set(0, topY + 0.002, 0); A.surf.visible = L.L > 0.5;
    // ---- jato de entrada
    const dropAdd = (x, y, z, vx, vy, vz, r, kind) => { let d = A.drops.find(q => !q.on); if (!d) { if (A.drops.length >= 96) return; d = {}; A.drops.push(d); } Object.assign(d, { on: true, x, y, z, vx, vy, vz, r, kind }); };
    // microbolhas em suspensão: dão a sensação de líquido diluído/turvo; circulam mais rápido com a vazão
    if (!A.amb) { A.amb = new T.InstancedMesh(new T.SphereGeometry(1, 5, 4), new T.MeshStandardMaterial({ color: 0xF8D6E6, transparent: true, opacity: 0.4, roughness: 0.1, depthWrite: false }), 110); A.amb.renderOrder = 4; A.amb.frustumCulled = false; S.ac.add(A.amb);
      A.ambP = []; for (let i = 0; i < 110; i++) A.ambP.push({ x: (Math.random() - 0.5) * 0.58, y: Math.random(), z: (Math.random() - 0.5) * 0.48, r: 0.0011 + Math.random() * 0.0016, v: 0.008 + Math.random() * 0.022, ph: Math.random() * 6.28 }); }
    { const nA = L.L > 4 ? Math.min(Math.round(110 * qpf()), Math.floor(L.L * 1.6)) : 0, hh = Math.max(0.01, topY - 0.7), fl = 1 + Q / 12 + (L.drain ? 0.5 : 0); let na = 0;
      for (let i = 0; i < nA; i++) { const p = A.ambP[i];
        p.y += p.v * fl * dt / hh; if (p.y > 1) { p.y -= 1; p.x = (Math.random() - 0.5) * 0.58; p.z = (Math.random() - 0.5) * 0.48; }
        p.x += Math.sin(t * 0.7 + p.ph) * 0.012 * fl * dt + (Q > 0.2 ? -0.01 * Q / 30 * dt : 0); p.z += Math.cos(t * 0.6 + p.ph * 1.7) * 0.012 * fl * dt;
        if (p.x < -0.29) p.x = 0.29; else if (p.x > 0.29) p.x = -0.29; if (p.z < -0.24) p.z = 0.24; else if (p.z > 0.24) p.z = -0.24;
        _m4.compose(_p.set(p.x, 0.7 + p.y * hh, p.z), _q.identity(), _sc.set(p.r, p.r, p.r)); A.amb.setMatrixAt(na++, _m4); }
      A.amb.count = na; if (na) A.amb.instanceMatrix.needsUpdate = true; }
    // espuma de bolhas no ponto de impacto (some sozinha): esconde o encontro do filete com a água
    if (!A.foam) { A.foam = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), new T.MeshStandardMaterial({ color: 0xF8D6E6, transparent: true, opacity: 0.6, roughness: 0.05, depthWrite: false }), 90); A.foam.count = 0; A.foam.renderOrder = 6; A.foam.frustumCulled = false; S.ac.add(A.foam); A.foamP = []; A.foamAcc = 0; }
    if (jetOn && L.L > 0.5) { A.foamAcc += dt * qpf() * (18 + 50 * Q / 30); while (A.foamAcc > 1) { A.foamAcc--; let f = A.foamP.find(z => !z.on); if (!f) { if (A.foamP.length >= 90) break; f = {}; A.foamP.push(f); }
      const a = Math.random() * 6.28, d = Math.random() * 0.03 * (0.6 + Q / 30); Object.assign(f, { on: true, x: ix + Math.cos(a) * d, z: iz + Math.sin(a) * d, vx: Math.cos(a) * 0.02, vz: Math.sin(a) * 0.02, life: 0, max: 0.8 + Math.random() * 1.2, r: 0.003 + Math.random() * 0.005 }); } }
    const bo0 = S.proc ? S.proc.boil : 0;
    if (bo0 > 0.15 && L.L > 17) { A.foamAcc2 = (A.foamAcc2 || 0) + dt * qpf() * 70 * bo0; while (A.foamAcc2 > 1) { A.foamAcc2--; let f = A.foamP.find(z => !z.on); if (!f) { if (A.foamP.length >= 90) break; f = {}; A.foamP.push(f); } Object.assign(f, { on: true, x: (Math.random() - 0.5) * 0.14, z: -0.26 + Math.random() * 0.3, vx: (Math.random() - 0.5) * 0.03, vz: (Math.random() - 0.5) * 0.03, life: 0, max: 0.35 + Math.random() * 0.7, r: 0.003 + Math.random() * 0.006 }); } }
    if (S.tzTex) S.tzTex.offset.x -= dt * (0.15 + 1.6 * (S.tzGlow || 0));
    let nf = 0;
    for (const f of A.foamP) { if (!f.on) continue; f.life += dt; if (f.life >= f.max || topY >= 1.38) { f.on = false; continue; }
      f.x = Math.max(-0.3, Math.min(0.3, f.x + f.vx * dt)); f.z = Math.max(-0.25, Math.min(0.25, f.z + f.vz * dt)); const k = Math.sin(Math.PI * f.life / f.max), rr = f.r * (0.4 + k);
      _m4.compose(_p.set(f.x, topY + 0.003, f.z), _q.identity(), _sc.set(rr * 1.3, rr * 0.45, rr * 1.3)); A.foam.setMatrixAt(nf++, _m4); }
    A.foam.count = nf; if (nf) A.foam.instanceMatrix.needsUpdate = true;
    // Jato de entrada: filete fino e translúcido, deformado a cada quadro (ondulação que desce, afinamento, estrangulamento) + gotas satélite esparsas.
    const NJ = 28, MJ = 7;
    if (!A.jetG) {
      const g = new T.BufferGeometry(), n = (NJ + 1) * (MJ + 1), uv = new Float32Array(n * 2), idx = [];
      for (let i = 0; i <= NJ; i++) for (let m = 0; m <= MJ; m++) { uv[(i * (MJ + 1) + m) * 2] = i / NJ * 3; uv[(i * (MJ + 1) + m) * 2 + 1] = m / MJ; }
      for (let i = 0; i < NJ; i++) for (let m = 0; m < MJ; m++) { const p0 = i * (MJ + 1) + m, p1 = p0 + 1, p2 = p0 + MJ + 1, p3 = p2 + 1; idx.push(p0, p2, p1, p1, p2, p3); }
      g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute("uv", new T.BufferAttribute(uv, 2)); g.setIndex(idx);
      A.jetG = g; A.jet = mesh(g, A.jetMat, false, false); A.jet.renderOrder = 5; A.jet.frustumCulled = false; A.jet.visible = false; S.ac.add(A.jet);
      A.jetMat.opacity = 0.5;
    }
    let vx0 = 0, te0 = 0;
    if (jetOn) {
      te0 = Math.sqrt(2 * Math.max(1.4 - topY, 0.02) / 3.2); vx0 = Math.min(0.3 + 0.9 * Q / 30, 0.5 / te0);
      const P3 = A.jetG.attributes.position.array, r0 = 0.0055 + 0.0055 * Q / 30, ph = t * 20;
      for (let i = 0; i <= NJ; i++) {
        const u = i / NJ, tt = te0 * u, cx = 0.31 - vx0 * tt, cy = 1.4 - 1.6 * tt * tt;
        const wob = 0.0035 * u * Math.sin(u * 13 - ph * 0.6) * (0.4 + Q / 30), r = r0 * (1 - 0.35 * u) * (1 + 0.9 * Math.pow(u, 10)) * (1 + 0.22 * Math.sin(u * 22 - ph) * u + 0.1 * Math.sin(u * 9 - ph * 0.7));
        let tx = -vx0, ty = -3.2 * tt; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;   // tangente; normal no plano = (ty, -tx), outra normal = z
        for (let m = 0; m <= MJ; m++) { const a = m / MJ * 6.2832, c = Math.cos(a) * r, sn = Math.sin(a) * r, o = (i * (MJ + 1) + m) * 3;
          P3[o] = cx + ty * sn; P3[o + 1] = cy - tx * sn; P3[o + 2] = wob + c; }
      }
      A.jetG.attributes.position.needsUpdate = true; A.jetG.computeVertexNormals(); A.jetG.computeBoundingSphere();
      A.jet.visible = true; A.jetTex.offset.x -= dt * (2.5 + 3 * Q / 30);
      A.jetAcc += dt * qpf() * (45 + 70 * Q / 30);
      while (A.jetAcc > 1) { A.jetAcc--; let p = A.jetP.find(z => !z.on); if (!p) { if (A.jetP.length >= 140) break; p = {}; A.jetP.push(p); }
        const u = 0.25 + 0.75 * Math.random(), tt = te0 * u; Object.assign(p, { on: true, x: 0.31 - vx0 * tt, y: 1.4 - 1.6 * tt * tt, z: (Math.random() - 0.5) * 0.008, vx: -vx0 + (Math.random() - 0.5) * 0.12, vy: -3.2 * tt + (Math.random() - 0.3) * 0.12, vz: (Math.random() - 0.5) * 0.14, r: 0.0016 + 0.0016 * Math.random() }); }
    } else if (A.jet) A.jet.visible = false;
    let nj = 0; const Y = _yUp;
    for (const p of A.jetP) { if (!p.on) continue;
      p.vy -= 3.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y <= topY || p.x < -0.31) { p.on = false; continue; }
      const sp = Math.hypot(p.vx, p.vy, p.vz) || 1; _v3.set(p.vx / sp, p.vy / sp, p.vz / sp); _q.setFromUnitVectors(Y, _v3);
      _m4.compose(_p.set(p.x, p.y, p.z), _q, _sc.set(p.r, p.r * (1.1 + sp * 0.5), p.r)); A.jetMesh.setMatrixAt(nj++, _m4); }
    A.jetMesh.count = nj; if (nj) A.jetMesh.instanceMatrix.needsUpdate = true;
    // ---- bolhas
    if (Q > 0.2) { A.bubAcc += dt * qpf() * (14 + Q * 3.2); while (A.bubAcc > 1) { A.bubAcc--; let b = A.bubbles.find(x => !x.on); if (!b) { if (A.bubbles.length >= 420) break; b = {}; A.bubbles.push(b); }
      Object.assign(b, { on: true, x: ix + (Math.random() - 0.5) * 0.1, z: iz + (Math.random() - 0.5) * 0.1, y: (submerged ? 1.4 : topY) - 0.01 - Math.random() * 0.2, v: -(0.03 + 0.22 * Math.random() * (0.3 + Q / 30)), vt: 0.05 + Math.random() * 0.14, r: 0.0022 + Math.random() * Math.random() * 0.0085, vx: -0.05 - Math.random() * 0.1 * Q / 30, vz: (Math.random() - 0.5) * 0.08, ph: Math.random() * 6.28 }); } }
    const bo = S.proc ? S.proc.boil : 0;
    if (bo > 0.02) { A.boilAcc = (A.boilAcc || 0) + dt * qpf() * (14 + 330 * bo); while (A.boilAcc > 1) { A.boilAcc--; let b = A.bubbles.find(x => !x.on); if (!b) { if (A.bubbles.length >= 420) break; b = {}; A.bubbles.push(b); }
      { const th = Math.PI / 2 + (Math.floor(Math.random() * 3)) * Math.PI * 2 / 3 - 0.0, rr = 0.03 + (Math.random() - 0.5) * 0.04; Object.assign(b, { on: true, x: rr * Math.cos(th) * 1.0 + (Math.random() - 0.5) * 0.02, z: -0.26 + Math.random() * 0.3, y: 0.74 + rr * Math.sin(th) + Math.random() * 0.02, v: 0.16 + Math.random() * 0.3, vt: 0, r: 0.0036 + Math.random() * Math.random() * 0.013 * (0.5 + bo), vx: 0, vz: 0, ph: Math.random() * 6.28 }); } } }
    // gotas: pool fixo (96); kind 0 = dentro do tanque (cai na superfície), 1 = respingo do ralo no piso
    let n = 0;
    for (const b of A.bubbles) { if (!b.on) continue;
      const k = Math.exp(-1.5 * dt); b.vx *= k; b.vz *= k;                       // deriva do jato some com o tempo
      if (b.vt) b.v += (b.vt - b.v) * Math.min(1, dt * 1.6);
      b.y += b.v * (1 + 0.5 * b.r * 100) * dt;                                      // bolhas maiores sobem mais rápido
      b.x += b.vx * dt + Math.cos(t * 6 + b.ph) * 0.0012; b.z += b.vz * dt + Math.sin(t * 5.3 + b.ph) * 0.0012;
      if (b.x < -0.3) { b.x = -0.3; b.vx = 0; } else if (b.x > 0.3) { b.x = 0.3; b.vx = 0; } if (b.z < -0.25) { b.z = -0.25; b.vz = 0; } else if (b.z > 0.25) { b.z = 0.25; b.vz = 0; }
      if (b.y >= topY) { b.on = false; if (b.r > 0.005 && Math.random() < 0.5) dropAdd(b.x, topY, b.z, (Math.random() - 0.5) * 0.08, 0.18 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08, 0.0018, 0); continue; }
      if (b.y < 0.68) { b.on = false; continue; }
      const w = 1 + 0.15 * Math.sin(t * 9 + b.ph);                                  // leve oscilação de forma
      _m4.compose(_p.set(b.x, b.y, b.z), _q, _sc.set(b.r * w, b.r / w, b.r * w)); A.bub.setMatrixAt(n++, _m4); if (n >= 420) break; }
    A.bub.count = n; A.bub.instanceMatrix.needsUpdate = true;
    // respingo no ponto de impacto do jato
    if (jetOn && L.L > 0.5) { A.dropAcc += dt * qpf() * (8 + 40 * Q / 30); while (A.dropAcc > 1) { A.dropAcc--; const a = Math.random() * 6.28, sp = 0.05 + Math.random() * 0.12 * (0.5 + Q / 30);
      dropAdd(ix + Math.cos(a) * 0.01, topY, iz + Math.sin(a) * 0.01, Math.cos(a) * sp - 0.05, 0.35 + Math.random() * 0.55 * (0.5 + Q / 30), Math.sin(a) * sp, 0.0015 + Math.random() * 0.0025, 0); } }
    // ebulição solta salpicos finos
    if (bo > 0.3 && L.L > 20) { A.dropAcc2 += dt * 25 * bo; while (A.dropAcc2 > 1) { A.dropAcc2--; dropAdd((Math.random() - 0.5) * 0.12, topY, -0.26 + Math.random() * 0.3, (Math.random() - 0.5) * 0.1, 0.25 + Math.random() * 0.35, (Math.random() - 0.5) * 0.1, 0.0015 + Math.random() * 0.002, 0); } }
    let nd = 0;
    for (const d of A.drops) { if (!d.on) continue;
      d.vy -= 4 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.kind === 0 ? (d.y < topY || d.y > 1.5 || d.x < -0.31 || d.x > 0.31 || d.z < -0.26 || d.z > 0.26) : d.y < 0.005) { d.on = false; continue; }
      _m4.compose(_p.set(d.x, d.y, d.z), _q, _sc.set(d.r, d.r * (1 + Math.min(1.2, Math.abs(d.vy) * 0.8)), d.r)); A.dropMesh.setMatrixAt(nd++, _m4); }
    A.dropMesh.count = nd; if (nd) A.dropMesh.instanceMatrix.needsUpdate = true;
    // ---- dreno: filete balístico (vazão = abertura × raiz do nível), gotas satélite e respingo no ralo do piso
    const fD = L.drain ? clamp(L.drainPct, 0, 100) / 100 * Math.sqrt(Math.max(L.L, 0) / 100) : 0, drainOn = fD > 0.02 && L.L > 1;
    A.drain.visible = drainOn;
    if (drainOn) {
      const vh = 0.18 + 0.55 * fD, te = Math.sqrt(2 * 0.384 / 3.2), lz = 0.31 + vh * te;
      if (qName !== "baixa" || (A.drnN = (A.drnN || 0) + 1) % 8 === 1) fillStream(A.drainG, { x: 0.12, y: 0.39, z: 0.31, hx: 0, hz: 1, vh, te, r0: 0.005 + 0.008 * fD, wob: 0.003 * (0.4 + fD), ph: t * 20 });
      A.drainTex.offset.x -= dt * (2.5 + 3 * fD);
      A.dropAcc3 = (A.dropAcc3 || 0) + dt * qpf() * (10 + 30 * fD);
      while (A.dropAcc3 > 1) { A.dropAcc3--;
        if (Math.random() < 0.7) { const a = Math.random() * 6.28, sp = 0.05 + Math.random() * 0.12 * (0.5 + fD); dropAdd(0.12 + Math.cos(a) * 0.01, 0.008, lz, Math.cos(a) * sp, 0.25 + Math.random() * 0.45 * (0.5 + fD), Math.sin(a) * sp * 0.8, 0.0015 + Math.random() * 0.0025, 1); }
        else { const u = 0.3 + 0.7 * Math.random(), tt = te * u; dropAdd(0.12, 0.39 - 1.6 * tt * tt, 0.31 + vh * tt, (Math.random() - 0.5) * 0.1, -3.2 * tt, vh + (Math.random() - 0.5) * 0.1, 0.0015 + Math.random() * 0.0015, 1); } }
    }
    // ---- setas de fluxo
    const speed = 0.2 + 1.3 * Q / 30; A.flowDist += speed * dt * (Q > 0.2 ? 1 : 0);
    const op = Q > 0.2 ? Math.min(0.9, 0.35 + Q / 30) : 0;
    for (const f of [...A.suc, ...A.dis]) { f.m.opacity += (op - f.m.opacity) * Math.min(1, dt * 4); f.o.visible = f.m.opacity > 0.02; f.tex.offset.y = -A.flowDist / 0.11; }
    // ---- motor: partida/parada suaves e vibração
    // com inversor, a rotação já vem com a rampa; na partida direta, o motor sobe rápido
    const invM = !!window.DRV && window.DRV.sel !== "direta", mN = invM ? clamp(L.motorN || 0, 0, 1.25) : (pumpOn ? 1 : 0);
    A.pumpW += (mN - A.pumpW) * Math.min(1, dt * (invM ? 8 : pumpOn ? 1.6 : 0.8));
    if (S.pumpFan) S.pumpFan.rotation.x += dt * 55 * A.pumpW * (invM && L.motorDir < 0 ? -1 : 1);
    if (S.pumpG) { const v = 0.0009 * A.pumpW; S.pumpG.position.set(S.pumpBase.x + (Math.random() - 0.5) * v, S.pumpBase.y + (Math.random() - 0.5) * v, S.pumpBase.z + (Math.random() - 0.5) * v); }
    // ---- boias seguem a água
    const tilt = (pv, yS, fo) => { if (!pv) return; const target = (fo != null ? fo : topY > yS + 0.01) ? 0.1 : -0.85; pv.rotation.x += (target - pv.rotation.x) * Math.min(1, dt * 3); };
    tilt(S.lshPivot, 1.38, S.force.LSH); tilt(S.lslPivot, 0.8, S.force.LSL);
    // ---- temperatura: vapor pelo respiro
    const hot = ready("tq") ? clamp((P.T - 55) / 30, 0, 1) : 0;
    A.steamAcc += dt * hot * 9;
    while (A.steamAcc > 1) { A.steamAcc--; const p = A.steam.find(x => x.life >= 1); if (!p) break; p.life = 0; p.sp.position.set(1.95 + DX, 1.6, -1.0); p.vx = 0.04 + Math.random() * 0.05; p.vz = (Math.random() - 0.5) * 0.04; p.s0 = 0.05 + Math.random() * 0.04; }
    for (const p of A.steam) {
      if (p.life >= 1) { p.sp.visible = false; continue; }
      p.life += dt / 2.6; p.sp.visible = true;
      p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt; p.sp.position.y += (0.18 + 0.12 * p.life) * dt;
      const sc = p.s0 + p.life * 0.35; p.sp.scale.set(sc, sc, sc);
      p.sp.material.opacity = Math.sin(Math.PI * Math.min(1, p.life)) * (0.4 + 0.35 * hot);
    }
    // ---- fumaça escura (resistência queimada ou muito quente e seca)
    { const k = S.proc ? S.proc.smoke || 0 : 0; A.smokeAcc = (A.smokeAcc || 0) + dt * k * 12;
      while (A.smokeAcc > 1) { A.smokeAcc--; const p = A.smoke.find(x => x.life >= 1); if (!p) break; const o = S.ac.localToWorld(v3((Math.random() - 0.5) * 0.12, 1.58, -0.2 + (Math.random() - 0.5) * 0.18)); p.life = 0; p.sp.position.copy(o); p.vx = (Math.random() - 0.5) * 0.06; p.vz = (Math.random() - 0.5) * 0.06; p.s0 = 0.06 + Math.random() * 0.05; }
      for (const p of A.smoke) { if (p.life >= 1) { p.sp.visible = false; continue; } p.life += dt / 3.4; p.sp.visible = true; p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt; p.sp.position.y += (0.2 + 0.18 * p.life) * dt; const sc = p.s0 + p.life * 0.5; p.sp.scale.set(sc, sc, sc); p.sp.material.opacity = Math.sin(Math.PI * Math.min(1, p.life)) * 0.6; } }
    // ---- visão térmica do TQ-01
    if (A.thermal && ready("tq")) { const k = clamp((P.T - 20) / 75, 0, 1); S.water.material.color.setHSL(0.66 * (1 - k), 0.9, 0.55); }
    else S.water.material.color.setHex(0xDE6FA3);
  }

  /* ---------- câmera ---------- */
  const VIEWS = {
    geral: { p: v3(-0.6, 2.7, 4.4), t: v3(-2.8, 1.0, -0.8) },
    topo: { p: v3(-1.1, 2.7, 0.2), t: v3(-1.5, 1.5, -1.0) },
    lateral: { p: v3(-1.5, 1.6, 1.7), t: v3(-1.5, 1.0, -1.0) },
    acrilico: { p: v3(-0.90, 1.8, 1.25), t: v3(-1.45, 1.0, -0.8) },
    tubulacao: { p: v3(-1.50, 1.25, 1.15), t: v3(-1.55, 0.38, -0.4) },
    painel: { p: v3(-3.6, 1.75, -0.95), t: v3(-4.85, 1.65, -1.25) },
    clp: { p: v3(-4.42, 1.8, -1.0), t: v3(-4.95, 1.78, -1.0) },
    inversor: { p: v3(-3.85, 1.65, -0.2), t: v3(-4.96, 1.55, -0.2) },
    dreno: { p: v3(-1.2, 0.7, 0.15), t: v3(-1.63, 0.28, -0.62) },
    "inv-pf525": { p: v3(-4.38, 1.62, -0.48), t: v3(-4.96, 1.6, -0.48) },
    "inv-atv12": { p: v3(-4.38, 1.62, -0.2), t: v3(-4.96, 1.6, -0.2) },
    "inv-cfw500": { p: v3(-4.3, 1.62, 0.08), t: v3(-4.96, 1.6, 0.08) },
  };
  // obstáculos (coordenadas do mundo): caixas [xmin, xmax, zmin, zmax, ytopo] e cilindros [x, z, raio, ytopo]
  const ROOM = { x0: -4.82, x1: 4.82, z0: -3.85, z1: 4.82, y0: 0.25, y1: 3.0 };
  const BOXES = [
    [-1.98, -1.02, -1.48, -0.52, 1.75], [-2.68, -1.85, -1.18, -0.72, 0.45], [-0.8, -0.5, -1.12, -0.88, 1.45],
    [-4.12, -2.48, -4.0, -3.05, 2.15], [1.98, 4.22, -4.0, -3.33, 1.8], [3.88, 4.62, -2.88, -1.72, 1.75],
    [4.38, 5.0, -1.25, 5.0, 3.2], [-5.0, -4.38, 0.95, 5.0, 3.2], [-5.0, -4.62, -1.7, -0.7, 2.15], [-2.55, -2.15, -3.6, -3.2, 0.7],
  ];
  const CYLS = [];
  function clampCam() {
    const p = S.cam.position, t = S.ctl.target, m = 0.14;
    t.x = clamp(t.x, ROOM.x0 + 0.2, ROOM.x1 - 0.2); t.z = clamp(t.z, ROOM.z0 + 0.2, ROOM.z1 - 0.2); t.y = clamp(t.y, 0.1, 2.9);
    p.x = clamp(p.x, ROOM.x0, ROOM.x1); p.z = clamp(p.z, ROOM.z0, ROOM.z1); p.y = clamp(p.y, ROOM.y0, ROOM.y1);
    for (const [x0, x1, z0, z1, top] of BOXES) {
      if (p.y > top + m) continue;
      if (p.x > x0 - m && p.x < x1 + m && p.z > z0 - m && p.z < z1 + m) {
        const d = [[p.x - (x0 - m), "x", x0 - m], [(x1 + m) - p.x, "x", x1 + m], [p.z - (z0 - m), "z", z0 - m], [(z1 + m) - p.z, "z", z1 + m], [(top + m) - p.y, "y", top + m]];
        const lim = { x: [ROOM.x0, ROOM.x1], z: [ROOM.z0, ROOM.z1], y: [ROOM.y0, ROOM.y1] };
        const ok = d.filter(([, ax, v]) => v >= lim[ax][0] && v <= lim[ax][1]).sort((a, b) => a[0] - b[0]);
        if (ok.length) { const [, ax, v] = ok[0]; p[ax] = v; }
      }
    }
    for (const [cx, cz, rad, top] of CYLS) {
      if (p.y > top + m) continue;
      const dx = p.x - cx, dz = p.z - cz, dd = Math.hypot(dx, dz), R = rad + m;
      if (dd < R) { if (dd < 1e-4) { p.z = cz + R; } else { p.x = cx + dx / dd * R; p.z = cz + dz / dd * R; } }
    }
    p.x = clamp(p.x, ROOM.x0, ROOM.x1); p.z = clamp(p.z, ROOM.z0, ROOM.z1);
  }
  function goView(k) { const v = VIEWS[k]; if (S.door) { if (k === "clp" || k === "inversor") S.door.open = true; else if (k === "painel") S.door.open = false; } S.tw = { p0: S.cam.position.clone(), t0: S.ctl.target.clone(), p1: v.p.clone(), t1: v.t.clone(), k: 0 }; }

  /* ---------- inicialização ---------- */
  function init(wrap) {
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: qName === "alta" }); }
    catch (e) { $("#load3d").textContent = "Este computador não conseguiu iniciar o 3D (WebGL). Atualize o navegador ou o driver de vídeo."; return; }
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.12; // Neutral: preserva as cores (canos verdes, fluido rosa, azul/laranja)
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.domElement.className = "c3d";
    wrap.prepend(renderer.domElement);
    const lr = new T.CSS2DRenderer(); lr.domElement.className = "l3layer"; wrap.appendChild(lr.domElement);
    const scene = new T.Scene(); scene.background = new T.Color(0xE9EDF1);
    const cam = new T.PerspectiveCamera(42, 1, 0.03, 60);
    cam.position.copy(VIEWS.geral.p);
    const ctl = new T.OrbitControls(cam, renderer.domElement);
    ctl.target.copy(VIEWS.geral.t); ctl.enableDamping = true; ctl.minDistance = 0.35; ctl.maxDistance = 7.5; ctl.maxPolarAngle = Math.PI * 0.495;
    ctl.addEventListener("start", () => { S.tw = null; });
    // andar com o teclado: W A S D ou setas (frente/trás/lados), Q/E ou PageUp/PageDown (sobe/desce), Shift = mais rápido
    const KEYS = new Set();
    const KMAP = { KeyW: "f", ArrowUp: "f", KeyS: "b", ArrowDown: "b", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r", KeyE: "u", PageUp: "u", KeyQ: "d", PageDown: "d" };
    const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable); };
    window.addEventListener("keydown", e => {
      const k = KMAP[e.code]; if (!k || typing() || !wrap.offsetParent || e.ctrlKey || e.altKey || e.metaKey) return;
      const ov = document.querySelector(".ovl3d.on"); if (ov) return;          // janela aberta (PT100, IHM ampliada): não anda
      KEYS.add(k); S.fast = e.shiftKey; S.tw = null; e.preventDefault();
    });
    window.addEventListener("keyup", e => { const k = KMAP[e.code]; if (k) KEYS.delete(k); S.fast = e.shiftKey; });
    window.addEventListener("blur", () => KEYS.clear());
    S.walk = (dt) => {
      if (!KEYS.size) return;
      const fwd = new T.Vector3().subVectors(ctl.target, cam.position); fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      const right = new T.Vector3(-fwd.z, 0, fwd.x), mv = new T.Vector3();
      if (KEYS.has("f")) mv.add(fwd); if (KEYS.has("b")) mv.sub(fwd);
      if (KEYS.has("r")) mv.add(right); if (KEYS.has("l")) mv.sub(right);
      if (KEYS.has("u")) mv.y += 1; if (KEYS.has("d")) mv.y -= 1;
      if (mv.lengthSq() === 0) return;
      mv.normalize().multiplyScalar((S.fast ? 2.6 : 1.2) * dt);
      cam.position.add(mv); ctl.target.add(mv);
      if (ctl.target.y < 0.1) { const d = 0.1 - ctl.target.y; ctl.target.y += d; cam.position.y += d; }
    };
    Object.assign(S, { renderer, lr, scene, cam, ctl, wrap });

    scene.add(new T.HemisphereLight(0xffffff, 0x9A9690, 1.15));
    const sun = new T.DirectionalLight(0xfff8f0, 1.45); sun.position.set(2.5, 7.5, 3.5); sun.castShadow = false;
    scene.add(sun);
    const fill = new T.PointLight(0xfff6ec, 5.5, 9, 2); fill.position.set(-2, 3.0, 1.5); scene.add(fill);
    const win = new T.DirectionalLight(0xEAF2FF, 0.8); win.position.set(0, 2.2, -6); win.target.position.set(0, 0.8, 2); scene.add(win); scene.add(win.target);

    Object.assign(M, {
      steel: mat(0xC9D1DA, 0.85, 0.28), tank: mat(0xC9D1DA, 0.85, 0.28), water: mat(0x2E8B3E, 0.25, 0.42), steam: mat(0xF2F3F4, 0.2, 0.45), conduit: mat(0x4A4F57, 0.35, 0.5), dark: mat(0x6B7684, 0.7, 0.45), paint: mat(0x8A949F, 0.4, 0.6), alu: mat(0xC2CAD3, 0.75, 0.38),
      blue: mat(0x2F6DB5, 0.3, 0.45), blueDark: mat(0x1E3A5F, 0.3, 0.5),
      housing: mat(0xE3D4B4, 0.15, 0.5), housingDark: mat(0xCDBD98, 0.2, 0.5),
      flange: mat(0xB6BFC9, 0.85, 0.32), bore: mat(0x06080A, 0.1, 0.95), bolt: mat(0x5A6370, 0.8, 0.35), weld: mat(0xA9B2BC, 0.8, 0.5),
      support: mat(0x58626E, 0.5, 0.55), base: mat(0x3B434D, 0.5, 0.6), gland: mat(0x2B2F36, 0.3, 0.6), cable: mat(0x6E7782, 0.1, 0.8),
      chrome: mat(0xE6EBF0, 1, 0.12), castIron: mat(0x55606C, 0.6, 0.5), brass: mat(0xB08D57, 0.75, 0.35),
    });
    M.bore.side = T.DoubleSide;
    buildRoom(scene);
    const root = new T.Group(); scene.add(root);
    const bench = new T.Group(); bench.position.x = DX; root.add(bench); S.bench = bench;
    buildTank(bench, S.slots);
    buildLine(bench, S.slots);
    buildPanel(root);
    for (const id in SLOTDEF) makeGhost(id, S.slots[id]);
    initAnims(root);
    addLabel("LT-101", S.ltG, v3(0.1, 0.09, 0), "<b>LT-101</b><i></i>", "pre");
    addLabel("TZ-104", S.tz, v3(0, 0.15, 0.1), "<b>TZ-104</b><i>resistência</i>", "pre");
    addLabel("CLP", S.plc3d, v3(0, 0.2, 0.1), "<b>CLP DVP-SX2</b><i>TIC-104 e malha de nível</i>", "pre");
    addLabel("TQAC", S.ac, v3(0.42, 1.25, 0.1), "<b>Tanque</b><i>nível e temperatura</i>", "tank");
    addLabel("ROTA", S.bench, v3(2.82, 1.15, -0.9), "<b>Rotâmetro</b><i>indicação local</i>", "pre");
    addLabel("BOMBA", S.bench, v3(1.3, 0.42, -0.95), "<b>Bomba</b>", "pre");
    for (const [k, n] of [["pf525", "PowerFlex 525"], ["atv12", "Altivar ATV12"], ["cfw500", "WEG CFW500"]]) addLabel("VFD-" + k, S.drv3d[k].g, v3(0, S.drv3d[k].h / 2 + 0.06, 0.12), `<b>${n}</b><i></i>`, "pre");
    if (window.DRV) { let hq = 0; const hudSoon = () => { if (hq) return; hq = setTimeout(() => { hq = 0; try { if (S.hudOn) renderHud(); } catch (e) { } }, 40); };   // vários avisos seguidos viram uma única atualização do painel
      window.DRV.onChange(() => { hudSoon(); if (window.vfdTabs) window.vfdTabs(); }); for (const k in window.DRV.list) window.DRV.list[k].onChange(hudSoon); }
    S.proc = { T: 25, Th: 25, burnT: 0, P: 0, sp: 60, lim: 180, plim: 2.2, run: false, stuck: false, trip: false, heat: false, ctrl: false };
    S.lvl = { L: 40, Q: 0, fv: 100, fvCmd: 100, pump: false, pumpOn: false, vy: false, trip: false, drain: false, drainPct: 30, av: 50 };
    setWater(S.lvl.L);

    const ray = new T.Raycaster(), ndc = new T.Vector2();
    let down = null;
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const ghosts = Object.values(S.slots).map(s => s.ghost).filter(g => g && g.visible);
      const hitsG = ray.intersectObjects(ghosts, false);
      const hitsP = ray.intersectObjects(Object.values(S.parts), true);
      const cl = S.clickables || [], hitsC = ray.intersectObjects(cl.map(c => c.obj), true);
      if (hitsC.length && (!hitsG.length || hitsC[0].distance < hitsG[0].distance) && (!hitsP.length || hitsC[0].distance < hitsP[0].distance)) {
        let o = hitsC[0].object; while (o && !cl.find(c => c.obj === o)) o = o.parent;
        const c = cl.find(x => x.obj === o); if (c) return { click: c, hit: hitsC[0] };
      }
      if (hitsG.length && (!hitsP.length || hitsG[0].distance < hitsP[0].distance + 0.05)) return { slot: hitsG[0].object.userData.slot };
      if (hitsP.length) return { part: hitsP[0].object.userData.tag };
      return null;
    };
    renderer.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY, performance.now()]; });
    renderer.domElement.addEventListener("pointerup", e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) { down = null; return; }
      const holdMs = performance.now() - down[2]; down = null;
      const h = pick(e);
      if (!h) return;
      if (h.click) { h.click.fn(h.hit, { clientX: e.clientX, clientY: e.clientY, holdMs }); return; }
      if (h.slot) tryInstall(h.slot);
      else if (h.part && (h.part === "LSH-101" || h.part === "LSL-101" || h.part === "TSH-104")) cycleForce(h.part);
      else if (h.part) {
        const r = window.readTag ? window.readTag(h.part).text : h.part;
        tip(`<b>${h.part}</b>: ${r}.`);
      }
    });
    renderer.domElement.addEventListener("pointermove", e => {
      if (e.buttons) return;
      const h = pick(e);
      renderer.domElement.style.cursor = h ? "pointer" : "grab";
      const hot = h && h.part ? h.part : h && h.click ? h.click.tag : null;
      if (hot !== S.hot) { if (S.hot && S.labels[S.hot]) S.labels[S.hot].el.classList.remove("hot"); S.hot = hot; if (hot && S.labels[hot]) S.labels[hot].el.classList.add("hot"); }
      Object.values(S.slots).forEach(s => { if (s.ghost) s.ghost.userData.hover = h && h.slot === s.ghost.userData.slot; });
    });
    document.querySelectorAll("#v3d-views [data-view]").forEach(b => b.onclick = () => goView(b.dataset.view));
    $("#b3reset").onclick = reset;
    let hudPref = true; try { const hp = localStorage.getItem("nivel-hud3d"); hudPref = hp === null ? window.innerWidth > 760 : hp !== "0"; } catch (e) { }
    setHud(hudPref);
    const hs = $("#h3dShow"); if (hs) hs.onclick = () => setHud(true);
    const bpr = $("#b3prof"); if (bpr) bpr.onclick = () => { if (!S.hudOn) setHud(true); S.profOpen = true; renderHud(); const pb = $("#profBox"); if (pb) { pb.open = true; pb.scrollIntoView({ block: "center", behavior: "smooth" }); } };
    const bth = $("#b3therm"); if (bth) bth.onclick = () => { A.thermal = !A.thermal; bth.classList.toggle("on", A.thermal); if (A.thermal) tip("<b>Visão térmica</b>: a água do tanque fica azul quando frio e vai para o vermelho conforme a temperatura sobe.", ""); };
    const LM = { compact: "🏷 Rótulos: compactos", full: "🏷 Rótulos: completos", off: "🏷 Rótulos: ocultos" }, ORDER = ["compact", "full", "off"];
    const setMode = m => { S.labelMode = m; wrap.classList.remove("lab-compact", "lab-full", "lab-off"); wrap.classList.add("lab-" + m); const b = $("#b3labels"); if (b) b.textContent = LM[m]; };
    setMode("off");   // rótulos só aparecem ao passar o mouse sobre o instrumento (e clicar mostra a explicação)
    const bl = $("#b3labels"); if (bl) bl.onclick = () => setMode(ORDER[(ORDER.indexOf(S.labelMode) + 1) % 3]);
    // botão: mostrar/esconder as conexões elétricas (eletrodutos)
    try { S.showCond = localStorage.getItem("nivel-cond3d") !== "0"; } catch (e) { S.showCond = true; }
    const bc = $("#b3cond"), setCond = v => { S.showCond = v; if (bc) bc.textContent = v ? "🔌 Eletrodutos: visíveis" : "🔌 Eletrodutos: ocultos"; try { localStorage.setItem("nivel-cond3d", v ? "1" : "0"); } catch (e) { } };
    setCond(S.showCond); if (bc) bc.onclick = () => setCond(!S.showCond);

    new ResizeObserver(resize).observe(wrap);
    resize();
    $("#load3d").style.display = "none";
    renderTray();
    tip("Escolha uma peça na Bancada de Peças, leia a tag e toque na área azul onde ela deve ser instalada. Arraste para girar, use a roda ou dois dedos para aproximar. Teclado: <b>W A S D</b> ou <b>setas</b> para andar, <b>Q/E</b> para descer/subir (Shift = mais rápido).");
    const clock = new T.Clock();
    let acc = 0;
    // ---- barra de desempenho (sempre visível): FPS + botão ⓘ (detalhes: quadro, pior e melhor) + qualidade Alta / Média / Baixa
    const perf = { n: 0, t0: performance.now(), worst: 0, best: 1e9, low: 0, lastTip: -1e9, det: false };
    perf.el = document.createElement("div"); perf.el.id = "perf3d";
    perf.el.innerHTML = '<b id="pfFps">-- FPS</b><span class="pfq" title="Qualidade gráfica. Média: menos resolução e menos partículas. Baixa: água simplificada (sem ondas, bolhas e espuma), monitor do fundo parado e resolução mínima — mais FPS"><button data-q="alta">Alta</button><button data-q="media">Média</button><button data-q="baixa">Baixa</button></span>';
    wrap.appendChild(perf.el);
    perf.apply = () => { perf.el.querySelectorAll("[data-q]").forEach(b => b.classList.toggle("on", b.dataset.q === qName)); };
    function setQuality(q) {
      if (!QUAL[q]) return; qName = q; try { localStorage.setItem("nivel-q3d", q); } catch (e) { }
      resize(); perf.low = 0; perf.n = 0; perf.t0 = performance.now(); perf.apply();
    }
    perf.el.querySelectorAll("[data-q]").forEach(b => b.onclick = () => setQuality(b.dataset.q));
    perf.apply(); S.setQuality = setQuality;
    perf.tick = (frameMs) => {
      perf.n++; perf.worst = Math.max(perf.worst, frameMs); perf.best = Math.min(perf.best, frameMs);
      const now = performance.now();
      if (now - perf.t0 >= 500) {
        const sec = (now - perf.t0) / 1000, fps = perf.n / sec, ft = 1000 * sec / perf.n, fe = perf.el.querySelector("#pfFps");
        fe.textContent = fps.toFixed(0) + " FPS"; fe.style.color = fps >= 50 ? "#2EE07A" : fps >= 30 ? "#FFB020" : "#FF6B5B";
        perf.low = fps < 24 ? perf.low + 1 : 0;
        if (perf.low >= 6 && qName !== "baixa" && now - perf.lastTip > 60000) { perf.lastTip = now; tip("<b>Desempenho baixo</b> (" + fps.toFixed(0) + " FPS). Se estiver travando, escolha a qualidade <b>Média</b> ou <b>Baixa</b> nos botões ao lado do FPS.", ""); }
        perf.n = 0; perf.t0 = now; perf.worst = 0; perf.best = 1e9;
      }
    };
    S.perf = perf; let lastFrame = performance.now();
    function loop() {
      requestAnimationFrame(loop);
      const fNow = performance.now(), frameMs = fNow - lastFrame; lastFrame = fNow;
      const dt = Math.min(clock.getDelta(), 0.1);
      if (!wrap.offsetParent) {   // outra aba aberta (ex.: CLP): só a simulação e a comunicação seguem rodando
        if (ready("tq") || ready("ln")) plcCycle(dt * 5);
        if (ready("tq")) stepProc(dt * 5);
        stepDrive(dt);
        if (ready("ln")) stepLevel(dt * 5);
        if (window.MD) MD.refresh(dt);
        return;
      }
      if (S.walk) S.walk(dt);
      if (S.tw) { S.tw.k = Math.min(1, S.tw.k + dt * 1.6); const k = 1 - Math.pow(1 - S.tw.k, 3); cam.position.lerpVectors(S.tw.p0, S.tw.p1, k); ctl.target.lerpVectors(S.tw.t0, S.tw.t1, k); if (S.tw.k >= 1) S.tw = null; }
      ctl.update(); clampCam();
      const tt = performance.now() / 1000;
      Object.values(S.slots).forEach(s => {
        const g = s.ghost; if (!g || !g.visible) return;
        if (g.userData.flash > 0) { g.userData.flash -= dt; if (g.userData.flash <= 0) g.material.color.set(0x48D1FF); }
        g.material.opacity = S.sel ? 0.22 + 0.2 * (0.5 + 0.5 * Math.sin(tt * 6)) : g.userData.hover ? 0.45 : 0.24;
      });
      Object.values(S.parts).forEach(p => { const a = p.userData.anim; if (a && a.t < 1) { a.t = Math.min(1, a.t + dt * 2.2); const k = 1 - Math.pow(1 - a.t, 3); p.position.lerpVectors(a.from, a.to, k); } });
      if (ready("tq") || ready("ln")) plcCycle(dt * 5);
      if (ready("tq")) stepProc(dt * 5);
      stepDrive(dt);
      if (ready("ln")) stepLevel(dt * 5);
      if (window.MD) MD.refresh(dt);
      stepAnims(dt);
      acc += dt; if (acc > 0.25) { acc = 0; updateReadings(); }
      const pT1 = performance.now();
      renderer.render(scene, cam);
      lr.render(scene, cam);
      perf.tick(frameMs, pT1 - fNow, performance.now() - pT1);
      dc += dt; if (dc > 0.15) { dc = 0; declutter(); }
    }
    let dc = 0;
    const wp = new T.Vector3();
    function declutter() {
      const items = [];
      for (const k in S.labels) {
        const l = S.labels[k], el = l.el;
        el.style.visibility = "";
        if (el.style.display === "none" || el.offsetParent === null) continue;
        l.obj.getWorldPosition(wp);
        const pr = (el.classList.contains("alarm") ? 0 : el.classList.contains("hot") ? 1 : 2) * 1000 + wp.distanceTo(cam.position);
        items.push({ el, pr, rc: el.getBoundingClientRect() });
      }
      items.sort((a, b) => a.pr - b.pr);
      const kept = [];
      for (const it of items) {
        const a = it.rc, pad = 2;
        if (kept.some(b => a.left < b.right + pad && b.left < a.right + pad && a.top < b.bottom + pad && b.top < a.bottom + pad)) it.el.style.visibility = "hidden";
        else kept.push(a);
      }
    }
    loop();
  }
  function resize() {
    if (!S.renderer) return;
    const w = S.wrap.clientWidth, h = S.wrap.clientHeight; if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1, ratio = Math.max(0.3, Math.min(dpr, QUAL[qName].h / h));   // nunca mais pixels que o limite da qualidade (1080 / 720 / 480 de altura)
    S.renderer.setPixelRatio(ratio); S.renderer.setSize(w, h); S.lr.setSize(w, h);
    S.cam.aspect = w / h; S.cam.updateProjectionMatrix();
  }
  function reset() {
    releaseForce(); S.ui.emerg = false; S.ui.selRes = false;
    for (const tag in S.parts) { const g = S.parts[tag]; g.parent.remove(g); }
    for (const p of PARTS) { const l = S.labels[p.tag]; if (l) { l.obj.parent.remove(l.obj); l.el.remove(); delete S.labels[p.tag]; } }
    S.parts = {}; S.installed = {}; S.errors = 0; S.sel = null; S.done = {};
    for (const vv of (S.valves || [])) vv.open = true; S.pumpT = 25; S.thermalTrip = false; S.pumpWarn = false; S.pumpBurnt = false; S.pumpSmokeT = 0;
    if (S.rebuildCables) S.rebuildCables("VY-01");   // apaga os enforca-gatos do feixe
    for (const k of ["pitScreen", "pgNeedle", "tshLamp", "pshLamp", "lshLamp", "lslLamp", "fitScreen", "fvMark", "vyLamp", "litScreen", "lshPivot", "lslPivot"]) S[k] = null;
    for (const id in SLOTDEF) S.slots[id].ghost.visible = !SLOTDEF[id].req;
    S.burnt = false; Object.assign(S.proc, { T: 25, Th: 25, burnT: 0, P: 0, run: false, stuck: false, trip: false, heat: false, ctrl: false });
    Object.assign(S.lvl, { L: 40, Q: 0, motorN: 0, motorDir: 1, fv: 100, fvCmd: 100, pump: false, pumpOn: false, vy: false, trip: false, drain: false, drainPct: 30 });
    if (window.PLC) window.PLC.reset();
    setWater(40); S.tzGlow = 0; S.tzLamp.emissive.setHex(0); S.tzLamp.emissiveIntensity = 0; if (S.tzLight) S.tzLight.intensity = 0; S.pumpLamp.emissive.setHex(0); S.k1Lamp.emissive.setHex(0); for (const m of Object.values(S.coilLamps || {})) { m.emissive.setHex(0); m.emissiveIntensity = 0; }
    S.panelScreen.draw(["HMI", "aguardando"], "#1F2A37"); drawPlc();
    renderTray(); tip("Montagem reiniciada. Escolha uma peça na Bancada de Peças.");
  }

  const api = {
    setSp(v) { S.proc.sp = clamp(Math.round(+v || 60), 20, 200); const i = $("#b3sp"); if (i && document.activeElement !== i) i.value = S.proc.sp; updateReadings(); },
    setValveReq(v) { S.lvl.av = clamp(Math.round(+v || 0), 0, 100); updateReadings(); },
  };
  window.App3D = {
    releaseForce, force: S.force, _S: S,
    setTtZero, ttZero: () => ttZero, setLtZero, ltZero: () => ltZero, _lt: () => ltInfo(S.lvl.L), replaceHeater, burnt: () => S.burnt, _bub: () => (A.bub ? A.bub.count : 0), _smoke: () => A.smoke.filter(p => p.life < 1).length, _setProc: (o) => Object.assign(S.proc, o),
    _click(tag) { const c = (S.clickables || []).find(x => x.tag === tag); if (c) c.fn({}, {}); return !!c; },
    setSp: (v) => api.setSp(v), ui: S.ui, setValveReq: (v) => api.setValveReq(v), showHud: (on) => setHud(on !== false),
    start(wrap) { if (!started) { started = true; init(wrap); } else { resize(); renderHud(); renderClp(); } },
    _state: S,
    refreshHud() { if (S.renderer) renderHud(); },
    renderClpTab,
    _anim(dt) { stepAnims(dt); return A; },
    _clamp() { clampCam(); return S.cam.position.toArray().map(v => +v.toFixed(2)); },
    plant() { const L = S.lvl, P = S.proc; return { L: L.L, Q: L.Q, fv: L.fv, drain: L.drain, drainPct: L.drainPct, sp: P ? P.sp : 60, T: P ? P.T : 25, av: L.av, fvCmd: L.fvCmd, Pbar: P ? P.P : 0, tq: ready("tq"), ln: ready("ln"), wired: !!window.__ttWired }; },
    setDrain(v) { S.lvl.drain = !!v; renderHud(); },
    setFv(v) { S.lvl.fvCmd = clamp(+v || 0, 0, 100); updateReadings(); },
    ready: () => ready("ln"),
    autoInstall() { for (const p of PARTS) if (p.slot && !S.installed[p.tag]) { S.sel = p.tag; install(p, p.slot); const a = S.parts[p.tag].userData.anim; a.t = 1; S.parts[p.tag].position.copy(a.to); } },
    view(k) { goView(k); },
    _tick(dt) { if (ready("tq") || ready("ln")) plcCycle(dt); if (ready("tq")) stepProc(dt); stepDrive(dt); if (ready("ln")) stepLevel(dt); if (window.MD) MD.refresh(dt); updateReadings(); },
  };
})();
