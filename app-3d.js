/* Bancada 3D · TQ-01, tanque de acrílico, tubulação e CLP Delta DVP-SX2
   Cena própria (Three.js). Mecânica: Bancada de Peças + áreas de encaixe.
   Endereços e escalas do CLP conferidos no manual do DVP-SX2 (AI 4–20 mA → 0..2000, AO 4–20 mA → 0..4000). */
(function () {
  "use strict";
  const T = window.THREE;
  let started = false;
  const S = { parts: {}, slots: {}, installed: {}, errors: 0, sel: null, proc: null, lvl: null, labels: {}, done: {}, labelMode: "compact", hot: null };

  /* ---------- catálogo ---------- */
  const PARTS = [
    { tag: "TE-104", name: "Sensor PT100 com poço", slot: "te", icon: "probe", grp: "tq" },
    { tag: "TT-104", name: "Transmissor de cabeçote", slot: "tt", icon: "tt", grp: "tq" },
    { tag: "PIT-103", name: "Transmissor de pressão", slot: "pit", icon: "pit", grp: "tq" },
    { tag: "PSH-103", name: "Pressostato", slot: "psh", icon: "psh", grp: "tq" },
    { tag: "TSH-104", name: "Termostato de imersão", slot: "tsh", icon: "tsh", grp: "tq" },
    { tag: "PG", name: "Manômetro", slot: "pg", icon: "pg", grp: "tq" },
    { tag: "LIT-101", name: "Transmissor de nível ultrassônico", slot: "lit", icon: "lit", grp: "ln" },
    { tag: "LSH-101", name: "Chave boia", slot: "lsh", icon: "float", grp: "ln" },
    { tag: "LSL-101", name: "Chave boia", slot: "lsl", icon: "float", grp: "ln" },
    { tag: "FIT-102", name: "Medidor de vazão", slot: "fit", icon: "flow", grp: "ln" },
    { tag: "FV-102", name: "Válvula de controle", slot: "fv", icon: "fv", grp: "ln" },
    { tag: "FY-102", name: "Posicionador", slot: "fy", icon: "fy", grp: "ln" },
    { tag: "VY-01", name: "Válvula solenoide", slot: "vy", icon: "vy", grp: "ln" },
    { tag: "TC", label: "sem tag", name: "Termopar tipo K", slot: null, icon: "probe2", other: "A bancada mede temperatura com PT100 (TE-104), não com termopar. Essa peça sobra." },
  ];
  const SLOTDEF = {
    te: { hint: "Entrada com poço termométrico no topo do TQ-01" },
    tt: { hint: "Cabeçote aberto do sensor de temperatura", req: "te" },
    pit: { hint: "Tomada de pressão no topo do TQ-01, para medição contínua" },
    psh: { hint: "Tomada de pressão no topo do TQ-01, para a chave de proteção" },
    tsh: { hint: "Luva lateral para a chave de temperatura de segurança" },
    pg: { hint: "Tomada lateral para indicação local de pressão" },
    lit: { hint: "Bocal na tampa do tanque de acrílico, para medição contínua de nível" },
    lsh: { hint: "Furo na parede do tanque de acrílico, perto do topo" },
    lsl: { hint: "Furo na parede do tanque de acrílico, perto do fundo" },
    fit: { hint: "Trecho da tubulação logo depois da bomba, para medidor em linha" },
    fv: { hint: "Trecho da tubulação para a válvula de controle" },
    fy: { hint: "Arcada da válvula de controle, onde fica o posicionador", req: "fv" },
    vy: { hint: "Trecho da tubulação para a válvula liga/desliga" },
  };
  const GRP = { tq: "TQ-01", ln: "Tanque e tubulação" };

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
  function mat(color, metal = 0.2, rough = 0.6, extra = {}) { return new T.MeshStandardMaterial(Object.assign({ color, metalness: metal, roughness: rough }, extra)); }
  function mesh(geo, m, cast = true, recv = true) { const o = new T.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
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
    for (const y of [-0.009, 0.009]) g.add(at(mesh(new T.CylinderGeometry(R, R, 0.014, 32), M.flange), v3(0, y, 0)));
    for (let i = 0; i < bolts; i++) {
      const a = i / bolts * Math.PI * 2 + Math.PI / bolts;
      g.add(at(mesh(new T.CylinderGeometry(r * 0.22, r * 0.22, 0.05, 6), M.bolt), v3(Math.cos(a) * R * 0.78, 0, Math.sin(a) * R * 0.78)));
    }
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
  function gland(parent, p, dir, r = 0.009) {
    const g = new T.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); parent.add(g);
    g.add(at(mesh(new T.CylinderGeometry(r * 1.4, r * 1.4, 0.012, 6), M.gland), v3(0, 0.006, 0)));
    g.add(at(mesh(new T.CylinderGeometry(r, r * 1.2, 0.018, 16), M.gland), v3(0, 0.021, 0)));
    g.add(at(mesh(new T.CylinderGeometry(r * 0.6, r * 0.6, 0.03, 10), M.cable), v3(0, 0.042, 0)));
    return g;
  }

  function g_spiral(parent, m) {
    const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 1.6 - Math.PI * 0.3, rr = 0.112 + 0.02 * i / 24; pts.push(v3(-0.04, 0.17 + Math.sin(a) * rr, Math.cos(a) * rr)); }
    parent.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.022, 12, false), m));
  }
  function handValve(parent, p, dir, r) {
    const g = new T.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(v3(1, 0, 0), dir.clone().normalize()); parent.add(g);
    const body = mat(0x59616B, 0.6, 0.45), wheel = mat(0xE8A21C, 0.35, 0.45);
    g.add(at(mesh(new T.SphereGeometry(r * 1.9, 24, 14), body), v3(0, 0, 0), v3(1.25, 1, 1)));
    g.add(mesh(cylX(r * 1.3, r * 5.2, 20), body));
    for (const x of [-r * 2.6, r * 2.6]) g.add(at(mesh(cylX(r * 1.75, r * 0.5, 6), body), v3(x, 0, 0)));
    g.add(at(mesh(new T.CylinderGeometry(r * 1.0, r * 1.3, r * 2.6, 16), body), v3(0, r * 2.6, 0)));
    g.add(at(mesh(new T.CylinderGeometry(r * 1.4, r * 1.4, r * 0.5, 6), body), v3(0, r * 4.0, 0)));
    g.add(at(mesh(new T.CylinderGeometry(r * 0.3, r * 0.3, r * 3.2, 10), M.chrome), v3(0, r * 5.4, 0)));
    const w = new T.Group(); w.position.set(0, r * 6.6, 0); g.add(w);
    w.add(mesh(new T.TorusGeometry(r * 2.7, r * 0.32, 10, 28).rotateX(Math.PI / 2), wheel));
    for (let i = 0; i < 3; i++) { const sp = mesh(new T.BoxGeometry(r * 5.2, r * 0.35, r * 0.45), wheel); sp.rotation.y = i * Math.PI / 3; w.add(sp); }
    w.add(mesh(new T.CylinderGeometry(r * 0.7, r * 0.7, r * 0.7, 12), wheel));
    return g;
  }

  /* ---------- sala (laboratório de eletromecânica) ---------- */
  function buildRoom(scene) {
    const RX = 5, RZ0 = -4, RZ1 = 5, RH = 3.2;
    // piso de granitina com juntas
    const floorTex = canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = "#CFCAC2"; g.fillRect(0, 0, w, h);
      const cols = ["#8E8A84", "#6F6B66", "#A9A39A", "#E8E4DC", "#B8B0A3", "#5E5A55", "#D9D3C8"];
      for (let k = 0; k < 26000; k++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; const sz = Math.random() < 0.85 ? 1.5 + Math.random() * 2.5 : 3 + Math.random() * 5; g.globalAlpha = 0.35 + Math.random() * 0.5; g.fillRect(Math.random() * w, Math.random() * h, sz, sz * (0.6 + Math.random() * 0.8)); }
      g.globalAlpha = 1; g.strokeStyle = "#9C968D"; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    }, [10 / 1.0, 9 / 1.0]);
    const floor = mesh(new T.PlaneGeometry(RX * 2, RZ1 - RZ0), mat(0xffffff, 0.0, 0.22, { map: floorTex }), false, true);
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
    const blue = mat(0x1E4FB4, 0.35, 0.45), glass = new T.MeshStandardMaterial({ color: 0xF4F8FC, emissive: 0xEAF2FA, emissiveIntensity: 0.85, roughness: 0.9 });
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
    // bancada didática de alumínio (fundo, à esquerda)
    const alu = mat(0xC9CED4, 0.7, 0.35), top = mat(0x3B4048, 0.2, 0.6);
    const tb = new T.Group(); tb.position.set(-3.3, 0, RZ0 + 0.55); scene.add(tb);
    const post = (x, z, h, y0 = 0.08) => tb.add(at(mesh(new T.BoxGeometry(0.04, h, 0.04), alu), v3(x, y0 + h / 2, z)));
    for (const x of [-0.72, 0.72]) for (const z of [-0.33, 0.33]) post(x, z, 0.8);
    for (const x of [-0.72, 0.72]) post(x, -0.33, 1.2, 0.88);
    tb.add(at(mesh(new T.BoxGeometry(1.5, 0.03, 0.72), top), v3(0, 0.88, 0)));
    tb.add(at(mesh(new T.BoxGeometry(1.48, 0.02, 0.7), mat(0x2B2F36, 0.2, 0.7)), v3(0, 0.12, 0)));
    tb.add(at(mesh(new T.BoxGeometry(1.48, 0.04, 0.04), alu), v3(0, 2.08, -0.33)));
    for (const x of [-0.7, 0.7]) for (const z of [-0.3, 0.3]) tb.add(at(mesh(new T.CylinderGeometry(0.035, 0.035, 0.03, 16).rotateZ(Math.PI / 2), mat(0x3B4048)), v3(x, 0.04, z)));
    const panelTex = canvasTex(740, 600, (c) => {
      c.fillStyle = "#EEF0F2"; c.fillRect(0, 0, 740, 600);
      c.strokeStyle = "#C3C8CE"; c.lineWidth = 3; for (const y of [120, 250, 420]) { c.beginPath(); c.moveTo(0, y); c.lineTo(740, y); c.stroke(); }
      for (let i = 0; i < 3; i++) { c.fillStyle = "#fff"; c.fillRect(150 + i * 150, 10, 110, 100); c.strokeStyle = "#555"; c.strokeRect(150 + i * 150, 10, 110, 100); c.beginPath(); c.arc(205 + i * 150, 95, 60, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); c.beginPath(); c.moveTo(205 + i * 150, 95); c.lineTo(185 + i * 150, 45); c.strokeStyle = "#B83A2E"; c.stroke(); }
      for (let i = 0; i < 3; i++) { c.fillStyle = "#DDE1E5"; c.fillRect(30 + i * 230, 140, 200, 100); c.fillStyle = "#2B2F36"; c.fillRect(110 + i * 230, 160, 60, 70); c.fillStyle = "#5B6B80"; c.fillRect(40 + i * 230, 160, 50, 60); }
      c.fillStyle = "#2B2F36"; for (let i = 0; i < 4; i++) c.fillRect(150 + i * 70, 280, 50, 110);
      c.fillStyle = "#5B6B80"; c.fillRect(30, 280, 90, 110);
      c.fillStyle = "#B83A2E"; c.beginPath(); c.arc(60, 500, 26, 0, 7); c.fill(); c.fillStyle = "#E8C21C"; c.beginPath(); c.arc(60, 500, 36, 0, 7); c.globalCompositeOperation = "destination-over"; c.fill(); c.globalCompositeOperation = "source-over";
      const btn = [["#B83A2E", 150], ["#2E8B4A", 210], ["#E87722", 270], ["#2F6DB5", 330]]; btn.forEach(([col, x]) => { c.fillStyle = col; c.beginPath(); c.arc(x, 500, 16, 0, 7); c.fill(); });
      for (let i = 0; i < 18; i++) { c.fillStyle = i % 3 === 0 ? "#B83A2E" : i % 3 === 1 ? "#1F2A37" : "#2F6DB5"; c.beginPath(); c.arc(420 + (i % 9) * 34, 470 + Math.floor(i / 9) * 50, 8, 0, 7); c.fill(); }
    });
    tb.add(at(mesh(new T.PlaneGeometry(1.4, 1.14), new T.MeshStandardMaterial({ map: panelTex, roughness: 0.6 }), false), v3(0, 1.48, -0.31)));
    tb.add(at(mesh(new T.BoxGeometry(1.42, 1.16, 0.02), mat(0xDADDE0, 0.1, 0.6)), v3(0, 1.48, -0.33)));
    const mon = new T.Group(); mon.position.set(0.35, 1.25, -0.05); tb.add(mon);
    mon.add(at(mesh(new T.BoxGeometry(0.42, 0.27, 0.025), mat(0x1F2328, 0.3, 0.4)), v3(0, 0.08, 0)));
    mon.add(at(mesh(new T.PlaneGeometry(0.39, 0.24), new T.MeshStandardMaterial({ color: 0x0E1622, emissive: 0x16304F, emissiveIntensity: 0.6 }), false), v3(0, 0.08, 0.013)));
    mon.add(at(mesh(new T.BoxGeometry(0.03, 0.2, 0.03), mat(0x2B2F36)), v3(0, -0.12, -0.05)));
    tb.add(at(mesh(new T.BoxGeometry(0.42, 0.02, 0.15), mat(0x1F2328)), v3(0.2, 0.9, 0.15)));
    // caixa de acrílico com motor embaixo
    tb.add(at(mesh(new T.BoxGeometry(0.62, 0.38, 0.5), new T.MeshPhysicalMaterial({ color: 0xE6F0F8, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }), false, false), v3(-0.1, 0.33, 0)));
    tb.add(at(mesh(new T.CylinderGeometry(0.08, 0.08, 0.2, 24).rotateZ(Math.PI / 2), mat(0x2F5FA0, 0.4, 0.4)), v3(-0.1, 0.25, 0)));
    tb.add(at(mesh(new T.CylinderGeometry(0.07, 0.07, 0.07, 24).rotateZ(Math.PI / 2), mat(0x1F2328, 0.4, 0.5)), v3(0.5, 0.2, 0.15)));
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
  function buildTank(root, slots) {
    const g = new T.Group(); root.add(g);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, x = Math.sin(a) * 0.46, z = Math.cos(a) * 0.46;
      pipe(v3(x, 0.02, z), v3(x, 0.9, z), 0.035, M.paint, g);
      g.add(at(mesh(new T.CylinderGeometry(0.07, 0.07, 0.02, 20), M.paint), v3(x, 0.01, z)));
    }
    g.add(at(mesh(new T.CylinderGeometry(0.55, 0.55, 1.2, 72, 1, true), M.tank), v3(0, 1.35, 0)));
    const top = mesh(new T.SphereGeometry(0.55, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2), M.tank); top.scale.y = 0.3; top.position.y = 1.95; g.add(top);
    const bot = mesh(new T.SphereGeometry(0.55, 72, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.tank); bot.scale.y = 0.35; bot.position.y = 0.75; g.add(bot);
    for (const y of [0.75, 1.95, 1.35]) { const r = mesh(new T.TorusGeometry(0.553, y === 1.35 ? 0.006 : 0.014, 10, 72), M.dark); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    const plate = mesh(new T.PlaneGeometry(0.26, 0.11), new T.MeshStandardMaterial({ map: canvasTex(260, 110, (c, w) => { c.fillStyle = "#1E3A5F"; c.fillRect(0, 0, w, 110); c.fillStyle = "#fff"; c.font = "bold 46px Arial"; c.textAlign = "center"; c.fillText("TQ-01", w / 2, 62); c.font = "20px Arial"; c.fillText("aço inox · 0 a 6 bar", w / 2, 92); }), roughness: 0.5 }), false);
    plate.position.set(0, 1.55, 0.553); g.add(plate);
    // saída inferior → sucção da bomba
    const r1 = 0.026;
    pipeRun([v3(0, 0.6, 0), v3(0, 0.3, 0), v3(1.05, 0.3, 0), v3(1.05, 0.3, -0.62), v3(1.05, 0.17, -0.62)], r1, M.water, g, { flangeStart: true });
    support(0.55, 0, 0.3, r1, g, "x");
    // retorno (do tanque de acrílico para o TQ-01) pela parte alta
    const r2 = 0.02;
    pipeRun([v3(1.9, 1.6, -1.0), v3(1.9, 2.28, -1.0), v3(-0.32, 2.28, -1.0), v3(-0.32, 2.28, -0.25), v3(-0.32, 2.05, -0.25)], r2, M.water, g, { flangeEnd: true });
    support(0.8, -1.0, 2.28, r2, g, "x"); support(-0.32, -0.62, 2.28, r2, g, "z");
    // resistência TZ-104
    const a = -Math.PI * 0.55, n = v3(Math.sin(a), 0, Math.cos(a));
    const tz = new T.Group(); tz.position.set(n.x * 0.55, 0.95, n.z * 0.55); tz.rotation.y = a; g.add(tz);
    flange(v3(0, 0, 0.012), v3(0, 0, 1), 0.03, tz, 8);
    tz.add(at(mesh(new T.BoxGeometry(0.13, 0.13, 0.1), M.paint), v3(0, 0, 0.075)));
    gland(tz, v3(0, -0.065, 0.075), v3(0, -1, 0), 0.01);
    S.tzLamp = new T.MeshStandardMaterial({ color: 0x553311, emissive: 0x000000, roughness: 0.4 });
    tz.add(at(mesh(new T.SphereGeometry(0.016, 16, 10), S.tzLamp), v3(0, 0.03, 0.127)));
    S.tz = tz;
    pipeRun([v3(-0.05, 2.1, -0.05), v3(-0.05, 2.26, -0.05), v3(0.06, 2.26, -0.05)], 0.012, M.steam, g);
    slots.te = topHolder(g, -0.27, 0.12);
    slots.pit = topHolder(g, 0.26, 0.2);
    slots.psh = topHolder(g, 0.14, -0.3);
    slots.tsh = sideHolder(g, Math.PI * 0.2, 1.1);
    slots.pg = sideHolder(g, -Math.PI * 0.22, 1.72);
    slots.tt = { holder: slots.te.holder, kind: "top", mount: v3(0, 0.045 + 0.215, 0), small: true };
  }

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
    P(cylX(0.092, 0.25, 36), green, v3(0.27, 0.17, 0));
    for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(an)) < 0.3 && Math.cos(an) < 0) continue; P(new T.BoxGeometry(0.22, 0.012, 0.01), green, v3(0.27, 0.17 + Math.sin(an) * 0.096, Math.cos(an) * 0.096)).rotation.x = -an; }
    P(cylX(0.088, 0.03, 32), greenD, v3(0.135, 0.17, 0));
    P(cylX(0.088, 0.03, 32), greenD, v3(0.405, 0.17, 0));
    P(cylX(0.092, 0.06, 32), mat(0x2A6F3E, 0.4, 0.45), v3(0.45, 0.17, 0));
    P(new T.BoxGeometry(0.085, 0.06, 0.085), green, v3(0.27, 0.285, 0));
    P(new T.BoxGeometry(0.09, 0.008, 0.09), greenD, v3(0.27, 0.318, 0));
    gland(pump, v3(0.27, 0.285, 0.0425), v3(0, 0, 1), 0.008);
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
    // sucção axial (vem do TQ-01 e entra pela frente da voluta)
    pipeRun([v3(1.05, 0.17, -0.62), v3(0.78, 0.17, -0.62), v3(0.78, 0.17, -0.95), v3(0.895, 0.17, -0.95)], 0.026, M.water, root, { flangeEnd: true });
    handValve(root, v3(0.78, 0.17, -0.79), v3(0, 0, -1), 0.026);
    handValve(root, v3(1.02, 0.45, -0.68), v3(0, 0, 1), 0.024);
    // recalque com trechos vazios (FIT, FV, VY)
    const Y = 0.45, Z = -0.35, R = 0.024;
    pipeRun([v3(1.02, 0.31, -0.95), v3(1.02, Y, -0.95), v3(1.02, Y, Z), v3(1.24, Y, Z)], R, M.water, root, { flangeStart: true, flangeEnd: true });
    pipe(v3(1.46, Y, Z), v3(1.74, Y, Z), R, M.water, root); flange(v3(1.46, Y, Z), v3(-1, 0, 0), R, root, 4); flange(v3(1.74, Y, Z), v3(1, 0, 0), R, root, 4);
    pipe(v3(1.98, Y, Z), v3(2.26, Y, Z), R, M.water, root); flange(v3(1.98, Y, Z), v3(-1, 0, 0), R, root, 4); flange(v3(2.26, Y, Z), v3(1, 0, 0), R, root, 4);
    pipeRun([v3(2.46, Y, Z), v3(2.75, Y, Z), v3(2.75, Y, -1.0), v3(2.75, 0.62, -1.0)], R, M.water, root, { flangeStart: true, flangeEnd: true });
    support(1.6, Z, Y, R, root, "x"); support(2.12, Z, Y, R, root, "x"); support(2.75, -0.7, Y, R, root, "z");
    // rotâmetro (corpo com flanges, tubo de vidro e escala)
    const glass = new T.MeshPhysicalMaterial({ color: 0xD0342A, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.05, depthWrite: false });
    root.add(at(mesh(new T.CylinderGeometry(0.03, 0.03, 0.44, 28), glass, false, false), v3(2.75, 0.9, -1.0)));
    const rdk = mat(0x3B434D, 0.55, 0.45);
    for (const [y, s] of [[0.665, 1], [1.135, -1]]) {
      root.add(at(mesh(new T.CylinderGeometry(0.058, 0.058, 0.03, 32), rdk), v3(2.75, y, -1.0)));
      root.add(at(mesh(new T.CylinderGeometry(0.04, 0.04, 0.03, 24), M.steel), v3(2.75, y - s * 0.03, -1.0)));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; root.add(at(mesh(new T.CylinderGeometry(0.005, 0.005, 0.04, 6), M.bolt), v3(2.75 + Math.cos(a) * 0.046, y, -1.0 + Math.sin(a) * 0.046))); }
    }
    const rscale = canvasTex(40, 400, c => { c.fillStyle = "#F4F4F2"; c.fillRect(0, 0, 40, 400); c.fillStyle = "#1F2A37"; c.font = "bold 20px Arial"; c.textAlign = "center"; for (let i = 0; i <= 9; i++) { const y = 380 - i * 40; c.fillRect(2, y, i ? 10 : 36, 2); if (i) c.fillText(i, 26, y + 7); } });
    const rs = mesh(new T.CylinderGeometry(0.0305, 0.0305, 0.4, 24, 1, true, -0.35, 0.7), new T.MeshStandardMaterial({ map: rscale, roughness: 0.5, transparent: true, opacity: 0.95, side: T.DoubleSide }), false, false);
    rs.position.set(2.75, 0.9, -1.0); root.add(rs);
    S.rotaFloat = at(mesh(new T.CylinderGeometry(0.024, 0.01, 0.026, 20), mat(0xC9D1DA, 0.8, 0.3)), v3(2.75, 0.7, -1.0)); root.add(S.rotaFloat);
    handValve(root, v3(2.75, 0.45, -0.85), v3(0, 0, -1), 0.024);
    handValve(root, v3(2.52, 1.4, -1.0), v3(-1, 0, 0), 0.024);
    pipeRun([v3(2.75, 1.175, -1.0), v3(2.75, 1.4, -1.0), v3(2.23, 1.4, -1.0)], R, M.water, root, { flangeEnd: true });
    const inl = (x) => { const h = new T.Group(); h.position.set(x, Y, Z); root.add(h); return { holder: h, kind: "inline", mount: v3(0, 0, 0) }; };
    slots.fit = inl(1.35); slots.fv = inl(1.86); slots.vy = inl(2.36);
    slots.fy = { holder: slots.fv.holder, kind: "side", mount: v3(0, 0.222, 0.03), small: true };
    // tanque de acrílico com tampa
    const ac = new T.Group(); ac.position.set(1.9, 0, -1.0); root.add(ac);
    for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) { ac.add(at(mesh(new T.BoxGeometry(0.04, 0.62, 0.04), M.support), v3(x, 0.31, z))); ac.add(at(mesh(new T.BoxGeometry(0.1, 0.01, 0.1), M.support), v3(x, 0.005, z))); }
    ac.add(at(mesh(new T.BoxGeometry(0.8, 0.03, 0.7), M.support), v3(0, 0.625, 0)));
    const acr = new T.MeshPhysicalMaterial({ color: 0xDDEEFF, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide });
    ac.add(at(mesh(new T.BoxGeometry(0.66, 0.9, 0.56), acr, false, false), v3(0, 1.09, 0)));
    ac.add(at(mesh(new T.BoxGeometry(0.7, 0.02, 0.6), new T.MeshPhysicalMaterial({ color: 0xDDEEFF, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }), false, false), v3(0, 1.55, 0)));
    S.water = mesh(new T.BoxGeometry(0.64, 1, 0.54), new T.MeshStandardMaterial({ color: 0x5FA8E0, transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false }), false, false);
    ac.add(S.water);
    const edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(0.66, 0.9, 0.56)), new T.LineBasicMaterial({ color: 0x9FB6CC })); edges.position.set(0, 1.09, 0); ac.add(edges);
    ac.add(at(mesh(new T.PlaneGeometry(0.05, 0.86), new T.MeshBasicMaterial({ map: canvasTex(40, 400, (c) => { c.fillStyle = "#fff"; c.fillRect(0, 0, 40, 400); c.fillStyle = "#1F2A37"; for (let i = 0; i <= 10; i++) c.fillRect(0, 398 - i * 39.6, i % 5 ? 14 : 28, 3); }), transparent: true, opacity: 0.85 }), false), v3(-0.29, 1.09, 0.281)));
    const wallHolder = (y) => { const h = new T.Group(); h.position.set(0.14, y, 0.28); ac.add(h); h.add(at(mesh(cylZ(0.028, 0.012, 20), M.dark), v3(0, 0, 0.006))); return { holder: h, kind: "side", mount: v3(0, 0, 0.012) }; };
    slots.lsh = wallHolder(1.38); slots.lsl = wallHolder(0.8);
    const lidH = new T.Group(); lidH.position.set(-0.1, 1.56, 0.05); ac.add(lidH);
    lidH.add(mesh(new T.CylinderGeometry(0.035, 0.035, 0.03, 20), M.dark));
    slots.lit = { holder: lidH, kind: "top", mount: v3(0, 0.015, 0) };
    // dreno
    pipeRun([v3(-0.2, 0.64, -0.15), v3(-0.2, 0.4, -0.15), v3(-0.2, 0.4, 0.15)], 0.016, M.water, ac);
    ac.add(at(mesh(new T.BoxGeometry(0.05, 0.04, 0.04), mat(0xB83A2E, 0.3, 0.5)), v3(-0.2, 0.4, 0.05)));
    S.ac = ac;
  }
  function setWater(L) { const h = Math.max(0.002, 0.88 * L / 100); S.water.scale.y = h; S.water.position.set(0, 0.65 + h / 2, 0); }

  /* ---------- painel com CLP Delta DVP-SX2 ---------- */
  function buildPanel(root) {
    const pn = new T.Group(); pn.position.set(-4.98, 0, -1.2); pn.rotation.y = Math.PI / 2; root.add(pn);
    const cab = mat(0xD9D2B8, 0.15, 0.55);
    // caixa aberta (fundo + laterais)
    pn.add(at(mesh(new T.BoxGeometry(0.9, 1.3, 0.02), cab), v3(0, 1.45, 0.01)));
    pn.add(at(mesh(new T.BoxGeometry(0.02, 1.3, 0.32), cab), v3(-0.44, 1.45, 0.16)));
    pn.add(at(mesh(new T.BoxGeometry(0.02, 1.3, 0.32), cab), v3(0.44, 1.45, 0.16)));
    pn.add(at(mesh(new T.BoxGeometry(0.9, 0.02, 0.32), cab), v3(0, 2.09, 0.16)));
    pn.add(at(mesh(new T.BoxGeometry(0.9, 0.02, 0.32), cab), v3(0, 0.81, 0.16)));
    pn.add(at(mesh(new T.BoxGeometry(0.84, 1.24, 0.01), mat(0xF2EEE2, 0.05, 0.7)), v3(0, 1.45, 0.025)));
    // porta aberta
    const hinge = new T.Group(); hinge.position.set(0.45, 1.45, 0.32); hinge.rotation.y = -Math.PI * 0.62; pn.add(hinge);
    hinge.add(at(mesh(new T.BoxGeometry(0.9, 1.3, 0.02), cab), v3(-0.45, 0, 0)));
    S.panelScreen = screen(256, 128);
    hinge.add(at(mesh(new T.PlaneGeometry(0.3, 0.15), new T.MeshBasicMaterial({ map: S.panelScreen.tex }), false), v3(-0.45, 0.25, 0.011)));
    S.doorLamps = [0x2EE07A, 0xE0503C, 0xE87722].map((c, i) => { const m = mat(c, 0.1, 0.4, { emissive: c, emissiveIntensity: 0.08 }); hinge.add(at(mesh(cylZ(0.022, 0.03, 16), m), v3(-0.6 + i * 0.15, 0.48, 0.02))); return m; });
    S.panelScreen.draw(["HMI", "aguardando"], "#1F2A37");
    // trilhos DIN e canaletas
    for (const y of [1.78, 1.38]) pn.add(at(mesh(new T.BoxGeometry(0.78, 0.035, 0.012), M.steel), v3(0, y, 0.036)));
    for (const y of [1.97, 1.58, 1.16]) pn.add(at(mesh(new T.BoxGeometry(0.78, 0.06, 0.05), mat(0x8A949F, 0.1, 0.7)), v3(0, y, 0.055)));
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
    // contator da bomba, disjuntores, fonte 24 V
    const k1 = new T.Group(); k1.position.set(0.22, 1.78, 0.04); pn.add(k1);
    k1.add(at(mesh(new T.BoxGeometry(0.075, 0.12, 0.09), mat(0xEDEDED, 0.1, 0.6)), v3(0, 0, 0.045)));
    S.k1Lamp = new T.MeshStandardMaterial({ color: 0x333333, emissive: 0 });
    k1.add(at(mesh(new T.BoxGeometry(0.03, 0.02, 0.006), S.k1Lamp), v3(0, 0.01, 0.092)));
    for (let i = 0; i < 4; i++) pn.add(at(mesh(new T.BoxGeometry(0.045, 0.09, 0.07), mat(0xF4F4F4, 0.1, 0.6)), v3(-0.3 + i * 0.05, 1.38, 0.075)));
    pn.add(at(mesh(new T.BoxGeometry(0.12, 0.1, 0.08), mat(0x6B7684, 0.4, 0.5)), v3(0.08, 1.38, 0.08)));
    pn.add(at(mesh(new T.BoxGeometry(0.14, 0.1, 0.09), mat(0xD9DDE2, 0.3, 0.5)), v3(0.27, 1.38, 0.085)));
    // bornes
    for (let i = 0; i < 14; i++) pn.add(at(mesh(new T.BoxGeometry(0.012, 0.05, 0.04), mat(i % 3 === 2 ? 0x2F6DB5 : 0x9AA5B1, 0.1, 0.6)), v3(-0.3 + i * 0.016, 1.04, 0.06)));
    S.panel = pn;
    // eletrocalha
    // eletrocalha galvanizada suspensa no forro (tirantes) e eletrodutos cinza-escuro até os instrumentos
    const galv = mat(0xB4BCC4, 0.75, 0.38), TY = 2.72;
    const trayX = (x0, x1, z) => { const L = x1 - x0, cx = (x0 + x1) / 2; root.add(at(mesh(new T.BoxGeometry(L, 0.006, 0.2), galv), v3(cx, TY, z))); for (const dz of [-0.1, 0.1]) root.add(at(mesh(new T.BoxGeometry(L, 0.06, 0.006), galv), v3(cx, TY + 0.03, z + dz))); };
    const trayZ = (z0, z1, x) => { const L = z1 - z0, cz = (z0 + z1) / 2; root.add(at(mesh(new T.BoxGeometry(0.2, 0.006, L), galv), v3(x, TY, cz))); for (const dx of [-0.1, 0.1]) root.add(at(mesh(new T.BoxGeometry(0.006, 0.06, L), galv), v3(x + dx, TY + 0.03, cz))); };
    trayX(-4.9, -0.45, -1.2); trayZ(-1.3, -0.3, -0.45);
    root.add(at(mesh(new T.BoxGeometry(0.2, TY - 2.1, 0.06), galv), v3(-4.86, (TY + 2.1) / 2, -1.2)));
    const rodM = mat(0x8A939C, 0.7, 0.4);
    for (const x of [-4.2, -3.2, -2.2, -1.2, -0.45]) for (const dz of [-0.1, 0.1]) { root.add(at(mesh(new T.CylinderGeometry(0.005, 0.005, 3.2 - TY, 8), rodM), v3(x, (3.2 + TY) / 2, -1.2 + dz))); root.add(at(mesh(new T.BoxGeometry(0.03, 0.01, 0.24), rodM), v3(x, TY - 0.008, -1.2))); }
    for (const dx of [-0.1, 0.1]) root.add(at(mesh(new T.CylinderGeometry(0.005, 0.005, 3.2 - TY, 8), rodM), v3(-0.45 + dx, (3.2 + TY) / 2, -0.6)));
    // eletroduto flexível: sai da eletrocalha (bucha), faz a curva e termina numa conexão (unidut) rosqueada no prensa-cabo do instrumento
    const unid = mat(0x8A939C, 0.8, 0.35), bush = mat(0x2B2F36, 0.3, 0.6);
    const pol = (a, r, y) => v3(Math.sin(a) * r, y, Math.cos(a) * r);
    S.conduits = [];
    const cond = (tag, pts) => {
      const g = new T.Group(); root.add(g);
      const curve = new T.CatmullRomCurve3(pts, false, "centripetal");
      g.add(mesh(new T.TubeGeometry(curve, Math.max(60, pts.length * 14), 0.009, 10, false), M.conduit));
      // bucha na saída da eletrocalha
      g.add(at(mesh(new T.CylinderGeometry(0.014, 0.014, 0.014, 12), bush), pts[0].clone().add(v3(0, -0.006, 0))));
      // unidut na ponta, alinhado com a última direção do eletroduto
      const e = pts[pts.length - 1], d = e.clone().sub(curve.getPoint(0.985)).normalize();
      const u = new T.Group(); u.position.copy(e); u.quaternion.setFromUnitVectors(v3(0, 1, 0), d); g.add(u);
      u.add(at(mesh(new T.CylinderGeometry(0.0125, 0.0125, 0.022, 16), unid), v3(0, -0.011, 0)));
      u.add(at(mesh(new T.CylinderGeometry(0.0145, 0.0145, 0.008, 6), unid), v3(0, -0.002, 0)));
      S.conduits.push({ tag, g });
    };
    // pontos finais = saída do prensa-cabo de cada instrumento já montado (coordenadas da sala)
    cond("TE-104", [v3(-0.45, TY, -0.32), v3(-0.43, 2.64, -0.16), v3(-0.18, 2.55, 0.02), v3(0.03, 2.44, 0.12), v3(0.0, 2.34, 0.12), v3(-0.07, 2.319, 0.12), v3(-0.14, 2.319, 0.12)]);
    cond("PIT-103", [v3(-0.4, TY, -0.32), v3(-0.22, 2.68, -0.22), v3(0.25, 2.6, 0.0), v3(0.5, 2.46, 0.15), v3(0.49, 2.33, 0.17), v3(0.43, 2.292, 0.17), v3(0.37, 2.292, 0.17)]);
    cond("PSH-103", [v3(-0.43, TY, -0.32), v3(-0.3, 2.66, -0.38), v3(0.1, 2.6, -0.4), v3(0.37, 2.45, -0.32), v3(0.35, 2.26, -0.3), v3(0.29, 2.217, -0.3), v3(0.237, 2.217, -0.3)]);
    // TZ-104 e TSH-104 descem por fora do costado, passam por baixo e sobem até o prensa-cabo (curva de gotejamento)
    const tzE = v3(-0.6176, 0.829, -0.0977), tshE = v3(0.3915, 0.995, 0.5389);
    cond("TZ-104", [v3(-0.5, TY, -0.32), pol(-2.1, 0.66, 2.5), pol(-1.95, 0.74, 2.1), pol(-1.85, 0.76, 1.3), pol(-1.78, 0.76, 0.8), tzE.clone().add(v3(-0.02, -0.12, 0)), tzE.clone().add(v3(0, -0.035, 0)), tzE]);
    cond("TSH-104", [v3(-0.48, TY, -0.34), pol(-2.2, 0.64, 2.5), pol(-2.25, 0.7, 2.1), pol(-2.25, 0.7, 1.2), pol(-2.1, 0.7, 0.86), pol(-1.3, 0.7, 0.8), pol(-0.4, 0.7, 0.8), pol(0.35, 0.69, 0.82), tshE.clone().add(v3(0, -0.11, 0)), tshE.clone().add(v3(0, -0.035, 0)), tshE]);
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
      // transmissor de cabeçote (disco) + tampa do cabeçote
      add(new T.CylinderGeometry(0.03, 0.03, 0.012, 32), mat(0xF4F6F8, 0.05, 0.5), v3(0, -0.004, 0));
      for (let i = 0; i < 5; i++) add(new T.CylinderGeometry(0.004, 0.004, 0.006, 10), M.steel, v3(-0.018 + i * 0.009, 0.004, 0.012));
      const cap = new T.Group(); cap.position.set(-0.01, 0.014, 0); cap.rotation.z = 0.22; g.add(cap);
      const hd = mat(0x4A4F57, 0.45, 0.45);
      cap.add(mesh(new T.CylinderGeometry(0.047, 0.047, 0.02, 32), hd));
      cap.add(at(mesh(new T.SphereGeometry(0.047, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), hd), v3(0, 0.01, 0), v3(1, 0.3, 1)));
      cap.add(at(mesh(new T.CylinderGeometry(0.007, 0.007, 0.01, 6), M.bolt), v3(0, 0.025, 0)));
      cap.add(at(mesh(new T.BoxGeometry(0.018, 0.012, 0.02), hd), v3(-0.045, 0, 0)));
    } else if (tag === "PIT-103") {
      add(new T.CylinderGeometry(0.024, 0.024, 0.03, 6), M.steel, v3(0, 0.015, 0));
      add(new T.CylinderGeometry(0.026, 0.026, 0.06, 24), M.steel, v3(0, 0.06, 0));
      add(new T.CylinderGeometry(0.02, 0.02, 0.03, 16), M.steel, v3(0, 0.105, 0));
      add(cylZ(0.052, 0.12, 32), M.housing, v3(0, 0.165, 0));
      for (const z of [0.066, -0.066]) add(cylZ(0.056, 0.022, 32), M.housingDark, v3(0, 0.165, z));
      S.pitScreen = screen(200, 120);
      add(new T.CircleGeometry(0.04, 32), new T.MeshBasicMaterial({ map: S.pitScreen.tex }), v3(0, 0.165, 0.0775));
      add(new T.CircleGeometry(0.047, 32), new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0, depthWrite: false }), v3(0, 0.165, 0.0785));
      S.pitScreen.draw(["-.--", "bar"]);
      gland(g, v3(0.05, 0.165, -0.03), v3(1, 0, 0), 0.008);
      add(new T.BoxGeometry(0.03, 0.018, 0.002), mat(0xC9D1DA, 0.6, 0.3), v3(0, 0.2, 0.05));
    } else if (tag === "PSH-103") {
      add(new T.CylinderGeometry(0.022, 0.022, 0.028, 6), M.steel, v3(0, 0.014, 0));
      add(new T.CylinderGeometry(0.03, 0.03, 0.03, 24), M.steel, v3(0, 0.043, 0));
      add(new T.BoxGeometry(0.075, 0.09, 0.06), M.paint, v3(0, 0.103, 0));
      add(new T.BoxGeometry(0.078, 0.015, 0.063), mat(0xB83A2E, 0.2, 0.45), v3(0, 0.155, 0));
      add(new T.CylinderGeometry(0.006, 0.006, 0.02, 10), M.bolt, v3(0.02, 0.17, 0));
      gland(g, v3(0.038, 0.09, 0), v3(1, 0, 0), 0.008);
      S.pshLamp = new T.MeshStandardMaterial({ color: 0x225533, emissive: 0x1a6b3a, emissiveIntensity: 0.6 });
      add(new T.SphereGeometry(0.008, 12, 8), S.pshLamp, v3(-0.02, 0.12, 0.031));
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
    } else if (tag === "LIT-101") {
      add(new T.CylinderGeometry(0.03, 0.03, 0.02, 6), M.dark, v3(0, 0.01, 0));
      add(new T.CylinderGeometry(0.035, 0.04, 0.06, 32), mat(0x3E5068, 0.2, 0.6), v3(0, -0.03, 0));
      add(new T.CylinderGeometry(0.016, 0.016, 0.03, 16), M.dark, v3(0, 0.035, 0));
      add(new T.BoxGeometry(0.09, 0.09, 0.07), mat(0xE8E2D0, 0.1, 0.5), v3(0, 0.095, 0));
      S.litScreen = screen(200, 120);
      add(new T.PlaneGeometry(0.06, 0.036), new T.MeshBasicMaterial({ map: S.litScreen.tex }), v3(0, 0.105, 0.0355));
      S.litScreen.draw(["--", "%"]);
      gland(g, v3(0.045, 0.08, 0), v3(1, 0, 0), 0.008);
    } else if (tag === "LSH-101" || tag === "LSL-101") {
      const pv = new T.Group(); g.add(pv); S[tag === "LSH-101" ? "lshPivot" : "lslPivot"] = pv;
      pv.add(at(mesh(cylZ(0.006, 0.16, 10), M.steel), v3(0, 0, -0.08)));
      pv.add(at(mesh(new T.SphereGeometry(0.035, 20, 12), mat(0xF4F6F8, 0.05, 0.4)), v3(0, 0, -0.17), v3(1, 0.6, 1.4)));
      add(cylZ(0.022, 0.024, 6), M.steel, v3(0, 0, 0.012));
      add(cylZ(0.024, 0.05, 24), M.paint, v3(0, 0, 0.049));
      gland(g, v3(0, 0, 0.074), v3(0, 0, 1), 0.007);
      const lamp = new T.MeshStandardMaterial({ color: 0x225533, emissive: 0x1a6b3a, emissiveIntensity: 0.6 });
      add(new T.SphereGeometry(0.007, 12, 8), lamp, v3(0, 0.024, 0.05));
      S[tag === "LSH-101" ? "lshLamp" : "lslLamp"] = lamp;
    } else if (tag === "FIT-102") {
      const cast = mat(0x5A616B, 0.55, 0.5);
      add(cylX(0.036, 0.19, 32), M.steel, v3(0, 0, 0));
      for (const x of [-0.105, 0.105]) { flange(v3(x, 0, 0), v3(1, 0, 0), 0.024, g, 4); }
      add(new T.BoxGeometry(0.1, 0.085, 0.09), cast, v3(0, 0.005, 0));
      add(new T.BoxGeometry(0.06, 0.03, 0.06), cast, v3(0, 0.06, 0));
      add(new T.CylinderGeometry(0.016, 0.016, 0.05, 12), M.steel, v3(0, 0.08, 0));
      add(cylZ(0.046, 0.1, 32), M.housing, v3(0, 0.145, 0));
      for (const z of [0.055, -0.055]) add(cylZ(0.05, 0.018, 32), M.housingDark, v3(0, 0.145, z));
      S.fitScreen = screen(200, 120);
      add(new T.CircleGeometry(0.036, 28), new T.MeshBasicMaterial({ map: S.fitScreen.tex }), v3(0, 0.145, 0.0645));
      S.fitScreen.draw(["0,0", "L/min"]);
      gland(g, v3(0.046, 0.145, -0.03), v3(1, 0, 0), 0.007);
      add(new T.TubeGeometry(new T.CatmullRomCurve3([v3(0.07, 0.145, -0.03), v3(0.11, 0.16, -0.03), v3(0.125, 0.23, -0.05), v3(0.125, 0.27, -0.12)]), 24, 0.008, 10, false), mat(0x6E7782, 0.5, 0.5), v3(0, 0, 0));
      add(new T.CylinderGeometry(0.011, 0.011, 0.02, 12), M.dark, v3(0.125, 0.275, -0.125));
    } else if (tag === "FV-102") {
      // ---- corpo tipo globo flangeado
      const iron = M.castIron;
      g.add(at(mesh(new T.SphereGeometry(0.052, 32, 18), iron), v3(0, 0, 0), v3(1.18, 0.95, 0.92)));
      add(cylX(0.031, 0.2, 24), iron, v3(0, 0, 0));
      for (const x of [-0.1, 0.1]) flange(v3(x, 0, 0), v3(1, 0, 0), 0.024, g, 4);
      add(new T.CylinderGeometry(0.012, 0.012, 0.016, 6), M.bolt, v3(0, -0.055, 0));
      // ---- castelo com flange
      add(new T.CylinderGeometry(0.028, 0.036, 0.05, 24), iron, v3(0, 0.07, 0));
      flange(v3(0, 0.097, 0), v3(0, 1, 0), 0.019, g, 6);
      add(new T.CylinderGeometry(0.016, 0.016, 0.02, 16), M.steel, v3(0, 0.113, 0));
      // ---- arcada (yoke): base, colunas e travessa
      const yoke = mat(0x3D4A5C, 0.5, 0.45);
      add(new T.CylinderGeometry(0.046, 0.046, 0.012, 32), yoke, v3(0, 0.108, 0));
      for (const x of [-0.042, 0.042]) add(new T.BoxGeometry(0.013, 0.125, 0.018), yoke, v3(x, 0.175, 0));
      add(new T.BoxGeometry(0.11, 0.014, 0.04), yoke, v3(0, 0.243, 0));
      // ---- haste, conector (móvel) e régua de curso
      add(new T.CylinderGeometry(0.0055, 0.0055, 0.15, 12), M.chrome, v3(0, 0.18, 0));
      const conn = new T.Group(); conn.position.set(0, 0.15, 0); g.add(conn);
      conn.add(mesh(new T.BoxGeometry(0.03, 0.018, 0.022), M.steel));
      for (const x of [-0.009, 0.009]) conn.add(at(mesh(new T.CylinderGeometry(0.003, 0.003, 0.024, 6).rotateX(Math.PI / 2), M.bolt), v3(x, 0, 0)));
      conn.add(at(mesh(new T.BoxGeometry(0.028, 0.003, 0.003), mat(0xE87722, 0.2, 0.4)), v3(0.03, 0, 0.012)));
      S.fvMark = conn;
      const scale = canvasTex(40, 200, (c) => { c.fillStyle = "#fff"; c.fillRect(0, 0, 40, 200); c.fillStyle = "#1F2A37"; c.font = "bold 11px Arial"; for (let i = 0; i <= 4; i++) { const y = 180 - i * 40; c.fillRect(0, y, i % 2 ? 12 : 20, 3); c.fillText(i * 25, 22, y + 5); } });
      add(new T.PlaneGeometry(0.018, 0.075), new T.MeshStandardMaterial({ map: scale, roughness: 0.5 }), v3(0.046, 0.168, 0.0095));
      // ---- atuador de diafragma: carcaça inferior, anel aparafusado, carcaça superior e olhal
      const blue = mat(0x2C5FC0, 0.35, 0.38), blueD = mat(0x1E3F8A, 0.4, 0.4);
      add(new T.CylinderGeometry(0.118, 0.09, 0.045, 48), blue, v3(0, 0.272, 0));
      add(new T.CylinderGeometry(0.128, 0.128, 0.012, 48), blueD, v3(0, 0.3, 0));
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; add(new T.CylinderGeometry(0.0045, 0.0045, 0.026, 6), M.bolt, v3(Math.cos(a) * 0.121, 0.3, Math.sin(a) * 0.121)); }
      add(new T.CylinderGeometry(0.105, 0.118, 0.03, 48), blue, v3(0, 0.321, 0));
      g.add(at(mesh(new T.SphereGeometry(0.105, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), blue), v3(0, 0.336, 0), v3(1, 0.22, 1)));
      add(new T.CylinderGeometry(0.016, 0.02, 0.022, 20), blueD, v3(0, 0.37, 0));
      add(new T.TorusGeometry(0.012, 0.003, 8, 20), M.steel, v3(0, 0.388, 0));
      // tomadas de ar com plaquetas
      const plate = (txt) => new T.MeshBasicMaterial({ map: canvasTex(160, 36, c => { c.clearRect(0, 0, 160, 36); c.fillStyle = "#fff"; c.font = "bold 24px Arial"; c.textAlign = "center"; c.fillText(txt, 80, 27); }), transparent: true });
      add(new T.PlaneGeometry(0.06, 0.0135), plate("ENTRADA"), v3(0, 0.322, 0.1185));
      add(new T.PlaneGeometry(0.05, 0.0135), plate("SAÍDA"), v3(0, 0.27, 0.112));
      const port = (y, r0) => { const pg = new T.Group(); pg.position.set(0, y, r0); g.add(pg); pg.add(at(mesh(cylZ(0.008, 0.016, 6), M.brass), v3(0, 0, 0.008))); pg.add(at(mesh(new T.SphereGeometry(0.0065, 12, 8), mat(0x2E9A4E, 0.2, 0.4)), v3(0, 0, 0.018))); };
      port(0.322 - 0.018, 0.112); port(0.27 - 0.018, 0.103);
      // respiro superior
      add(new T.CylinderGeometry(0.006, 0.006, 0.03, 10), M.steel, v3(-0.07, 0.355, 0.03));
    } else if (tag === "FY-102") {
      // posicionador eletropneumático: bloco com 3 manômetros, carcaça de ligação e tubulação de ar
      const alu = mat(0xD3D8DE, 0.6, 0.32);
      add(new T.BoxGeometry(0.14, 0.04, 0.034), alu, v3(0, 0, 0.032));
      add(new T.BoxGeometry(0.142, 0.006, 0.036), mat(0x9AA3AD, 0.6, 0.35), v3(0, 0.021, 0.032));
      const face = canvasTex(64, 64, c => { c.fillStyle = "#fff"; c.beginPath(); c.arc(32, 32, 31, 0, 7); c.fill(); c.strokeStyle = "#1F2A37"; c.lineWidth = 2; for (let i = 0; i <= 8; i++) { const a = (-225 + i * 33.75) * Math.PI / 180; c.beginPath(); c.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); c.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); c.stroke(); } c.strokeStyle = "#B83A2E"; c.lineWidth = 3; c.beginPath(); c.moveTo(32, 32); c.lineTo(20, 18); c.stroke(); });
      for (const x of [-0.04, 0, 0.04]) {
        add(cylZ(0.015, 0.012, 28), M.chrome, v3(x, 0.0, 0.054));
        add(new T.CircleGeometry(0.0128, 28), new T.MeshStandardMaterial({ map: face, roughness: 0.3 }), v3(x, 0.0, 0.0605));
        add(cylZ(0.004, 0.012, 8), M.brass, v3(x, -0.017, 0.045));
      }
      // carcaça redonda de ligação elétrica (lado esquerdo)
      add(cylZ(0.03, 0.05, 36), mat(0xECEFF2, 0.2, 0.35), v3(-0.1, 0.0, 0.035));
      add(new T.TorusGeometry(0.026, 0.006, 12, 36), mat(0x1F2328, 0.3, 0.5), v3(-0.1, 0.0, 0.061));
      add(new T.CircleGeometry(0.02, 32), mat(0x2B2F36, 0.3, 0.6), v3(-0.1, 0.0, 0.058));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new T.BoxGeometry(0.004, 0.012, 0.004), mat(0xC9CED4), v3(-0.1 + Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0.063)); }
      gland(g, v3(-0.1, -0.03, 0.035), v3(0, -1, 0), 0.007);
      // tomadas OUT 1 · IN · OUT 2 no topo do bloco
      const lbl = canvasTex(256, 40, c => { c.fillStyle = "#D3D8DE"; c.fillRect(0, 0, 256, 40); c.fillStyle = "#1F2A37"; c.font = "bold 22px Arial"; c.textAlign = "center"; c.fillText("OUT 1", 50, 30); c.fillText("IN", 128, 30); c.fillText("OUT 2", 206, 30); });
      add(new T.PlaneGeometry(0.14, 0.022).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: lbl, roughness: 0.5 }), v3(0, 0.0245, 0.032));
      for (const x of [-0.045, 0, 0.045]) { add(new T.CylinderGeometry(0.006, 0.006, 0.012, 6), M.brass, v3(x, 0.03, 0.026)); }
      const blueT = mat(0x1F5FD0, 0.3, 0.4);
      const tube = (pts) => add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 28, 0.0035, 8, false), blueT, v3(0, 0, 0));
      tube([v3(-0.045, 0.035, 0.026), v3(-0.045, 0.06, 0.05), v3(-0.02, 0.076, 0.085), v3(0, 0.082, 0.1)]);   // OUT 1 → ENTRADA
      tube([v3(0.045, 0.035, 0.026), v3(0.045, 0.05, 0.06), v3(0.02, 0.04, 0.085), v3(0, 0.03, 0.091)]);      // OUT 2 → SAÍDA
      tube([v3(0, 0.035, 0.026), v3(0, 0.05, 0.0), v3(-0.06, 0.05, -0.02), v3(-0.14, 0.04, -0.02), v3(-0.17, 0.0, -0.02)]); // IN (ar de alimentação)
      // filtro-regulador de ar
      add(new T.CylinderGeometry(0.014, 0.014, 0.03, 16), M.alu, v3(-0.17, -0.015, -0.02));
      add(new T.CylinderGeometry(0.011, 0.008, 0.03, 16), new T.MeshPhysicalMaterial({ color: 0xDDE8F0, transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false }), v3(-0.17, -0.045, -0.02));
      // braço de realimentação até o conector da haste
      add(new T.BoxGeometry(0.004, 0.004, 0.034), M.steel, v3(0.03, -0.035, 0.012));
    } else if (tag === "VY-01") {
      add(new T.BoxGeometry(0.1, 0.07, 0.07), M.brass, v3(0, 0, 0));
      add(cylX(0.03, 0.18, 20), M.brass, v3(0, 0, 0));
      for (const x of [-0.095, 0.095]) flange(v3(x, 0, 0), v3(1, 0, 0), 0.024, g, 4);
      add(new T.CylinderGeometry(0.014, 0.014, 0.03, 16), M.steel, v3(0, 0.05, 0));
      add(new T.BoxGeometry(0.07, 0.085, 0.07), mat(0x1F2A37, 0.3, 0.6), v3(0, 0.105, 0));
      add(new T.BoxGeometry(0.05, 0.05, 0.03), mat(0x2B2F36, 0.2, 0.6), v3(0, 0.105, 0.05));
      add(new T.CylinderGeometry(0.004, 0.004, 0.01, 8), M.bolt, v3(0, 0.12, 0.068));
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
  const LPOS = { "TE-104": v3(-0.15, 0.12, 0), "TT-104": v3(0, 0.12, 0), "PIT-103": v3(0, 0.28, 0), "PSH-103": v3(0, 0.24, 0), "TSH-104": v3(0, 0.12, 0.08), "PG": v3(0, 0.11, 0.08),
    "LIT-101": v3(0, 0.2, 0), "LSH-101": v3(0.1, 0.05, 0.06), "LSL-101": v3(0.1, 0.05, 0.06), "FIT-102": v3(0, 0.25, 0), "FV-102": v3(0, 0.44, 0), "FY-102": v3(0.12, 0.02, 0.06), "VY-01": v3(0, 0.22, 0) };

  /* ---------- UI ---------- */
  function tip(html, kind = "") { const t = $("#tip3d"); t.className = "tip3d " + kind; t.innerHTML = `<span class="dica">${kind === "bad" ? "ATENÇÃO" : kind === "ok" ? "CERTO" : "DICA"}</span>${html}`; }
  function renderTray() {
    const tr = $("#tray3d");
    const cards = PARTS.filter(p => !S.installed[p.tag]).map(p => `<button class="pc ${S.sel === p.tag ? "sel" : ""}" data-t="${p.tag}" title="${p.name}"><svg viewBox="0 0 64 64">${ICONS[p.icon]}</svg><span>${p.name}</span><em>${p.label || p.tag}</em></button>`);
    if (!cards.length) cards.push('<div class="small" style="color:var(--muted);padding:6px 2px">Todas as peças foram usadas.</div>');
    const faltam = PARTS.some(p => p.slot && !S.installed[p.tag]);
    tr.innerHTML = `<div class="trh"><span>Bancada de Peças</span>${faltam ? '<button class="b3 pri" id="trAuto" title="Instala todos os instrumentos nos lugares certos">⚡ Montar tudo automaticamente</button>' : ""}</div><div class="trs">${cards.join("")}</div>`;
    const ta = $("#trAuto"); if (ta) ta.onclick = () => { window.App3D.autoInstall(); tip("Bancada montada automaticamente. Use <b>Recomeçar</b> para montar peça por peça.", "ok"); };
    tr.querySelectorAll(".pc[data-t]").forEach(b => b.onclick = () => selectPart(b.dataset.t));
    renderHud(); renderClp();
  }
  function selectPart(tag) {
    S.sel = S.sel === tag ? null : tag;
    const p = PARTS.find(x => x.tag === tag);
    const need = p.slot && SLOTDEF[p.slot].req;
    if (!S.sel) tip("Escolha uma peça na Bancada de Peças e toque na área azul onde ela deve ser instalada.");
    else if (need && !S.installed[PARTS.find(x => x.slot === need).tag]) tip(`<b>${p.name} ${p.tag}</b>: ${p.slot === "tt" ? "o transmissor de cabeçote vai dentro do cabeçote do sensor. Primeiro instale o sensor PT100." : "o posicionador vai na válvula de controle. Primeiro instale a FV-102."}`);
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
    else if (p.slot === "psh" && slotId === "pit") tip("<b>PSH-103</b>: o S indica chave (switch). Ela só atua no limite, é proteção. Este ponto é do transmissor de medição contínua.", "bad");
    else if (p.slot === "pit" && slotId === "psh") tip("<b>PIT-103</b>: o T indica transmissor, medição contínua em 4–20 mA. Este ponto é da chave de proteção.", "bad");
    else if (p.slot === "lit" && (slotId === "lsh" || slotId === "lsl")) tip("<b>LIT-101</b> mede o nível o tempo todo (4–20 mA) de cima, pela tampa. Os furos laterais são das chaves boia.", "bad");
    else if ((p.slot === "lsh" || p.slot === "lsl") && slotId === "lit") tip(`<b>${p.tag}</b> é chave: atua num ponto fixo, então vai na parede, na altura do limite. A tampa é do transmissor contínuo.`, "bad");
    else if (p.slot === "tt") tip("O transmissor de cabeçote vai <b>dentro do cabeçote do sensor PT100</b>, não aqui.", "bad");
    else if (p.slot === "fy") tip("O posicionador vai montado na <b>arcada da válvula de controle</b>, não aqui.", "bad");
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
    for (const k in SLOTDEF) if (SLOTDEF[k].req === slotId && S.slots[k].ghost) S.slots[k].ghost.visible = true;
    addLabel(p.tag, s.holder, s.mount.clone().add(LPOS[p.tag]), `<b>${p.tag}</b><i></i>`);
    const r = window.readTag ? window.readTag(p.tag).text : "";
    tip(`<b>${p.tag}</b> instalado: ${r}.${p.tag === "TE-104" ? " O cabeçote ficou aberto: agora instale o transmissor de cabeçote." : p.tag === "TT-104" ? " Cabeçote fechado." : p.tag === "FV-102" ? " Agora a arcada ficou disponível para o posicionador." : ""}`, "ok");
    renderTray();
    for (const grp of ["tq", "ln"]) if (ready(grp) && !S.done[grp]) {
      S.done[grp] = true;
      const all = ready("tq") && ready("ln");
      setTimeout(() => tip(all ? `<b>Bancada completa!</b> ${S.errors === 0 ? "Sem nenhum erro." : `Com ${S.errors} tentativa(s) errada(s).`} Opere as malhas no painel ao lado ou programe o CLP na aba <b>Programar CLP</b>.`
        : grp === "tq" ? "<b>TQ-01 montado!</b> Faça a ligação do TT-104 e inicie o aquecimento no painel ao lado."
          : "<b>Tanque e tubulação montados!</b> Agora abra a aba <b>Programar CLP</b> e faça o programa que controla o nível.", "ok"), 900);
    }
  }

  function renderHud() {
    const h = $("#h3d");
    let html = `<div class="hudtop"><b>Painel do processo</b><button class="b3" id="hudHide" title="Ocultar o painel">✕ Ocultar</button></div>`;
    for (const grp of ["tq", "ln"]) html += `<div class="hh">${GRP[grp]}</div><div class="prog"><i style="width:${count(grp) / total(grp) * 100}%"></i></div><div class="small">${count(grp)} de ${total(grp)} instrumentos instalados</div>`;
    if (ready("tq")) {
      const wired = !!window.__ttWired, P = S.proc;
      html += `<div class="sec3"><div class="hh">Malha de temperatura · TQ-01</div>
        <div class="small">${wired ? "TT-104 ligado ao CLP ✔" : "TT-104 ainda sem ligação: o CLP lê 0 mA"} · Comando: <b>${PLCo().run ? "CLP (Y4)" : "local (TIC-104)"}</b></div>
        <label class="small" style="display:block;margin-top:8px">Setpoint de temperatura (D200): <b id="b3spt"></b></label>
        <input type="range" id="b3sp" min="30" max="95" step="1" value="${P.sp}" style="width:100%">
        <div class="row3"><button class="b3" id="b3wire">${wired ? "Rever a ligação" : "Ligar o TT-104"}</button>
        ${PLCo().run ? "" : `<button class="b3 pri" id="b3run">${P.run ? "Desligar" : "Aquecer"}</button>`}
        <button class="b3 ${P.stuck ? "on" : ""}" id="b3stuck">Relé colado</button></div>
        <table class="t3" id="t3"></table></div>`;
    }
    if (ready("ln")) {
      const L = S.lvl, clp = PLCo().run;
      html += `<div class="sec3"><div class="hh">Malha de nível e vazão</div>
        <div class="small">Comando: <b>${clp ? "CLP em RUN" : "local (CLP em STOP)"}</b></div>
        <div class="row3">${clp ? "" : `<button class="b3 pri" id="b4pump">${L.pump ? "Desligar bomba" : "Ligar bomba"}</button>`}<button class="b3" id="b4drain">${L.drain ? "Fechar dreno" : "Abrir dreno"}</button><button class="b3" id="b4clp">Programar o CLP</button></div>
        <label class="small" style="display:block;margin-top:8px">Liga a bomba abaixo de (D210): <b id="b4lot"></b></label>
        <input type="range" id="b4lo" min="5" max="90" step="1" value="${L.spLo}" style="width:100%">
        <label class="small" style="display:block;margin-top:4px">Desliga acima de (D211): <b id="b4hit"></b></label>
        <input type="range" id="b4hi" min="10" max="95" step="1" value="${L.spHi}" style="width:100%">
        <label class="small" style="display:block;margin-top:8px">Setpoint de vazão (D220): <b id="b4fqt"></b></label>
        <input type="range" id="b4fq" min="0" max="30" step="0.5" value="${L.spQ}" style="width:100%">
        <label class="small" style="display:block;margin-top:8px">Abertura da FV-102 (FY-102): <b id="b4fvt"></b></label>
        <input type="range" id="b4fv" min="0" max="100" step="5" value="${Math.round(L.fvCmd)}" style="width:100%">
        <table class="t3" id="t4"></table></div>`;
    }
    h.innerHTML = html;
    $("#hudHide").onclick = () => setHud(false);
    if (ready("tq")) {
      $("#b3wire").onclick = () => window.openWiring ? window.openWiring() : window.show("pt100");
      $("#b3sp").oninput = e => { api.setSp(+e.target.value); };
      const br = $("#b3run"); if (br) br.onclick = () => { const P = S.proc; P.run = !P.run; if (P.run && P.trip) { if (P.T > P.lim - 5 || P.P > P.plim - 0.15) { tip("A proteção ainda está atuada: espere o TQ-01 esfriar alguns graus para rearmar.", "bad"); P.run = false; } else P.trip = false; } renderHud(); };
      $("#b3stuck").onclick = () => { S.proc.stuck = !S.proc.stuck; renderHud(); };
    }
    if (ready("ln")) {
      const bp = $("#b4pump");
      if (bp) bp.onclick = () => { const L = S.lvl; if (!L.pump && L.trip) { if (L.L >= 80) { tip("O <b>LSH-101</b> ainda está atuado: o nível precisa baixar de 80% para religar a bomba. Abra o dreno.", "bad"); return; } L.trip = false; } L.pump = !L.pump; renderHud(); };
      $("#b4drain").onclick = () => { S.lvl.drain = !S.lvl.drain; renderHud(); };
      $("#b4clp").onclick = () => window.openClp ? window.openClp() : window.show("clp");
      $("#b4fv").oninput = e => { S.lvl.fvCmd = +e.target.value; updateReadings(); };
      $("#b4fq").oninput = e => { api.setFlowSp(+e.target.value); };
      $("#b4lo").oninput = e => { api.setBand(+e.target.value, null); };
      $("#b4hi").oninput = e => { api.setBand(null, +e.target.value); };
    }
    updateReadings();
  }

  /* ---------- integração com o CLP programável (app-clp.js) ---------- */
  const RAW = 2000, RAO = 4000; // DVP-SX2: AI 4–20 mA → 0..2000 · AO 4–20 mA → 0..4000
  const PLCo = () => window.PLC;
  function plcInputs() {
    const io = PLCo().io, L = S.lvl;
    io.X[0] = L.L <= 15;
    io.X[1] = L.L >= 85 ? true : L.L <= 82 ? false : io.X[1];
    io.D[1110] = !S.installed["LIT-101"] || !ready("ln") ? 0 : L.litFail ? Math.round(0.1 * RAW) : Math.round(clamp(L.L, 0, 100) / 100 * RAW);
    const P = S.proc, ttOk = ready("tq") && !!window.__ttWired;
    io.D[1111] = ttOk ? Math.round(clamp(P.T, 0, 200) / 200 * RAW) : 0;          // 10 contagens = 1 °C
    io.X[5] = ready("tq") && (P.T >= P.lim ? true : P.T <= P.lim - 5 ? false : io.X[5]); // TSH-104
    io.D[200] = Math.round(P.sp * 10);                                             // SP na escala do TT-104
    io.D[210] = Math.round(L.spLo * RAW / 100); io.D[211] = Math.round(L.spHi * RAW / 100);
    io.D[1112] = S.installed["FIT-102"] && ready("ln") ? Math.round(clamp(L.Q, 0, 30) / 30 * RAW) : 0;             // FIT-102: 2000 = 30 L/min
    io.D[1113] = S.installed["PIT-103"] && ready("tq") ? Math.round(clamp(P.P, 0, 6) / 6 * RAW) : 0;               // PIT-103: 2000 = 6 bar
    io.X[6] = ready("tq") && (P.P >= P.plim ? true : P.P <= P.plim - 0.2 ? false : io.X[6]);                      // PSH-103
    io.D[220] = Math.round(L.spQ * RAW / 30); io.D[222] = Math.round(L.av * RAO / 100);
  }
  function plcCycle(dt) { if (!window.PLC) return; plcInputs(); PLCo().scan(dt); }
  function setHud(on) { S.hudOn = on; S.wrap.classList.toggle("hud-off", !on); try { localStorage.setItem("hud3d", on ? "1" : "0"); } catch (e) { } }
  function renderClp() { if (window.PLC && PLCo().refresh) PLCo().refresh(); }

  function updateReadings() {
    const P = S.proc, L = S.lvl;
    const lab = (k, txt, alarm) => { const l = S.labels[k]; if (l) { l.el.querySelector("i").textContent = txt; l.el.classList.toggle("alarm", !!alarm); } };
    if (P && ready("tq")) {
      const wired = !!window.__ttWired;
      const mA = wired ? 4 + 16 * clamp(P.T, 0, 200) / 200 : 0, pmA = 4 + 16 * clamp(P.P, 0, 6) / 6;
      const t3 = $("#t3"), spt = $("#b3spt"); if (spt) spt.textContent = P.sp + " °C · D200 = " + Math.round(P.sp * 10);
      if (t3) t3.innerHTML = `
        <tr><td><b>TT-104</b></td><td>${wired ? fmt(P.T) + " °C" : "FALHA"}</td><td>${fmt(mA, 2)} mA</td></tr>
        <tr><td><b>PIT-103</b></td><td>${fmt(P.P, 2)} bar</td><td>${fmt(pmA, 2)} mA</td></tr>
        <tr><td><b>${window.PLC && window.PLC.run ? "CLP Y4" : "TIC-104"}</b></td><td>SP ${P.sp} °C</td><td>${P.trip ? "bloqueado" : P.heat ? "aquecendo" : "parado"}</td></tr>
        <tr><td><b>TSH-104</b></td><td colspan="2">${P.trip === "tsh" ? "<span class='al'>ATUOU a " + P.lim + " °C</span>" : "vigiando (" + P.lim + " °C)"}</td></tr>
        <tr><td><b>PSH-103</b></td><td colspan="2">${P.trip === "psh" ? "<span class='al'>ATUOU a " + fmt(P.plim) + " bar</span>" : "vigiando (" + fmt(P.plim) + " bar)"}</td></tr>`;
      lab("TT-104", wired ? fmt(P.T) + " °C · " + fmt(mA, 2) + " mA" : "0 mA · sem ligação", !wired);
      lab("PIT-103", fmt(P.P, 2) + " bar · " + fmt(pmA, 2) + " mA");
      lab("PG", fmt(P.P, 1) + " bar");
      lab("TSH-104", P.trip === "tsh" ? "ATUOU" : "OK", P.trip === "tsh");
      lab("PSH-103", P.trip === "psh" ? "ATUOU" : "OK", P.trip === "psh");
      if (S.pitScreen) S.pitScreen.draw([fmt(P.P, 2), "bar"]);
      setNeedle(P.P);
      S.panelScreen.draw(wired ? ["TIC-104", `PV ${fmt(P.T)} · SP ${P.sp} °C`] : ["TIC-104", "FALHA TT-104"], "#1F2A37");
    }
    if (L && ready("ln")) {
      const Q = L.Q, qmA = 4 + 16 * Q / 30, fmA = 4 + 16 * L.fv / 100, PL = { X: PLCo().io.X, D1110: PLCo().io.D[1110], litFail: L.litFail };
      const litPct = PL.D1110 / RAW * 100, lmA = 4 + 16 * litPct / 100;
      const t4 = $("#t4"), fvt = $("#b4fvt");
      if (fvt) fvt.textContent = `pedida ${Math.round(L.fvCmd)}% · real ${Math.round(L.fv)}% · ${fmt(fmA, 2)} mA`;
      const fqt = $("#b4fqt"); if (fqt) fqt.textContent = fmt(L.spQ) + " L/min · D220 = " + Math.round(L.spQ * RAW / 30);
      const lot = $("#b4lot"), hit = $("#b4hit"); if (lot) lot.textContent = L.spLo + "% · D210 = " + Math.round(L.spLo * RAW / 100); if (hit) hit.textContent = L.spHi + "% · D211 = " + Math.round(L.spHi * RAW / 100);
      if (t4) t4.innerHTML = `
        <tr><td><b>LIT-101</b></td><td>${fmt(litPct, 0)} %</td><td>${fmt(lmA, 2)} mA</td></tr>
        <tr><td><b>FIT-102</b></td><td>${fmt(Q)} L/min</td><td>${fmt(qmA, 2)} mA</td></tr>
        <tr><td><b>FY-102</b></td><td>FV ${Math.round(L.fv)}% aberta</td><td>${fmt(fmA, 2)} mA</td></tr>
        <tr><td><b>VY-01</b></td><td colspan="2">${L.vy ? "aberta (bobina energizada)" : "fechada"}</td></tr>
        <tr><td><b>LSH-101</b></td><td colspan="2">${L.trip || PL.X[1] ? "<span class='al'>ATUOU: bomba desligada</span>" : "normal"}</td></tr>
        <tr><td><b>LSL-101</b></td><td colspan="2">${PL.X[0] ? "<span class='al'>ALARME: nível baixo</span>" : "normal"}</td></tr>`;
      lab("LIT-101", fmt(litPct, 0) + " % · " + fmt(lmA, 2) + " mA" + (PL.litFail ? " · travado" : ""), PL.litFail);
      lab("FIT-102", fmt(Q) + " L/min · " + fmt(qmA, 2) + " mA");
      lab("FY-102", fmt(fmA, 2) + " mA → " + Math.round(L.fv) + "%");
      lab("FV-102", Math.round(L.fv) + "% aberta");
      lab("VY-01", L.vy ? "aberta" : "fechada");
      lab("LSH-101", L.trip || PL.X[1] ? "ATUOU" : "OK", L.trip || PL.X[1]);
      lab("LSL-101", PL.X[0] ? "ALARME" : "OK", PL.X[0]);
      if (S.fitScreen) S.fitScreen.draw([fmt(Q), "L/min"]);
      if (S.litScreen) S.litScreen.draw([fmt(litPct, 0), "%"]);
      drawPlc();
    }
    renderClp();
  }
  function stepProc(dt) {
    const P = S.proc;
    const wired = !!window.__ttWired;
    const PL = window.PLC, clp = !!(PL && PL.run);
    let ctrl = false;
    if (!clp && P.run && wired) { const e = P.sp - P.T; ctrl = e > 1 ? true : e < -1 ? false : P.ctrl; }
    P.ctrl = ctrl;
    if (!P.trip && P.T >= P.lim) P.trip = "tsh";
    if (!P.trip && P.P >= P.plim) P.trip = "psh";
    if (clp && P.trip && P.T <= P.lim - 5 && P.P <= P.plim - 0.15) P.trip = false; // rearme automático no comando pelo CLP
    const cmd = clp ? PL.io.Y[4] : (P.run && ctrl);
    P.heat = !P.trip && (P.stuck || cmd);
    P.T += ((P.heat ? 1.6 : 0) - 0.01 * (P.T - 25)) * dt;
    P.P = Math.max(0, (P.T - 25) * 0.035);
    S.tzLamp.emissive.setHex(P.heat ? 0xFF7A1A : 0x000000); S.tzLamp.emissiveIntensity = P.heat ? 1.6 : 0;
    if (S.tshLamp) { S.tshLamp.emissive.setHex(P.trip === "tsh" ? 0xE0503C : 0x1a6b3a); S.tshLamp.emissiveIntensity = P.trip === "tsh" ? 1.8 : 0.6; }
    if (S.pshLamp) { S.pshLamp.emissive.setHex(P.trip === "psh" ? 0xE0503C : 0x1a6b3a); S.pshLamp.emissiveIntensity = P.trip === "psh" ? 1.8 : 0.6; }
  }
  function stepLevel(dt) {
    const L = S.lvl, PL = PLCo();
    let pumpCmd, vyCmd;
    if (PL.run) {
      pumpCmd = PL.io.Y[0]; vyCmd = PL.io.Y[1]; L.trip = false; L.pump = false;
      if (PL.aoUsed()) L.fvCmd = clamp((PL.io.D[1116] || 0) / RAO * 100, 0, 100);
      if (PL.io.X[1] && pumpCmd && !L.lshMsg) { L.lshMsg = true; tip("<b>LSH-101 atuado (X1 = 1)</b>, mas a bomba continua ligada: o programa não usa o X1 para proteger. Coloque um contato NF de X1 na rede do Y0.", "bad"); }
      if (!PL.io.X[1]) L.lshMsg = false;
    } else {
      if (L.L >= 85 && L.pump) { L.trip = true; L.pump = false; renderHud(); tip("<b>LSH-101 atuou!</b> Nível alto: a chave desligou a bomba e a VY-01 fechou. É intertravamento: protege contra transbordar.", "bad"); }
      pumpCmd = L.pump; vyCmd = L.pump;
    }
    if (pumpCmd && !vyCmd) { if (!L.deadMsg) { L.deadMsg = true; tip("Bomba ligada (Y0) com a <b>VY-01 fechada</b> (Y1 = 0): não há vazão. Ligue o Y1 junto com o Y0.", "bad"); } } else L.deadMsg = false;
    L.fv += (L.fvCmd - L.fv) * Math.min(1, dt / 1.5);
    L.pumpOn = pumpCmd; L.vy = vyCmd;
    L.Q = pumpCmd && vyCmd ? 30 * L.fv / 100 : 0;
    const out = (L.drain ? 14 : 3) * Math.sqrt(Math.max(L.L, 0) / 100);
    L.L = clamp(L.L + (L.Q - out) / 60 / 300 * 100 * dt * 4, 0, 100);
    if (L.L >= 99.5 && L.Q > 0) { if (!L.overMsg) { L.overMsg = true; tip("<b>Transbordou!</b> O tanque de acrílico encheu até a borda. Nada desligou a bomba: use o LSH-101 (X1, contato NF) como proteção no programa.", "bad"); } } else if (L.L < 95) L.overMsg = false;
    setWater(L.L);
    S.pumpLamp.emissive.setHex(pumpCmd ? 0x2EE07A : 0); S.pumpLamp.emissiveIntensity = pumpCmd ? 1.4 : 0;
    S.k1Lamp.emissive.setHex(pumpCmd ? 0x2EE07A : 0); S.k1Lamp.emissiveIntensity = pumpCmd ? 1.2 : 0;
    if (S.doorLamps) { const on = [PL.io.Y[3] || (!PL.run && pumpCmd), PL.io.Y[2], false]; S.doorLamps.forEach((m, i) => { m.emissiveIntensity = on[i] ? 1.6 : 0.08; }); }
    if (S.vyLamp) { S.vyLamp.emissive.setHex(vyCmd ? 0xFFB020 : 0); S.vyLamp.emissiveIntensity = vyCmd ? 1.4 : 0; }
    if (S.fvMark) S.fvMark.position.y = 0.15 + 0.035 * L.fv / 100;
    if (S.lshLamp) { const on = L.trip || PL.io.X[1]; S.lshLamp.emissive.setHex(on ? 0xE0503C : 0x1a6b3a); S.lshLamp.emissiveIntensity = on ? 1.8 : 0.6; }
    if (S.lslLamp) { const on = PL.io.X[0]; S.lslLamp.emissive.setHex(on ? 0xE0503C : 0x1a6b3a); S.lslLamp.emissiveIntensity = on ? 1.8 : 0.6; }
    S.rotaFloat.position.y = 0.7 + 0.38 * L.Q / 30;
  }

  /* ---------- animações das variáveis ---------- */
  const A = { t: 0, flowDist: 0, pumpW: 0, thermal: false, bubbles: [], steam: [], ringT: 0, bubAcc: 0, steamAcc: 0 };
  function texArrow() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d");
    g.strokeStyle = "rgba(110,215,255,1)"; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(14, 46); g.lineTo(32, 22); g.lineTo(50, 46); g.stroke();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function texStreak() {
    const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d");
    g.fillStyle = "rgba(160,215,250,0.75)"; g.fillRect(0, 0, 128, 32);
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
    A.surf = mesh(sg, new T.MeshStandardMaterial({ color: 0x3E8FD6, transparent: true, opacity: 0.7, roughness: 0.06, metalness: 0.2, depthWrite: false, side: T.DoubleSide }), false, false);
    A.surf.renderOrder = 4; S.ac.add(A.surf);
    // jato de entrada
    A.jetTex = texStreak(); A.jetMat = new T.MeshStandardMaterial({ map: A.jetTex, color: 0xBFE3FA, transparent: true, opacity: 0.85, roughness: 0.1, depthWrite: false });
    A.jet = null; A.jetKey = "";
    // bolhas
    A.bub = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), new T.MeshStandardMaterial({ color: 0xF2FAFF, transparent: true, opacity: 0.75, roughness: 0.05 }), 70);
    A.bub.count = 0; A.bub.renderOrder = 5; S.ac.add(A.bub);
    // dreno: filete até o ralo
    const dc = new T.CatmullRomCurve3([v3(-0.2, 0.39, 0.17), v3(-0.2, 0.36, 0.21), v3(-0.2, 0.2, 0.27), v3(-0.2, 0.005, 0.3)]);
    A.drainTex = texStreak(); A.drain = mesh(new T.TubeGeometry(dc, 20, 0.006, 8, false), new T.MeshStandardMaterial({ map: A.drainTex, color: 0xBFE3FA, transparent: true, opacity: 0.85, roughness: 0.1, depthWrite: false }), false, false);
    A.drain.visible = false; S.ac.add(A.drain);
    S.ac.add(at(mesh(new T.BoxGeometry(0.16, 0.006, 0.16), mat(0x5A6068, 0.6, 0.4), false), v3(-0.2, 0.003, 0.3)));
    for (let i = 0; i < 5; i++) S.ac.add(at(mesh(new T.BoxGeometry(0.14, 0.008, 0.008), mat(0x2B2F36), false), v3(-0.2, 0.007, 0.25 + i * 0.025)));
    // setas de fluxo na tubulação
    A.suc = flowSleeves(root, [
      [v3(0, 0.6, 0), v3(0, 0.3, 0), v3(1.05, 0.3, 0), v3(1.05, 0.3, -0.62), v3(1.05, 0.17, -0.62)],
      [v3(1.05, 0.17, -0.62), v3(0.78, 0.17, -0.62), v3(0.78, 0.17, -0.95), v3(0.895, 0.17, -0.95)]], 0.026);
    A.dis = flowSleeves(root, [
      [v3(1.02, 0.31, -0.95), v3(1.02, 0.45, -0.95), v3(1.02, 0.45, -0.35), v3(1.24, 0.45, -0.35)],
      [v3(1.46, 0.45, -0.35), v3(1.74, 0.45, -0.35)], [v3(1.98, 0.45, -0.35), v3(2.26, 0.45, -0.35)],
      [v3(2.46, 0.45, -0.35), v3(2.75, 0.45, -0.35), v3(2.75, 0.45, -1.0), v3(2.75, 0.62, -1.0)],
      [v3(2.75, 1.175, -1.0), v3(2.75, 1.4, -1.0), v3(2.23, 1.4, -1.0)]], 0.024);
    // vapor
    const puff = texPuff();
    for (let i = 0; i < 30; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: puff, transparent: true, opacity: 0, depthWrite: false, color: 0x7F8C99 })); sp.visible = false; root.add(sp); A.steam.push({ sp, life: 1 }); }
    // pulso do ultrassom
    A.ring = mesh(new T.RingGeometry(0.022, 0.03, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x7FD3FF, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }), false, false);
    A.ring.position.set(-0.1, 1.5, 0.05); S.ac.add(A.ring);
  }
  const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _sc = new T.Vector3(), _p = new T.Vector3();
  function stepAnims(dt) {
    A.t += dt; const t = A.t;
    if (S.conduits) for (const c of S.conduits) c.g.visible = c.tag === "TZ-104" || !!S.installed[c.tag];
    const L = S.lvl, P = S.proc;
    const Q = ready("ln") ? L.Q : 0, pumpOn = ready("ln") && L.pumpOn;
    const topY = 0.65 + 0.88 * L.L / 100;
    // ---- superfície com ondas e ondulação no ponto de impacto
    const submerged = topY >= 1.38, jetOn = Q > 0.2 && !submerged;
    const ix = submerged ? 0.3 : 0.17, iz = 0;
    const pos = A.surf.geometry.attributes.position, base = A.surfBase;
    const amp = 0.0015 + 0.005 * Q / 30 + (L.drain ? 0.0015 : 0), rip = Q > 0.2 ? 0.006 * (0.4 + Q / 30) : 0;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      const d = Math.hypot(x - ix, z - iz);
      const y = amp * (0.6 * Math.sin(x * 23 + t * 2.6) + 0.4 * Math.sin(z * 29 - t * 2.1)) + rip * Math.sin(d * 70 - t * 10) * Math.exp(-d * 9);
      pos.array[i * 3 + 1] = y;
    }
    pos.needsUpdate = true; A.surf.geometry.computeVertexNormals();
    A.surf.position.set(0, topY + 0.002, 0); A.surf.visible = L.L > 0.5;
    // ---- jato de entrada
    if (jetOn) {
      const key = Math.round(topY * 100) + "|" + Math.round(Q / 3);
      if (key !== A.jetKey) {
        A.jetKey = key; if (A.jet) { S.ac.remove(A.jet); A.jet.geometry.dispose(); }
        const cv = new T.CatmullRomCurve3([v3(0.32, 1.4, 0), v3(0.27, 1.39, 0), v3(0.21, (1.4 + topY) / 2 + 0.02, 0), v3(0.17, topY, 0)]);
        A.jet = mesh(new T.TubeGeometry(cv, 18, 0.005 + 0.011 * Q / 30, 10, false), A.jetMat, false, false); A.jet.renderOrder = 5; S.ac.add(A.jet);
      }
      A.jet.visible = true; A.jetTex.offset.x -= dt * 2.4;
    } else if (A.jet) A.jet.visible = false;
    // ---- bolhas
    if (Q > 0.2) { A.bubAcc += dt * (6 + Q * 1.2); while (A.bubAcc > 1) { A.bubAcc--; let b = A.bubbles.find(x => !x.on); if (!b) { if (A.bubbles.length >= 70) break; b = {}; A.bubbles.push(b); }
      Object.assign(b, { on: true, x: ix + (Math.random() - 0.5) * 0.08, z: iz + (Math.random() - 0.5) * 0.08, y: (submerged ? 1.4 : topY) - 0.03 - Math.random() * 0.18, v: 0.06 + Math.random() * 0.12, r: 0.003 + Math.random() * 0.006 }); } }
    let n = 0;
    for (const b of A.bubbles) { if (!b.on) continue; b.y += b.v * dt; b.x += Math.sin(t * 7 + b.r * 900) * 0.0015; if (b.y >= topY || b.y < 0.66) { b.on = false; continue; }
      _m4.compose(_p.set(b.x, b.y, b.z), _q, _sc.set(b.r, b.r, b.r)); A.bub.setMatrixAt(n++, _m4); if (n >= 70) break; }
    A.bub.count = n; A.bub.instanceMatrix.needsUpdate = true;
    // ---- dreno
    const drainOn = L.drain && L.L > 1;
    A.drain.visible = drainOn; if (drainOn) { const k = 0.6 + Math.sqrt(L.L / 100); A.drain.scale.set(1, 1, 1); A.drain.material.opacity = 0.55 + 0.3 * k / 1.6; A.drainTex.offset.x -= dt * 2.2; }
    // ---- setas de fluxo
    const speed = 0.2 + 1.3 * Q / 30; A.flowDist += speed * dt * (Q > 0.2 ? 1 : 0);
    const op = Q > 0.2 ? Math.min(0.9, 0.35 + Q / 30) : 0;
    for (const f of [...A.suc, ...A.dis]) { f.m.opacity += (op - f.m.opacity) * Math.min(1, dt * 4); f.o.visible = f.m.opacity > 0.02; f.tex.offset.y = -A.flowDist / 0.11; }
    // ---- motor: partida/parada suaves e vibração
    A.pumpW += ((pumpOn ? 1 : 0) - A.pumpW) * Math.min(1, dt * (pumpOn ? 1.6 : 0.8));
    if (S.pumpFan) S.pumpFan.rotation.x += dt * 55 * A.pumpW;
    if (S.pumpG) { const v = 0.0009 * A.pumpW; S.pumpG.position.set(S.pumpBase.x + (Math.random() - 0.5) * v, S.pumpBase.y + (Math.random() - 0.5) * v, S.pumpBase.z + (Math.random() - 0.5) * v); }
    // ---- rotâmetro "dançando"
    if (S.rotaFloat && Q > 0.2) S.rotaFloat.position.y += Math.sin(t * 13) * 0.004 + Math.sin(t * 29) * 0.002;
    // ---- boias seguem a água
    const tilt = (pv, yS) => { if (!pv) return; const target = topY > yS + 0.01 ? 0.38 : -0.12; pv.rotation.x += (target - pv.rotation.x) * Math.min(1, dt * 3); };
    tilt(S.lshPivot, 1.38); tilt(S.lslPivot, 0.8);
    // ---- pulso do ultrassom (LIT-101)
    if (S.installed["LIT-101"] && L.L > 0.5) {
      A.ringT += dt; const per = 0.7, k = (A.ringT % per) / 0.4;
      if (k <= 1) { A.ring.position.y = 1.5 - (1.5 - topY) * k; const sc = 1 + k * 2.2; A.ring.scale.set(sc, 1, sc); A.ring.material.opacity = 0.75 * (1 - k * 0.7); }
      else A.ring.material.opacity = 0;
    } else A.ring.material.opacity = 0;
    // ---- temperatura: vapor pelo respiro
    const hot = ready("tq") ? clamp((P.T - 55) / 30, 0, 1) : 0;
    A.steamAcc += dt * hot * 9;
    while (A.steamAcc > 1) { A.steamAcc--; const p = A.steam.find(x => x.life >= 1); if (!p) break; p.life = 0; p.sp.position.set(0.07, 2.27, -0.05); p.vx = 0.04 + Math.random() * 0.05; p.vz = (Math.random() - 0.5) * 0.04; p.s0 = 0.05 + Math.random() * 0.04; }
    for (const p of A.steam) {
      if (p.life >= 1) { p.sp.visible = false; continue; }
      p.life += dt / 2.6; p.sp.visible = true;
      p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt; p.sp.position.y += (0.18 + 0.12 * p.life) * dt;
      const sc = p.s0 + p.life * 0.35; p.sp.scale.set(sc, sc, sc);
      p.sp.material.opacity = Math.sin(Math.PI * Math.min(1, p.life)) * (0.4 + 0.35 * hot);
    }
    // ---- visão térmica do TQ-01
    if (A.thermal && ready("tq")) { const k = clamp((P.T - 20) / 75, 0, 1); M.tank.emissive.setHSL(0.66 * (1 - k), 1, 0.5); M.tank.emissiveIntensity = 0.5; M.tank.color.setHex(0xA7AFB8); }
    else { M.tank.emissive.setHex(0); M.tank.emissiveIntensity = 0; M.tank.color.setHex(0xC9D1DA); }
  }

  /* ---------- câmera ---------- */
  const VIEWS = {
    geral: { p: v3(3.2, 2.7, 4.3), t: v3(0.6, 0.95, -0.5) },
    topo: { p: v3(0.55, 2.95, 1.05), t: v3(0, 2.05, 0.0) },
    lateral: { p: v3(0.4, 1.85, 2.5), t: v3(0.0, 1.0, 0.2) },
    acrilico: { p: v3(2.5, 1.8, 1.25), t: v3(1.95, 1.0, -0.8) },
    tubulacao: { p: v3(1.9, 1.25, 1.15), t: v3(1.85, 0.38, -0.4) },
    painel: { p: v3(-3.6, 1.75, -0.95), t: v3(-4.85, 1.65, -1.25) },
    clp: { p: v3(-4.42, 1.8, -1.0), t: v3(-4.95, 1.78, -1.0) },
  };
  // obstáculos (coordenadas do mundo): caixas [xmin, xmax, zmin, zmax, ytopo] e cilindros [x, z, raio, ytopo]
  const ROOM = { x0: -4.82, x1: 4.82, z0: -3.85, z1: 4.82, y0: 0.25, y1: 3.0 };
  const BOXES = [
    [1.42, 2.38, -1.48, -0.52, 1.75], [0.72, 1.55, -1.18, -0.72, 0.45], [2.6, 2.9, -1.12, -0.88, 1.45],
    [-4.12, -2.48, -4.0, -3.05, 2.15], [1.98, 4.22, -4.0, -3.33, 1.8], [3.88, 4.62, -2.88, -1.72, 1.75],
    [4.38, 5.0, -1.25, 5.0, 3.2], [-5.0, -4.38, 0.95, 5.0, 3.2], [-5.0, -4.62, -1.7, -0.7, 2.15], [-2.55, -2.15, -3.6, -3.2, 0.7],
  ];
  const CYLS = [[0, 0, 0.7, 2.35]];
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
  function goView(k) { const v = VIEWS[k]; S.tw = { p0: S.cam.position.clone(), t0: S.ctl.target.clone(), p1: v.p.clone(), t1: v.t.clone(), k: 0 }; }

  /* ---------- inicialização ---------- */
  function init(wrap) {
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true }); }
    catch (e) { $("#load3d").textContent = "Este computador não conseguiu iniciar o 3D (WebGL). Atualize o navegador ou o driver de vídeo."; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.domElement.className = "c3d";
    wrap.prepend(renderer.domElement);
    const lr = new T.CSS2DRenderer(); lr.domElement.className = "l3layer"; wrap.appendChild(lr.domElement);
    const scene = new T.Scene(); scene.background = new T.Color(0xE9EDF1);
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
    const cam = new T.PerspectiveCamera(42, 1, 0.03, 60);
    cam.position.copy(VIEWS.geral.p);
    const ctl = new T.OrbitControls(cam, renderer.domElement);
    ctl.target.copy(VIEWS.geral.t); ctl.enableDamping = true; ctl.minDistance = 0.35; ctl.maxDistance = 7.5; ctl.maxPolarAngle = Math.PI * 0.495;
    ctl.addEventListener("start", () => { S.tw = null; });
    Object.assign(S, { renderer, lr, scene, cam, ctl, wrap });
    S.fx = true; S.composer = null;
    try {
      const comp = new T.EffectComposer(renderer);
      comp.addPass(new T.RenderPass(scene, cam));
      const ao = new T.GTAOPass(scene, cam, 800, 600);
      ao.output = T.GTAOPass.OUTPUT.Default; ao.blendIntensity = 1.0;
      ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
      const ov = ao.overrideVisibility.bind(ao);
      ao.overrideVisibility = function () { ov(); this.scene.traverse(o => { if (o.isSprite || (o.material && !Array.isArray(o.material) && o.material.transparent)) o.visible = false; }); };
      comp.addPass(ao); comp.addPass(new T.OutputPass());
      S.composer = comp; S.ao = ao;
    } catch (e) { S.fx = false; }
    const fxBtn = () => { const b = $("#b3fx"); if (b) b.textContent = S.fx ? "✨ Gráficos: realista" : "⚡ Gráficos: leve"; };
    const bfx = $("#b3fx"); if (bfx) bfx.onclick = () => { if (!S.composer) return; S.fx = !S.fx; S.slow = 0; fxBtn(); };
    fxBtn();

    scene.add(new T.HemisphereLight(0xffffff, 0x9A9690, 0.75));
    const sun = new T.DirectionalLight(0xfff8f0, 1.35); sun.position.set(2.5, 7.5, 3.5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 22 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    scene.add(sun);
    const fill = new T.PointLight(0xfff6ec, 5, 9, 2); fill.position.set(-2, 3.0, 1.5); scene.add(fill);
    const win = new T.DirectionalLight(0xEAF2FF, 0.55); win.position.set(0, 2.2, -6); win.target.position.set(0, 0.8, 2); scene.add(win); scene.add(win.target);

    Object.assign(M, {
      steel: mat(0xC9D1DA, 0.85, 0.28), tank: mat(0xC9D1DA, 0.85, 0.28), water: mat(0x2E8B3E, 0.25, 0.42), steam: mat(0xF2F3F4, 0.2, 0.45), conduit: mat(0x4A4F57, 0.35, 0.5), dark: mat(0x6B7684, 0.7, 0.45), paint: mat(0x8A949F, 0.4, 0.6), alu: mat(0xC2CAD3, 0.75, 0.38),
      blue: mat(0x2F6DB5, 0.3, 0.45), blueDark: mat(0x1E3A5F, 0.3, 0.5),
      housing: mat(0xE3D4B4, 0.15, 0.5), housingDark: mat(0xCDBD98, 0.2, 0.5),
      flange: mat(0xB6BFC9, 0.85, 0.32), bolt: mat(0x5A6370, 0.8, 0.35), weld: mat(0xA9B2BC, 0.8, 0.5),
      support: mat(0x58626E, 0.5, 0.55), base: mat(0x3B434D, 0.5, 0.6), gland: mat(0x2B2F36, 0.3, 0.6), cable: mat(0x6E7782, 0.1, 0.8),
      chrome: mat(0xE6EBF0, 1, 0.12), castIron: mat(0x55606C, 0.6, 0.5), brass: mat(0xB08D57, 0.75, 0.35),
    });
    buildRoom(scene);
    const root = new T.Group(); scene.add(root);
    buildTank(root, S.slots);
    buildLine(root, S.slots);
    buildPanel(root);
    for (const id in SLOTDEF) makeGhost(id, S.slots[id]);
    initAnims(root);
    addLabel("TZ-104", S.tz, v3(0, 0.15, 0.1), "<b>TZ-104</b><i>resistência</i>", "pre");
    addLabel("CLP", S.plc3d, v3(0, 0.2, 0.1), "<b>CLP DVP-SX2</b><i>TIC-104 e malha de nível</i>", "pre");
    addLabel("TQ01", root, v3(0.45, 0.5, 0.5), "<b>TQ-01</b><i>tanque inox</i>", "tank");
    addLabel("TQAC", S.ac, v3(0.42, 1.25, 0.1), "<b>Tanque de acrílico</b><i>nível</i>", "tank");
    addLabel("ROTA", root, v3(2.82, 1.15, -0.9), "<b>Rotâmetro</b><i>indicação local</i>", "pre");
    addLabel("BOMBA", root, v3(1.3, 0.42, -0.95), "<b>Bomba</b>", "pre");
    S.proc = { T: 25, P: 0, sp: 60, lim: 90, plim: 2.2, run: false, stuck: false, trip: false, heat: false, ctrl: false };
    S.lvl = { L: 40, Q: 0, fv: 60, fvCmd: 60, pump: false, pumpOn: false, vy: false, trip: false, drain: false, litFail: false, spLo: 40, spHi: 70, spQ: 15, av: 50 };
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
      if (hitsG.length && (!hitsP.length || hitsG[0].distance < hitsP[0].distance + 0.05)) return { slot: hitsG[0].object.userData.slot };
      if (hitsP.length) return { part: hitsP[0].object.userData.tag };
      return null;
    };
    renderer.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener("pointerup", e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) { down = null; return; }
      down = null;
      const h = pick(e);
      if (!h) return;
      if (h.slot) tryInstall(h.slot);
      else if (h.part) {
        const r = window.readTag ? window.readTag(h.part).text : h.part;
        tip(`<b>${h.part}</b>: ${r}.${h.part === "TT-104" || h.part === "TE-104" ? ` <button class="b3" id="tipWire">Abrir a ligação do PT100</button>` : ""}`);
        const b = $("#tipWire"); if (b) b.onclick = () => window.openWiring ? window.openWiring() : window.show("pt100");
      }
    });
    renderer.domElement.addEventListener("pointermove", e => {
      if (e.buttons) return;
      const h = pick(e);
      renderer.domElement.style.cursor = h ? "pointer" : "grab";
      const hot = h && h.part ? h.part : null;
      if (hot !== S.hot) { if (S.hot && S.labels[S.hot]) S.labels[S.hot].el.classList.remove("hot"); S.hot = hot; if (hot && S.labels[hot]) S.labels[hot].el.classList.add("hot"); }
      Object.values(S.slots).forEach(s => { if (s.ghost) s.ghost.userData.hover = h && h.slot === s.ghost.userData.slot; });
    });
    document.querySelectorAll("#v3d-views [data-view]").forEach(b => b.onclick = () => goView(b.dataset.view));
    $("#b3reset").onclick = reset;
    let hudPref = true; try { hudPref = localStorage.getItem("hud3d") !== "0"; } catch (e) { }
    setHud(hudPref);
    const hs = $("#h3dShow"); if (hs) hs.onclick = () => setHud(true);
    const bth = $("#b3therm"); if (bth) bth.onclick = () => { A.thermal = !A.thermal; bth.classList.toggle("on", A.thermal); if (A.thermal) tip("<b>Visão térmica</b>: o TQ-01 fica azul quando frio e vai para o vermelho conforme a temperatura sobe.", ""); };
    const LM = { compact: "🏷 Rótulos: compactos", full: "🏷 Rótulos: completos", off: "🏷 Rótulos: ocultos" }, ORDER = ["compact", "full", "off"];
    const setMode = m => { S.labelMode = m; wrap.classList.remove("lab-compact", "lab-full", "lab-off"); wrap.classList.add("lab-" + m); const b = $("#b3labels"); if (b) b.textContent = LM[m]; };
    setMode("compact");
    const bl = $("#b3labels"); if (bl) bl.onclick = () => setMode(ORDER[(ORDER.indexOf(S.labelMode) + 1) % 3]);

    new ResizeObserver(resize).observe(wrap);
    resize();
    $("#load3d").style.display = "none";
    renderTray();
    tip("Escolha uma peça na Bancada de Peças, leia a tag e toque na área azul onde ela deve ser instalada. Arraste para girar, use a roda ou dois dedos para aproximar.");
    const clock = new T.Clock();
    let acc = 0;
    function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (!wrap.offsetParent) return;
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
      if (ready("ln")) stepLevel(dt * 5);
      stepAnims(dt);
      acc += dt; if (acc > 0.25) { acc = 0; updateReadings(); }
      if (S.fx && S.composer) S.composer.render(); else renderer.render(scene, cam);
      lr.render(scene, cam);
      fpsN++; fpsT += dt;
      if (fpsT >= 1) { const fps = fpsN / fpsT; fpsN = 0; fpsT = 0; if (S.fx && fps < 24 && document.visibilityState === "visible") { S.slow = (S.slow || 0) + 1; if (S.slow >= 4) { S.fx = false; const b = $("#b3fx"); if (b) b.textContent = "⚡ Gráficos: leve"; tip("Este computador ficou lento com os gráficos realistas: troquei para o modo <b>leve</b>. Dá para voltar no botão ✨ Gráficos.", ""); } } else S.slow = 0; }
      dc += dt; if (dc > 0.15) { dc = 0; declutter(); }
    }
    let dc = 0, fpsN = 0, fpsT = 0;
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
    S.renderer.setSize(w, h); S.lr.setSize(w, h); S.cam.aspect = w / h; S.cam.updateProjectionMatrix();
    if (S.composer) { S.composer.setPixelRatio(S.renderer.getPixelRatio()); S.composer.setSize(w, h); }
  }
  function reset() {
    for (const tag in S.parts) { const g = S.parts[tag]; g.parent.remove(g); }
    for (const p of PARTS) { const l = S.labels[p.tag]; if (l) { l.obj.parent.remove(l.obj); l.el.remove(); delete S.labels[p.tag]; } }
    S.parts = {}; S.installed = {}; S.errors = 0; S.sel = null; S.done = {};
    for (const k of ["pitScreen", "pgNeedle", "tshLamp", "pshLamp", "lshLamp", "lslLamp", "fitScreen", "fvMark", "vyLamp", "litScreen", "lshPivot", "lslPivot"]) S[k] = null;
    for (const id in SLOTDEF) S.slots[id].ghost.visible = !SLOTDEF[id].req;
    Object.assign(S.proc, { T: 25, P: 0, run: false, stuck: false, trip: false, heat: false, ctrl: false });
    Object.assign(S.lvl, { L: 40, Q: 0, fv: 60, fvCmd: 60, pump: false, pumpOn: false, vy: false, trip: false, drain: false, litFail: false });
    if (window.PLC) window.PLC.reset();
    setWater(40); S.tzLamp.emissive.setHex(0); S.pumpLamp.emissive.setHex(0); S.k1Lamp.emissive.setHex(0); S.rotaFloat.position.y = 0.7;
    S.panelScreen.draw(["HMI", "aguardando"], "#1F2A37"); drawPlc();
    renderTray(); tip("Montagem reiniciada. Escolha uma peça na Bancada de Peças.");
  }

  const api = {
    setSp(v) { S.proc.sp = clamp(Math.round(+v || 60), 20, 95); const i = $("#b3sp"); if (i && document.activeElement !== i) i.value = S.proc.sp; updateReadings(); },
    setFlowSp(v) { S.lvl.spQ = clamp(Math.round((+v || 0) * 2) / 2, 0, 30); const i = $("#b4fq"); if (i && document.activeElement !== i) i.value = S.lvl.spQ; updateReadings(); },
    setValveReq(v) { S.lvl.av = clamp(Math.round(+v || 0), 0, 100); updateReadings(); },
    setBand(lo, hi) { const L = S.lvl; if (lo != null) L.spLo = clamp(Math.round(+lo), 5, 90); if (hi != null) L.spHi = clamp(Math.round(+hi), 10, 95); if (L.spHi <= L.spLo + 4) { if (hi != null) L.spLo = Math.max(5, L.spHi - 5); else L.spHi = Math.min(95, L.spLo + 5); } const a = $("#b4lo"), b = $("#b4hi"); if (a && document.activeElement !== a) a.value = L.spLo; if (b && document.activeElement !== b) b.value = L.spHi; updateReadings(); },
  };
  window.App3D = {
    setSp: (v) => api.setSp(v), setBand: (lo, hi) => api.setBand(lo, hi), setFlowSp: (v) => api.setFlowSp(v), setValveReq: (v) => api.setValveReq(v), showHud: (on) => setHud(on !== false),
    start(wrap) { if (!started) { started = true; init(wrap); } else { resize(); renderHud(); renderClp(); } },
    _state: S,
    refreshHud() { if (S.renderer) renderHud(); },
    _anim(dt) { stepAnims(dt); return A; },
    _clamp() { clampCam(); return S.cam.position.toArray().map(v => +v.toFixed(2)); },
    plant() { const L = S.lvl, P = S.proc; return { L: L.L, Q: L.Q, fv: L.fv, drain: L.drain, litFail: L.litFail, sp: P ? P.sp : 60, T: P ? P.T : 25, spLo: L.spLo, spHi: L.spHi, spQ: L.spQ, av: L.av, fvCmd: L.fvCmd, fv: L.fv, Pbar: P ? P.P : 0, tq: ready("tq"), ln: ready("ln"), wired: !!window.__ttWired }; },
    setDrain(v) { S.lvl.drain = !!v; renderHud(); },
    setFv(v) { S.lvl.fvCmd = clamp(+v || 0, 0, 100); updateReadings(); },
    setLitFail(v) { S.lvl.litFail = !!v; if (v) tip("<b>LIT-101 travado em 10%</b>: o CLP acha que o tanque está quase vazio. Se o programa não usar o LSH-101 (X1), o tanque transborda.", "bad"); },
    ready: () => ready("ln"),
    autoInstall() { for (const p of PARTS) if (p.slot && !S.installed[p.tag]) { S.sel = p.tag; install(p, p.slot); const a = S.parts[p.tag].userData.anim; a.t = 1; S.parts[p.tag].position.copy(a.to); } },
    _tick(dt) { if (ready("tq") || ready("ln")) plcCycle(dt); if (ready("tq")) stepProc(dt); if (ready("ln")) stepLevel(dt); updateReadings(); },
  };
})();
