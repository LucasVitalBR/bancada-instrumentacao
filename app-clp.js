/* CLP Delta DVP-SX2 (simulado) · editor de ladder + varredura
   Contatos NA/NF, OUT, SET, RST, CMP e MOV. Duas linhas em paralelo por rede.
   Endereços e escalas conferidos no manual do DVP-SX2:
   AI CH1 = D1111 (TT-104), 4-20 mA -> 0..2000;
   AO CH0 = D1116 (referencia de velocidade do inversor), 4-20 mA -> 0..4000 (= 0..60 Hz);
   modo 4–20 mA ligado em D1115 = H1F1F (K7967). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const NS = 6, RAW = 2000, RAO = 4000, D1115_OK = 7967, KEY = "nivel-clp-programa-v1";
  const SYM = {
    X0: "LSL-101 · nível baixo", X1: "LSH-101 · nível alto", X2: "Botão LIGA", X3: "Botão DESLIGA (NF)", X4: "Seletora AUTO",
    X5: "TSH-104 · temperatura alta", X6: "Chave seletora da resistência (porta do painel)", X7: "Falha do inversor (relé)",
    M1011: "clock 10 ms", M1012: "clock 100 ms", M1013: "clock 1 s",
    D222: "Referência de velocidade pedida (painel)",
    Y0: "Bomba (marcha do inversor)", Y1: "VY-01 · solenoide", Y2: "Lâmpada de alarme", Y3: "Sinaleiro bomba ligada", Y4: "Resistência TZ-104 (contator K2)",
    M1000: "sempre ON em RUN", M1002: "pulso no 1º scan", D1111: "AI CH1 · TT-104", D1116: "AO CH0 · referência de velocidade do inversor (4000 = 60 Hz)", D1115: "modo das E/S analógicas (H1F1F = 4–20 mA)",
    D200: "SP de temperatura (painel)",
  };
  const io = { X: new Array(8).fill(false), Y: new Array(6).fill(false), M: {}, D: { 1116: 0 }, btn: { X2: false, X3: false, X4: false } };
  const PLC = { io, run: false, firstScan: false, rt: [], tool: "NO", errors: {}, program: null, t: 0, edge: {} };
  window.PLC = PLC;

  /* ---------- endereços ---------- */
  function parseBit(a) {
    const m = /^([XYM])(\d+)$/.exec(String(a || "").toUpperCase()); if (!m) return null;
    const n = +m[2];
    if (m[1] === "X" && n > 7) return null; if (m[1] === "Y" && n > 5) return null; if (m[1] === "M" && n > 4095) return null;
    return { t: m[1], n };
  }
  const isK = s => /^K-?\d+$/.test(s), isD = s => /^D\d+$/.test(s);
  function getBit(a) { const p = parseBit(a); if (!p) return false; if (p.t === "X") return io.X[p.n]; if (p.t === "Y") return io.Y[p.n]; if (p.n === 1000) return PLC.run; if (p.n === 1002) return PLC.firstScan; const ck = { 1011: 0.01, 1012: 0.1, 1013: 1 }[p.n]; if (ck) return Math.floor(PLC.t / (ck / 2)) % 2 === 0; return !!io.M[p.n]; }
  function setBit(a, v) { const p = parseBit(a); if (!p || p.t === "X") return; if (p.t === "Y") io.Y[p.n] = v; else if (![1000, 1002, 1011, 1012, 1013].includes(p.n)) io.M[p.n] = v; }
  function val(s) { if (isK(s)) return +s.slice(1); if (isD(s)) return io.D[+s.slice(1)] || 0; return 0; }
  const nextBit = (a, k) => { const p = parseBit(a); return p.t + (p.n + k); };

  function checkEl(el, kind) {
    if (!el) return "";
    const up = s => String(s || "").toUpperCase();
    if (el.op === "NO" || el.op === "NC" || el.op === "PU") return parseBit(el.addr) ? "" : `contato com endereço inválido (${el.addr || "vazio"})`;
    if (el.op === "OUT" || el.op === "SET" || el.op === "RST") {
      const p = parseBit(el.addr); if (!p) return `${el.op} com endereço inválido (${el.addr || "vazio"})`;
      if (p.t === "X") return `${el.op} não pode escrever numa entrada (${up(el.addr)})`;
      if (p.t === "M" && [1000, 1002, 1011, 1012, 1013].includes(p.n)) return `${up(el.addr)} é relé especial, só leitura`;
      return "";
    }
    if (el.op === "CMP") {
      if (!(isK(el.s1) || isD(el.s1))) return `CMP: S1 deve ser K (constante) ou D (registrador)`;
      if (!(isK(el.s2) || isD(el.s2))) return `CMP: S2 deve ser K (constante) ou D (registrador)`;
      const p = parseBit(el.d); if (!p || p.t === "X") return `CMP: D deve ser M ou Y (usa D, D+1 e D+2)`;
      if (!parseBit(nextBit(el.d, 2))) return `CMP: ${up(el.d)}+2 passa do limite`;
      return "";
    }
    const wr = (d, op) => { if (!isD(d)) return `${op}: o destino deve ser um registrador D`; if (["D1111"].includes(d)) return `${op}: ${d} é entrada analógica, só leitura`; if (["D200", "D222"].includes(d)) return `${op}: ${d} é ajustado pelo painel (setpoint). Use outro D.`; return ""; };
    if (el.op === "MOV") {
      if (!(isK(el.s) || isD(el.s))) return "MOV: S deve ser K ou D";
      return wr(el.d, "MOV");
    }
    if (["ADD", "SUB", "MUL", "DIV"].includes(el.op)) {
      if (!(isK(el.s1) || isD(el.s1))) return `${el.op}: S1 deve ser K ou D`;
      if (!(isK(el.s2) || isD(el.s2))) return `${el.op}: S2 deve ser K ou D`;
      if (el.op === "DIV" && el.s2 === "K0") return "DIV: divisão por zero";
      return wr(el.d, el.op);
    }
    return "elemento desconhecido";
  }
  function validate() {
    PLC.errors = {};
    PLC.program.rungs.forEach((r, i) => {
      const e = [];
      [...r.a, ...(r.b || [])].forEach(c => { const m = checkEl(c); if (m) e.push(m); });
      if (!r.out) e.push("rede sem saída: coloque uma bobina ou um bloco à direita");
      else { const m = checkEl(r.out); if (m) e.push(m); }
      if (r.b && !r.b.some(Boolean)) e.push("linha paralela vazia: coloque um contato ou remova o paralelo");
      if (e.length) PLC.errors[i] = e;
    });
    return Object.keys(PLC.errors).length === 0;
  }
  PLC.aoUsed = () => PLC.program.rungs.some((r, i) => !PLC.errors[i] && r.out && ["MOV", "ADD", "SUB", "MUL", "DIV"].includes(r.out.op) && r.out.d === "D1116");

  /* ---------- varredura ---------- */
  function evalLine(cells, emptyConducts, key) {
    let pw = true, any = false; const steps = [];
    cells.forEach((c, i) => {
      if (c) {
        any = true; const v = getBit(c.addr); let pass;
        if (c.op === "PU") { const k = key + i, prev = !!PLC.edge[k]; PLC.edge[k] = v; pass = v && !prev; }
        else pass = c.op === "NO" ? v : !v;
        pw = pw && pass; steps.push({ pw, pass });
      } else steps.push({ pw });
    });
    if (!any && !emptyConducts) pw = false;
    return { p: pw, steps };
  }
  function exec(o, p) {
    if (o.op === "OUT") setBit(o.addr, p);
    else if (o.op === "SET") { if (p) setBit(o.addr, true); }
    else if (o.op === "RST") { if (p) setBit(o.addr, false); }
    else if (o.op === "CMP") { if (p) { const a = val(o.s1), b = val(o.s2); setBit(o.d, a > b); setBit(nextBit(o.d, 1), a === b); setBit(nextBit(o.d, 2), a < b); } }
    else if (o.op === "MOV") { if (p) io.D[+o.d.slice(1)] = val(o.s); }
    else if (["ADD", "SUB", "MUL", "DIV"].includes(o.op)) {
      if (!p) return;
      const a = val(o.s1), b = val(o.s2);
      let v = o.op === "ADD" ? a + b : o.op === "SUB" ? a - b : o.op === "MUL" ? a * b : (b === 0 ? 0 : Math.trunc(a / b));
      io.D[+o.d.slice(1)] = Math.max(-32768, Math.min(32767, v));
    }
  }
  PLC.scan = function (dt) {
    PLC.t += dt || 0.05;
    io.X[2] = io.btn.X2; io.X[3] = !io.btn.X3; io.X[4] = io.btn.X4; io.X[6] = !!io.btn.X6;
    if (!PLC.run) { io.Y.fill(false); PLC.rt = []; return; }
    PLC.rt = PLC.program.rungs.map((r, i) => {
      if (PLC.errors[i]) return null;
      const la = evalLine(r.a, true, i + "a"), lb = r.b ? evalLine(r.b, false, i + "b") : { p: false, steps: [] };
      const p = la.p || lb.p;
      if (r.out) exec(r.out, p);
      return { a: la.steps, b: lb.steps, pa: la.p, pb: lb.p, p };
    });
    PLC.firstScan = false;
  };
  PLC.setRun = function (on) {
    if (on && !validate()) { render(); msg(`<b>Programa com erro.</b> Corrija as redes marcadas em vermelho antes de colocar em RUN.`, "bad"); return; }
    PLC.run = on;
    if (on) { io.M = {}; io.Y.fill(false); PLC.firstScan = true; msg("CLP em <b>RUN</b>: o programa está comandando a bancada. Você pode editar com o CLP rodando.", "ok"); }
    else { io.Y.fill(false); PLC.rt = []; msg("CLP em <b>STOP</b>: todas as saídas desligadas. A bancada volta para o comando local.", ""); }
    render(); refreshIO();
    if (window.App3D && window.App3D.refreshHud) window.App3D.refreshHud();
  };
  PLC.reset = function () { PLC.run = false; io.M = {}; io.Y.fill(false); io.D[1116] = 0; io.btn = { X2: false, X3: false, X4: false }; PLC.rt = []; render(); refreshIO(); };

  /* ---------- programas ---------- */
  const c = (op, addr) => ({ op, addr });
  const pad = a => { const r = a.slice(0, NS); while (r.length < NS) r.push(null); return r; };
  const R = (a, out, b, cm) => ({ a: pad(a), b: b ? pad(b) : null, out, cm: cm || "" });
  const M0 = () => c("NO", "M1000");
  const vel = k => R([M0()], { op: "MOV", s: "K" + k, d: "D1116" }, null, "referência de velocidade pelo inversor: K4000 = 100 % (60 Hz)");
  const bomba = (k = 4000) => [
    R([c("NO", "X4"), c("NC", "X1"), c("NC", "X7")], { op: "OUT", addr: "Y0" }, null, "AUTO liga o inversor (marcha); LSH-101 (X1, NF) e falha do inversor (X7, NF) desligam"),
    R([c("NO", "Y0")], { op: "OUT", addr: "Y1" }, null, "a solenoide VY-01 abre junto com a bomba"),
    R([c("NO", "Y0")], { op: "OUT", addr: "Y3" }, null, "sinaleiro de bomba ligada"),
    vel(k),
  ];
  const nivel = () => [
    R([c("NO", "X0")], { op: "SET", addr: "M0" }, null, "LSL-101 (boia baixa) atuou: pede para encher"),
    R([c("NO", "X1")], { op: "RST", addr: "M0" }, null, "LSH-101 (boia alta) atuou: para de encher"),
    R([c("NO", "X4"), c("NO", "M0"), c("NC", "X1"), c("NC", "X7")], { op: "OUT", addr: "Y0" }, null, "inversor em marcha: AUTO · pedido · LSH (NF) · sem falha"),
    R([c("NO", "Y0")], { op: "OUT", addr: "Y1" }, null, "VY-01 abre com a bomba"),
    R([c("NO", "Y0")], { op: "OUT", addr: "Y3" }, null, "sinaleiro"),
    R([c("NO", "X0")], { op: "OUT", addr: "Y2" }, null, "alarme de nível baixo (LSL-101)"),
    vel(4000),
  ];
  const temperatura = () => [
    R([M0()], { op: "CMP", s1: "D200", s2: "D1111", d: "M30" }, null, "M30 = temperatura abaixo do setpoint (D200)"),
    R([c("NO", "X6"), c("NO", "M30"), c("NC", "X5")], { op: "OUT", addr: "Y4" }, null, "resistência: chave seletora (X6) · frio · TSH-104 (NF)"),
    R([c("NO", "X5")], { op: "OUT", addr: "Y2" }, null, "alarme de temperatura alta (TSH-104)"),
  ];
  const limita = (d, mn, mx, m) => [
    R([M0()], { op: "CMP", s1: d, s2: "K" + mx, d: m }, null, "verifica se passou de 100 %"),
    R([c("NO", m)], { op: "MOV", s: "K" + mx, d }, null, "limite superior (100 %)"),
    R([M0()], { op: "CMP", s1: d, s2: "K" + mn, d: "M" + (+m.slice(1) + 10) }, null, "verifica se ficou abaixo de 0 %"),
    R([c("NO", "M" + (+m.slice(1) + 12))], { op: "MOV", s: "K" + mn, d }, null, "limite inferior (0 %)"),
  ];
  const velFixa = () => bomba(2400);
  const velPainel = () => [...bomba().slice(0, 3), R([M0()], { op: "MOV", s: "D222", d: "D1116" }, null, "referência de velocidade = valor pedido no painel (D222)")];
  const rampa = () => [
    ...bomba().slice(0, 3),
    R([c("NO", "Y0")], { op: "MOV", s: "K4000", d: "D1116" }, null, "referência 100 % enquanto a bomba roda (ajuste a rampa no painel do inversor)"),
    R([c("NC", "Y0")], { op: "MOV", s: "K0", d: "D1116" }, null, "referência 0 com a bomba parada"),
  ];
  const EX = {
    nivel: { t: "Nível · liga/desliga pelas boias (LSL/LSH)", d: "RUN + AUTO (X4). A LSL liga o enchimento e a LSH desliga. Abra o dreno para ver os ciclos.", f: nivel },
    temperatura: { t: "Temperatura · liga/desliga com intertravamento", d: "Ligue o TT-104 (aba Ligação do PT100), coloque em RUN, gire a seletora da resistência na porta do painel (X6) e mude o setpoint D200.", f: temperatura },
    velFixa: { t: "Inversor · velocidade fixa (60 %)", d: "RUN + AUTO. O inversor parte pelo Y0 e a referência é fixa em K2400 (60 % = 36 Hz): a vazão cai em relação aos 60 Hz.", f: velFixa },
    velPainel: { t: "Inversor · velocidade pelo painel (D222)", d: "RUN + AUTO. Mude a referência de velocidade no painel (D222): a rotação, a corrente e a vazão acompanham, com a rampa do inversor.", f: velPainel },
    rampa: { t: "Inversor · rampa de aceleração e desaceleração", d: "RUN + AUTO. Com o AUTO ligado a referência vai a 100 %; ao desligar, a bomba desacelera pela rampa. Mude a rampa no painel do inversor.", f: rampa },
    completa: { t: "Bancada completa · nível + velocidade + temperatura", d: "RUN + AUTO (X4) + seletora da resistência (X6). Nível pelas boias com o inversor em 100 %, temperatura pelo comparador com TSH-104 protegendo.", f: () => [...nivel(), ...temperatura().slice(0, 2)] },
    selo: { t: "Partida com selo · LIGA/DESLIGA", d: "Em RUN, aperte LIGA (X2) e DESLIGA (X3). O LSH-101 (X1) também desliga.", f: () => [
      R([c("NO", "X2"), c("NO", "X3"), c("NC", "X1"), c("NC", "X7")], { op: "OUT", addr: "Y0" }, [c("NO", "Y0"), c("NO", "X3"), c("NC", "X1"), c("NC", "X7")], "selo: (LIGA ou Y0) · DESLIGA (NF) · LSH (NF) · falha do inversor (NF)"),
      vel(4000),
      R([c("NO", "Y0")], { op: "OUT", addr: "Y1" }, null, "VY-01"), R([c("NO", "Y0")], { op: "OUT", addr: "Y3" }, null, "sinaleiro"), R([c("NO", "X0")], { op: "OUT", addr: "Y2" }, null, "alarme de nível baixo")] },
    vazio: { t: "Programa vazio", d: "", f: () => [R([], null)] },
  };
  // 1º scan: D1115 = H1F1F (K7967) → AD0–AD3 e DA0 em corrente, faixa 4–20 mA
  const cfg = () => R([c("NO", "M1002")], { op: "MOV", s: "K" + D1115_OK, d: "D1115" }, null, "1º scan: D1115 = H1F1F → entradas CH0–CH3 e saída CH0 em 4–20 mA");
  ["nivel", "temperatura", "velFixa", "velPainel", "rampa", "completa"].forEach(k => { const f0 = EX[k].f; EX[k].f = () => [cfg(), ...f0()]; });
  PLC.examples = EX;
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) { const p = JSON.parse(s); if (p && Array.isArray(p.rungs)) { p.rungs.forEach(r => { r.a = pad(r.a || []); if (r.b) r.b = pad(r.b); }); return p; } } } catch (e) { }
    return { rungs: EX.vazio.f() };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(PLC.program)); } catch (e) { } }
  PLC.program = load();
  validate();

  /* ---------- desenho do ladder ---------- */
  const CX = i => 82 + i * 64, JX = 452, OX = 474, OW = 238, RR = 742;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  function wire(x1, x2, y, on) { return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="w${on ? " on" : ""}"/>`; }
  const SHORT = { X0: "LSL-101", X1: "LSH-101", X2: "LIGA", X3: "DESLIGA", X4: "AUTO", X5: "TSH-104", X7: "falha inv.", M1012: "clock 100ms", M1013: "clock 1s", Y0: "bomba", Y1: "VY-01", Y2: "alarme", Y3: "sinaleiro", Y4: "resistência", M1000: "sempre ON", M1002: "1º scan" };
  // unidade de engenharia de um operando: temperatura (10 contagens = 1 °C) ou nível (20 contagens = 1 %)
  const unitOf = (a, b) => { const t = [a, b].map(x => String(x).toUpperCase()); if (t.some(x => x === "D1111" || x === "D200")) return "T"; if (t.some(x => x === "D1110" || x === "D210" || x === "D211")) return "L"; if (t.some(x => x === "D1116" || x === "D222" || x === "D12" || x === "D14")) return "V"; return null; };
  const eng = (v, u) => u === "T" ? (v / 10).toFixed(1).replace(".", ",") + " °C" : u === "L" ? Math.round(v / 20) + " %" : u === "V" ? Math.round(v / 40) + " % · " + (v * 60 / 4000).toFixed(1).replace(".", ",") + " Hz" : "";
  function symb(a) { return SYM[String(a).toUpperCase()] || ""; }
  function lineSVG(cells, y, ri, ln, steps, run) {
    let s = wire(14, CX(0) - 32, y, run);
    cells.forEach((el, i) => {
      const inP = run && (i === 0 ? true : steps && steps[i - 1] && steps[i - 1].pw);
      const outP = run && steps && steps[i] && steps[i].pw;
      const x = CX(i);
      if (!el) s += wire(x - 32, x + 32, y, inP);
      else {
        const v = run && getBit(el.addr), pass = steps && steps[i] && steps[i].pass !== undefined ? run && steps[i].pass : (el.op === "NC" ? !v : v);
        s += wire(x - 32, x - 10, y, inP) + wire(x + 10, x + 32, y, outP);
        const col = run && pass ? "#2E8B7A" : "#1E3A5F";
        s += `<rect x="${x - 9}" y="${y - 15}" width="18" height="30" fill="${run && pass ? "rgba(46,139,122,.16)" : "#FBFCFE"}"/>`;
        s += `<line x1="${x - 10}" y1="${y - 15}" x2="${x - 10}" y2="${y + 15}" stroke="${col}" stroke-width="3.5"/><line x1="${x + 10}" y1="${y - 15}" x2="${x + 10}" y2="${y + 15}" stroke="${col}" stroke-width="3.5"/>`;
        if (el.op === "NC") s += `<line x1="${x - 8}" y1="${y + 13}" x2="${x + 8}" y2="${y - 13}" stroke="${col}" stroke-width="2.5"/>`;
        if (el.op === "PU") s += `<path d="M${x} ${y + 10} L${x} ${y - 9} M${x - 5} ${y - 3} L${x} ${y - 10} L${x + 5} ${y - 3}" stroke="${col}" stroke-width="2.5" fill="none"/>`;
        s += `<text x="${x}" y="${y - 21}" text-anchor="middle" class="la">${esc(String(el.addr).toUpperCase())}</text>`;
        const sy = SHORT[String(el.addr).toUpperCase()]; if (sy) s += `<text x="${x}" y="${y + 30}" text-anchor="middle" class="ls">${esc(sy)}</text>`;
      }
      s += `<rect class="slot" x="${x - 30}" y="${y - 30}" width="60" height="60" rx="8" data-r="${ri}" data-l="${ln}" data-i="${i}"/>`;
    });
    const endP = run && steps && steps[NS - 1] && steps[NS - 1].pw;
    s += wire(CX(NS - 1) + 32, JX, y, endP);
    return s;
  }
  function outSVG(o, y, ri, p, run) {
    let s = "";
    const cx = OX + 40;
    if (!o) {
      s += `<rect x="${OX}" y="${y - 20}" width="${OW}" height="40" rx="8" fill="none" stroke="#C3CCD8" stroke-dasharray="6 5"/><text x="${OX + OW / 2}" y="${y + 5}" text-anchor="middle" class="ls">saída: bobina ou bloco</text>`;
    } else if (o.op === "OUT" || o.op === "SET" || o.op === "RST") {
      const on = run && getBit(o.addr), col = on ? "#E87722" : "#1E3A5F";
      s += wire(OX, cx - 14, y, run && p) + wire(cx + 14, OX + OW, y, false);
      if (on) s += `<circle cx="${cx}" cy="${y}" r="11" fill="#E87722" opacity=".25"/>`;
      s += `<path d="M${cx - 8} ${y - 15} Q${cx - 18} ${y} ${cx - 8} ${y + 15}" fill="none" stroke="${col}" stroke-width="3.5"/><path d="M${cx + 8} ${y - 15} Q${cx + 18} ${y} ${cx + 8} ${y + 15}" fill="none" stroke="${col}" stroke-width="3.5"/>`;
      if (o.op !== "OUT") s += `<text x="${cx}" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="${col}">${o.op[0]}</text>`;
      s += `<text x="${cx}" y="${y - 21}" text-anchor="middle" class="la">${esc(String(o.addr).toUpperCase())}</text>`;
      s += `<text x="${cx + 30}" y="${y + 5}" class="ls">${o.op === "OUT" ? "" : o.op + " · "}${esc(symb(o.addr))}</text>`;
    } else {
      const parts = o.op === "MOV" ? [o.op, o.s, o.d] : [o.op, o.s1, o.s2, o.d];
      s += `<rect x="${OX}" y="${y - 20}" width="${OW}" height="40" rx="6" fill="${run && p ? "#E3F3EF" : "#fff"}" stroke="${run && p ? "#2E8B7A" : "#1E3A5F"}" stroke-width="2.5"/>`;
      parts.forEach((t, k) => { s += `<text x="${OX + 12 + k * (OW - 18) / parts.length}" y="${y + 6}" class="lb">${esc(String(t).toUpperCase())}</text>`; });
      if (run) {
        if (o.op === "CMP") { const u = unitOf(o.s1, o.s2), e1 = u ? ` (${eng(val(o.s1), u)})` : "", e2 = u ? ` (${eng(val(o.s2), u)})` : ""; s += `<text x="${OX}" y="${y + 34}" class="lv">S1=${val(o.s1)}${e1} · S2=${val(o.s2)}${e2} → ${esc(nextBit(o.d, 0))}=${+getBit(o.d)} ${esc(nextBit(o.d, 2))}=${+getBit(nextBit(o.d, 2))}</text>`; }
        else { const u = unitOf(o.d, o.op === "MOV" ? o.s : o.s1); s += `<text x="${OX}" y="${y + 34}" class="lv">${esc(o.d)} = ${val(o.d)}${u ? " (" + eng(val(o.d), u) + ")" : ""}</text>`; }
      }
    }
    s += `<rect class="slot" x="${OX - 4}" y="${y - 30}" width="${OW + 8}" height="60" rx="8" data-r="${ri}" data-l="o" data-i="0"/>`;
    return s;
  }
  function rungHTML(r, i) {
    const rt = PLC.run ? PLC.rt[i] : null, run = !!rt;
    const H = r.b ? 156 : 88, ya = 48, yb = 120;
    let s = `<line x1="14" y1="6" x2="14" y2="${H - 6}" class="rail"/><line x1="${RR}" y1="6" x2="${RR}" y2="${H - 6}" class="rail"/>`;
    s += lineSVG(r.a, ya, i, "a", rt && rt.a, run);
    if (r.b) { s += lineSVG(r.b, yb, i, "b", rt && rt.b, run) + `<line x1="${JX}" y1="${yb}" x2="${JX}" y2="${ya}" class="w${run && rt.pb ? " on" : ""}"/>`; }
    s += wire(JX, OX, ya, run && rt.p);
    s += outSVG(r.out, ya, i, run && rt.p, run);
    s += wire(OX + OW, RR, ya, false);
    const err = PLC.errors[i];
    return `<div class="rung${err ? " err" : ""}"><div class="rhead"><span><b>Rede ${i + 1}</b>${r.cm ? ` · <span class="rcm">${esc(r.cm)}</span>` : ""}${err ? ` · <span class="rerr">${esc(err[0])}</span>` : ""}</span><span class="rbtns">
      <button data-act="branch" data-r="${i}" title="Linha em paralelo (OU)">${r.b ? "− paralelo" : "+ paralelo"}</button><button data-act="up" data-r="${i}" title="Subir">↑</button><button data-act="down" data-r="${i}" title="Descer">↓</button><button data-act="del" data-r="${i}" title="Apagar rede">✕</button></span></div>
      <svg viewBox="0 0 760 ${H}" style="min-width:600px">${s}</svg></div>`;
  }
  function render() {
    const host = $("#ldEditor"); if (!host) return;
    host.innerHTML = PLC.program.rungs.map(rungHTML).join("") + `<button class="btn" data-act="add" style="margin-top:4px">+ Nova rede</button>`;
    document.querySelectorAll("#ldPal [data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === PLC.tool));
    const rb = $("#plcRun"); if (rb) { rb.textContent = PLC.run ? "■ STOP" : "▶ RUN"; rb.classList.toggle("on", PLC.run); }
  }
  function msg(h, kind) { const m = $("#ldMsg"); if (m) { m.className = "msg " + (kind || "neu"); m.innerHTML = h; } }

  /* ---------- edição ---------- */
  const CONTACT = ["NO", "NC", "PU"], OUTS = ["OUT", "SET", "RST", "CMP", "MOV", "ADD", "SUB", "MUL", "DIV"];
  const DEF = { NO: { op: "NO", addr: "X0" }, NC: { op: "NC", addr: "X1" }, PU: { op: "PU", addr: "M1012" }, OUT: { op: "OUT", addr: "Y0" }, SET: { op: "SET", addr: "M0" }, RST: { op: "RST", addr: "M0" }, CMP: { op: "CMP", s1: "K600", s2: "D1111", d: "M10" }, MOV: { op: "MOV", s: "K2400", d: "D1116" },
    ADD: { op: "ADD", s1: "D10", s2: "K1000", d: "D14" }, SUB: { op: "SUB", s1: "D222", s2: "D1111", d: "D10" }, MUL: { op: "MUL", s1: "D10", s2: "K2", d: "D12" }, DIV: { op: "DIV", s1: "D10", s2: "K2", d: "D12" } };
  function changed() { validate(); save(); render(); }
  function onEditorClick(e) {
    const act = e.target.closest("[data-act]");
    if (act) {
      const i = +act.dataset.r, R0 = PLC.program.rungs;
      if (act.dataset.act === "add") R0.push(R([], null));
      else if (act.dataset.act === "del") { R0.splice(i, 1); if (!R0.length) R0.push(R([], null)); }
      else if (act.dataset.act === "branch") R0[i].b = R0[i].b ? null : pad([]);
      else if (act.dataset.act === "up" && i > 0) [R0[i - 1], R0[i]] = [R0[i], R0[i - 1]];
      else if (act.dataset.act === "down" && i < R0.length - 1) [R0[i + 1], R0[i]] = [R0[i], R0[i + 1]];
      changed(); return;
    }
    const sl = e.target.closest(".slot"); if (!sl) return;
    const ri = +sl.dataset.r, ln = sl.dataset.l, ix = +sl.dataset.i, r = PLC.program.rungs[ri];
    const cur = ln === "o" ? r.out : r[ln][ix];
    const t = PLC.tool;
    const put = el => { if (ln === "o") r.out = el; else r[ln][ix] = el; };
    if (t === "DEL") { put(null); changed(); return; }
    if (t === "SEL") { if (cur) openPop(ri, ln, ix, e); else msg("Escolha uma ferramenta na paleta: contatos vão nas células da esquerda; bobinas e blocos, na saída à direita.", "warn"); return; }
    if (CONTACT.includes(t)) {
      if (ln === "o") { msg("Contatos ficam nas células da esquerda. Na saída (direita) vão OUT, SET, RST, CMP ou MOV.", "warn"); return; }
      put(Object.assign({}, cur && CONTACT.includes(cur.op) ? { addr: cur.addr } : DEF[t], { op: t })); changed(); openPop(ri, ln, ix, e); return;
    }
    if (OUTS.includes(t)) {
      if (ln !== "o") { msg(`${t} é instrução de saída: coloque na área da direita da rede.`, "warn"); return; }
      const keep = cur && ["OUT", "SET", "RST"].includes(cur.op) && ["OUT", "SET", "RST"].includes(t) ? { addr: cur.addr } : {};
      put(Object.assign({}, DEF[t], keep, { op: t })); changed(); openPop(ri, ln, ix, e); return;
    }
  }
  let pop = null;
  function openPop(ri, ln, ix, e) {
    closePop();
    const r = PLC.program.rungs[ri], el = ln === "o" ? r.out : r[ln][ix]; if (!el) return;
    const fields = el.op === "CMP" ? [["s1", "S1 (K ou D)"], ["s2", "S2 (K ou D)"], ["d", "D (bit: usa D, D+1, D+2)"]] : el.op === "MOV" ? [["s", "Origem S (K ou D)"], ["d", "Destino D"]] : ["ADD", "SUB", "MUL", "DIV"].includes(el.op) ? [["s1", "S1 (K ou D)"], ["s2", "S2 (K ou D)"], ["d", "Resultado D"]] : [["addr", "Endereço"]];
    const title = { NO: "Contato NA", NC: "Contato NF", OUT: "Bobina OUT", SET: "SET (liga e mantém)", RST: "RST (desliga)", CMP: "CMP · comparador", MOV: "MOV · mover valor", PU: "Contato de pulso ↑ (LDP)", ADD: "ADD · soma (D = S1 + S2)", SUB: "SUB · subtração (D = S1 − S2)", MUL: "MUL · multiplicação (D = S1 × S2)", DIV: "DIV · divisão (D = S1 ÷ S2)" }[el.op];
    pop = document.createElement("div"); pop.className = "ldpop";
    pop.innerHTML = `<b>${title}</b>${fields.map(([k, l]) => `<label class="f" style="margin-top:8px">${l}<input type="text" list="ldAddrs" data-k="${k}" value="${esc(el[k] || "")}" style="text-transform:uppercase;font-family:'Courier New',monospace;font-weight:700"></label>`).join("")}
      ${el.op === "CMP" || el.op === "MOV" || ["ADD", "SUB", "MUL", "DIV"].includes(el.op) ? '<div class="small" style="margin-top:8px;color:var(--muted)">Escala: temperatura <b>10 contagens = 1 °C</b> (K600 = 60 °C, D1111 = TT-104, D200 = SP do painel). Velocidade do inversor <b>4000 = 100 % = 60 Hz</b> (D1116 = saída analógica, D222 = pedido do painel). Modo 4–20 mA: <b>MOV K7967 D1115</b> no 1º scan (M1002).</div>' : ""}
      <div class="small" id="popErr" style="color:var(--red);min-height:16px;margin-top:6px"></div>
      <div class="row" style="margin-top:4px"><button class="btn pri" data-p="ok">OK</button><button class="btn danger" data-p="del">Apagar</button><button class="btn" data-p="x">Cancelar</button></div>`;
    document.body.appendChild(pop);
    const W = 270, x = Math.min(window.innerWidth - W - 10, Math.max(10, e.clientX - W / 2)), y = Math.min(window.innerHeight - pop.offsetHeight - 10, e.clientY + 18);
    pop.style.left = x + "px"; pop.style.top = Math.max(10, y) + "px";
    const inp = pop.querySelectorAll("input"); inp[0].focus(); inp[0].select();
    const ok = () => {
      const tmp = Object.assign({}, el); inp.forEach(i => tmp[i.dataset.k] = i.value.trim().toUpperCase());
      const m = checkEl(tmp); if (m) { pop.querySelector("#popErr").textContent = m; return; }
      Object.assign(el, tmp); closePop(); changed();
      const hint = el.addr && symb(el.addr) ? ` (${symb(el.addr)})` : ""; msg(`Rede ${ri + 1} atualizada${hint}.`, "");
    };
    pop.addEventListener("keydown", ev => { if (ev.key === "Enter") ok(); if (ev.key === "Escape") closePop(); });
    pop.querySelector('[data-p="ok"]').onclick = ok;
    pop.querySelector('[data-p="x"]').onclick = closePop;
    pop.querySelector('[data-p="del"]').onclick = () => { if (ln === "o") r.out = null; else r[ln][ix] = null; closePop(); changed(); };
  }
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener("pointerdown", e => { if (pop && !pop.contains(e.target) && !e.target.closest(".slot")) closePop(); });

  /* ---------- painel de operação e E/S ---------- */
  function refreshIO() {
    const t = $("#plcIO"); if (!t) return;
    const A = window.App3D, pl = A && A.plant ? A.plant() : null;
    const b = v => v ? `<span class="pill ok">1</span>` : `<span class="pill neu">0</span>`;
    const used = new Set();
    PLC.program.rungs.forEach(r => { [...r.a, ...(r.b || [])].forEach(c => c && /^M/i.test(c.addr) && used.add(c.addr.toUpperCase())); const o = r.out; if (o) { if (o.addr && /^M/i.test(o.addr)) used.add(o.addr.toUpperCase()); if (o.op === "CMP" && parseBit(o.d) && parseBit(o.d).t === "M") [0, 1, 2].forEach(k => used.add(nextBit(o.d.toUpperCase(), k))); } });
    used.delete("M1000"); used.delete("M1002");
    const ms = [...used].sort((a, b) => +a.slice(1) - +b.slice(1)).slice(0, 12);
    t.innerHTML = `<tr><th>Endereço</th><th>Ligado a</th><th>Valor</th></tr>`
      + [0, 1, 2, 3, 4, 5, 6, 7].map(n => `<tr><td><b>X${n}</b></td><td>${SYM["X" + n]}</td><td>${b(io.X[n])}</td></tr>`).join("")
      + [0, 1, 2, 3, 4].map(n => `<tr><td><b>Y${n}</b></td><td>${SYM["Y" + n]}</td><td>${b(io.Y[n])}</td></tr>`).join("")
      + `<tr><td><b>D1111</b></td><td>${SYM.D1111}${pl && !pl.wired ? " <span class='pill bad'>sem ligação</span>" : ""}</td><td><b>${io.D[1111] || 0}</b> <span class="note">(${((io.D[1111] || 0) / 10).toFixed(1).replace(".", ",")} °C)</span></td></tr>`
      + `<tr><td><b>D222</b></td><td>${SYM.D222}</td><td>${io.D[222] || 0} <span class="note">(${Math.round((io.D[222] || 0) / 40)} %)</span></td></tr>`
      + `<tr><td><b>D200</b></td><td>${SYM.D200}</td><td>${io.D[200] || 0} <span class="note">(${((io.D[200] || 0) / 10).toFixed(0)} °C)</span></td></tr>`
      + `<tr><td><b>D1116</b></td><td>${SYM.D1116}${PLC.aoUsed() ? "" : " <span class='note'>(sem MOV: referência manual)</span>"}</td><td>${io.D[1116] || 0} <span class="note">(${Math.round((io.D[1116] || 0) / 40)} % · ${(4 + 16 * (io.D[1116] || 0) / RAO).toFixed(2).replace(".", ",")} mA)</span></td></tr>`
      + `<tr><td><b>D1115</b></td><td>${SYM.D1115}</td><td>${io.D[1115] || 0}${(io.D[1115] || 0) === D1115_OK ? " <span class='pill ok'>4–20 mA</span>" : " <span class='pill bad'>não configurado</span> <span class='note'>no CLP real as E/S ficariam em tensão</span>"}</td></tr>`
      + (ms.length ? `<tr><td colspan="3" class="note" style="padding-top:10px">Relés auxiliares usados no programa</td></tr>` + ms.map(m => `<tr><td><b>${m}</b></td><td></td><td>${b(getBit(m))}</td></tr>`).join("") : "")
      + (pl ? `<tr><td><b>Temperatura real</b></td><td>tanque</td><td>${pl.T.toFixed(1).replace(".", ",")} °C</td></tr><tr><td><b>Nível real</b></td><td>tanque de acrílico</td><td>${Math.round(pl.L)} %</td></tr><tr><td><b>Vazão da bomba</b></td><td>real</td><td>${pl.Q.toFixed(1).replace(".", ",")} L/min</td></tr>` : "");
    const st = $("#plcStatus");
    if (st) st.innerHTML = PLC.run ? `<span class="pill ok">RUN</span> varrendo ${PLC.program.rungs.length} rede(s)` : `<span class="pill neu">STOP</span> saídas desligadas · bancada em comando local`;
    $("#pbAuto") && $("#pbAuto").classList.toggle("on", io.btn.X4);
    if (pl) {
      $("#plcDrain") && ($("#plcDrain").textContent = pl.drain ? "Fechar dreno" : "Abrir dreno");
      const setv = (id, v, txt) => { const el = $(id); if (el && document.activeElement !== el) el.value = v; const t = $(id + "T"); if (t) t.textContent = txt; };
      setv("#plcSp", pl.sp, pl.sp + " °C · D200 = " + Math.round(pl.sp * 10));
      setv("#plcAv", pl.av, pl.av + " % (" + (pl.av * 0.6).toFixed(1).replace(".", ",") + " Hz) · D222 = " + Math.round(pl.av * RAO / 100));
      const fv = $("#plcFv"); if (fv) { fv.disabled = PLC.run && PLC.aoUsed(); if (document.activeElement !== fv) fv.value = pl.fvCmd; $("#plcFvT").textContent = (PLC.run && PLC.aoUsed() ? "CLP pede " : "manual ") + Math.round(pl.fvCmd) + " % (" + (pl.fvCmd * 0.6).toFixed(1).replace(".", ",") + " Hz)"; }
    }
    const lock = $("#clpLock2"); if (lock) lock.style.display = A && A.ready && A.ready() ? "none" : "";
  }
  PLC.refresh = function () { const docked = $("#box3d") && $("#box3d").classList.contains("dock"); if (docked || ($("#v-clp") && $("#v-clp").classList.contains("on"))) { if (PLC.run) render(); refreshIO(); } };

  /* ---------- ligação com a página ---------- */
  PLC.mount = function () {
    if (PLC.mounted) { render(); refreshIO(); return; }
    PLC.mounted = true;
    $("#ldEditor").addEventListener("click", onEditorClick);
    document.querySelectorAll("#ldPal [data-tool]").forEach(bt => bt.onclick = () => { PLC.tool = bt.dataset.tool; render(); msg({ NO: "Contato NA: passa energia quando o endereço vale 1.", NC: "Contato NF: passa energia quando o endereço vale 0.", OUT: "OUT: a bobina segue o resultado da rede.", SET: "SET: liga e mantém ligado, mesmo que a rede desligue.", RST: "RST: desliga o que o SET ligou.", CMP: "CMP S1 S2 D: liga D se S1 > S2, D+1 se forem iguais, D+2 se S1 < S2.", MOV: "MOV S D: copia o valor de S para D (ex.: K2400 → D1116 = velocidade de 60% (36 Hz); na saída, 4000 = 100% = 60 Hz).", PU: "Contato de pulso ↑ (LDP): fica ligado só na varredura em que o endereço passa de 0 para 1. Com M1012 dá um pulso a cada 100 ms.", ADD: "ADD S1 S2 D: D = S1 + S2.", SUB: "SUB S1 S2 D: D = S1 − S2 (ex.: erro = SP − PV).", MUL: "MUL S1 S2 D: D = S1 × S2 (ex.: ganho Kp).", DIV: "DIV S1 S2 D: D = S1 ÷ S2 (parte inteira).", DEL: "Apagar: toque no elemento que quer remover.", SEL: "Editar: toque num elemento para trocar o endereço." }[PLC.tool], ""); });
    const sel = $("#ldExSel");
    if (sel) { sel.innerHTML = Object.entries(EX).filter(([k]) => k !== "vazio").map(([k, e]) => `<option value="${k}">${e.t}</option>`).join(""); sel.onchange = () => { const e = EX[sel.value]; $("#ldExInfo").textContent = e ? e.d : ""; }; sel.onchange(); }
    $("#ldExLoad").onclick = () => { const e = EX[sel.value]; if (!e) return; armed($("#ldExLoad"), hasProgram(), () => { const was = PLC.run; if (was) PLC.setRun(false); PLC.program.rungs = e.f(); PLC.edge = {}; changed(); msg(`Programa carregado: <b>${e.t}</b>. ${e.d}`, "ok"); }); };
    $("#ldClear").onclick = () => armed($("#ldClear"), true, () => { PLC.program.rungs = EX.vazio.f(); changed(); msg("Programa apagado.", ""); });
    $("#plcRun").onclick = () => PLC.setRun(!PLC.run);
    const hold = (id, k) => { const el = $(id); const on = e => { e.preventDefault(); io.btn[k] = true; el.classList.add("on"); }; const off = () => { io.btn[k] = false; el.classList.remove("on"); }; el.addEventListener("pointerdown", on); el.addEventListener("pointerup", off); el.addEventListener("pointerleave", off); el.addEventListener("pointercancel", off); };
    hold("#pbOn", "X2"); hold("#pbOff", "X3");
    $("#pbAuto").onclick = () => { io.btn.X4 = !io.btn.X4; refreshIO(); };
    $("#plcDrain").onclick = () => { window.App3D && App3D.setDrain(!App3D.plant().drain); refreshIO(); };
    $("#plcFv").oninput = e => { window.App3D && App3D.setFv(+e.target.value); refreshIO(); };
    $("#plcSp").oninput = e => { window.App3D && App3D.setSp(+e.target.value); refreshIO(); };
    $("#plcAv").oninput = e => { window.App3D && App3D.setValveReq(+e.target.value); refreshIO(); };
    $("#clpAuto").onclick = () => { window.App3D && App3D.autoInstall(); refreshIO(); };
    render(); refreshIO();
    setInterval(() => PLC.refresh(), 300);
  };
  function hasProgram() { return PLC.program.rungs.some(r => r.out || r.a.some(Boolean)); }
  // confirmação dentro da página (janelas confirm() não funcionam em todos os ambientes)
  function armed(btn, need, fn) {
    if (!need || btn.dataset.armed === "1") { clearTimeout(btn._t); if (btn.dataset.armed === "1") { btn.textContent = btn.dataset.lbl; btn.dataset.armed = ""; } fn(); return; }
    btn.dataset.lbl = btn.textContent; btn.dataset.armed = "1"; btn.textContent = "Clique de novo para confirmar";
    msg("Isso substitui o programa atual. Clique de novo no botão para confirmar.", "warn");
    btn._t = setTimeout(() => { btn.textContent = btn.dataset.lbl; btn.dataset.armed = ""; }, 4000);
  }
})();
