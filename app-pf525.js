/* Inversor Allen-Bradley PowerFlex 525 · 25B-B5P0N104 (240 V trifásico, 5,0 A, 0,75 kW / 1 HP, carcaça A)
   Simulação didática da IHM e do acionamento da bomba, seguindo o manual 520-UM001 (set/2025):
   navegação da IHM (pág. 63), teclas (pág. 62), grupo Basic Program (pág. 65–66), Basic Display (pág. 78–80),
   bornes do PF525 (pág. 42–43), entradas digitais t062–t064 (pág. 90–92) e falhas (pág. 161).
   Também guarda a seletora de partida da bomba: "direta" (contator K1) ou "inversor".
   Expõe window.PF525. */
(() => {
  "use strict";
  const KEY = "nivel-pf525-params-v1", KMODE = "nivel-partida-bomba";
  const RATED = { V: 230, A: 5.0, kW: 0.75 };

  /* ---------- parâmetros (subconjunto do manual) ---------- */
  const SRC = { 1: "Keypad", 2: "DigIn TrmBlk", 3: "Serial/DSI", 4: "Network Opt", 5: "EtherNet/IP" };
  const REF = { 1: "Drive Pot", 2: "Keypad Freq", 3: "Serial/DSI", 4: "Network Opt", 5: "0-10V Input", 6: "4-20mA Input", 7: "Preset Freq", 8: "Anlg In Mult", 9: "MOP", 10: "Pulse Input", 11: "PID1 Output", 12: "PID2 Output", 13: "Step Logic", 14: "Encoder", 15: "EtherNet/IP", 16: "Positioning" };
  const DIN = { 0: "Not Used", 1: "Speed Ref 2", 2: "Speed Ref 3", 3: "Start Src 2", 4: "Start Src 3", 5: "Spd + Strt 2", 6: "Spd + Strt 3", 7: "Preset Freq", 8: "Jog", 9: "Jog Forward", 10: "Jog Reverse", 11: "Acc/Dec Sel2", 12: "Aux Fault", 13: "Clear Fault", 14: "RampStop,CF", 15: "CoastStop,CF", 16: "DCInjStop,CF", 48: "2-Wire FWD", 49: "3-Wire Start", 50: "2-Wire REV", 51: "3-Wire Dir", 52: "Pulse Train" };
  const DEFS = [
    // grupo b · Basic Display (somente leitura)
    { c: "b001", n: "Output Freq", pt: "Frequência de saída para o motor (T1, T2, T3).", dec: 2, u: "HERTZ", ro: 1, get: s => s.outF },
    { c: "b002", n: "Commanded Freq", pt: "Frequência pedida pela referência ativa, mesmo com o inversor parado.", dec: 2, u: "HERTZ", ro: 1, get: s => s.cmdF },
    { c: "b003", n: "Output Current", pt: "Corrente de saída para o motor.", dec: 2, u: "AMPS", ro: 1, get: s => s.I },
    { c: "b004", n: "Output Voltage", pt: "Tensão de saída para o motor.", dec: 1, u: "VOLTS", ro: 1, get: s => s.V },
    { c: "b005", n: "DC Bus Voltage", pt: "Tensão do barramento CC (rede de 230 V retificada).", dec: 0, u: "VOLTS", ro: 1, get: s => s.bus },
    { c: "b006", n: "Drive Status", pt: "Estado, da direita para a esquerda: 1º rodando, 2º sentido direto, 3º acelerando, 4º desacelerando, 5º segurança.", dec: 0, ro: 1, bits: 5, get: s => s.status },
    { c: "b007", n: "Fault 1 Code", pt: "Código da última falha (F0 = nenhuma).", ro: 1, fcode: 1, get: s => s.flog[0] },
    { c: "b008", n: "Fault 2 Code", pt: "Código da penúltima falha.", ro: 1, fcode: 1, get: s => s.flog[1] },
    { c: "b009", n: "Fault 3 Code", pt: "Código da antepenúltima falha.", ro: 1, fcode: 1, get: s => s.flog[2] },
    { c: "b012", n: "Control Source", pt: "Origem ativa: 1º dígito = partida (1 Keypad, 2 bornes); 2º e 3º = referência de velocidade (01 Pot, 05 0-10 V, 06 4-20 mA).", dec: 0, ro: 1, pad: 3, get: s => s.ctrlSrc },
    { c: "b013", n: "Contrl In Status", pt: "Bornes de entrada, da direita para a esquerda: 01 (Stop), 02 (Start/Run FWD), 03. 1 = fechado.", dec: 0, ro: 1, bits: 4, get: s => s.inStat },
    // grupo P · Basic Program (pág. 65–66)
    { c: "P030", n: "Language", pt: "Idioma dos textos do display (7 = Português). Vale depois de desligar e religar.", min: 1, max: 15, d: 1, opts: { 1: "English", 2: "Français", 3: "Español", 4: "Italiano", 5: "Deutsch", 6: "Reserved", 7: "Português", 8: "Reserved", 9: "Reserved", 10: "Reserved", 11: "Reserved", 12: "Polish", 13: "Reserved", 14: "Turkish", 15: "Czech" } },
    { c: "P031", n: "Motor NP Volts", pt: "Tensão nominal da placa do motor.", min: 10, max: 230, d: 230, u: "VOLTS", stop: 1 },
    { c: "P032", n: "Motor NP Hertz", pt: "Frequência nominal da placa do motor.", min: 15, max: 500, d: 60, u: "HERTZ", stop: 1 },
    { c: "P033", n: "Motor OL Current", pt: "Corrente de sobrecarga do motor (proteção eletrônica). Acima dela, por tempo, ocorre a falha F007.", min: 0, max: 10, dec: 1, d: 5.0, u: "AMPS" },
    { c: "P034", n: "Motor NP FLA", pt: "Corrente nominal (plena carga) da placa do motor.", min: 0, max: 10, dec: 1, d: 5.0, u: "AMPS" },
    { c: "P035", n: "Motor NP Poles", pt: "Número de polos do motor.", min: 2, max: 40, d: 4 },
    { c: "P036", n: "Motor NP RPM", pt: "Rotação nominal da placa do motor.", min: 0, max: 24000, d: 1750, stop: 1 },
    { c: "P037", n: "Motor NP Power", pt: "Potência nominal do motor em kW.", min: 0, max: 0.75, dec: 2, d: 0.75 },
    { c: "P039", n: "Torque Perf Mode", pt: "Modo de controle do motor.", min: 0, max: 5, d: 1, stop: 1, opts: { 0: "V/Hz", 1: "SVC", 2: "Economize", 3: "Vector", 4: "PM Control", 5: "SynRM" } },
    { c: "P040", n: "Autotune", pt: "Mede o motor no próximo Start: 1 = parado (estático), 2 = girando. Volta sozinho para 0.", min: 0, max: 2, d: 0, stop: 1, opts: { 0: "Ready/Idle", 1: "Static Tune", 2: "Rotate Tune" } },
    { c: "P041", n: "Accel Time 1", pt: "Tempo para acelerar de 0 Hz até a frequência máxima (P044).", min: 0, max: 600, dec: 2, d: 10 },
    { c: "P042", n: "Decel Time 1", pt: "Tempo para desacelerar da frequência máxima (P044) até 0 Hz.", min: 0, max: 600, dec: 2, d: 10 },
    { c: "P043", n: "Minimum Freq", pt: "Menor frequência que o inversor entrega.", min: 0, max: 500, dec: 2, d: 0, u: "HERTZ", stop: 1 },
    { c: "P044", n: "Maximum Freq", pt: "Maior frequência que o inversor entrega.", min: 0, max: 500, dec: 2, d: 60, u: "HERTZ", stop: 1 },
    { c: "P045", n: "Stop Mode", pt: "Como o motor para: por rampa (P042) ou por inércia (coast). O borne 01 é sempre entrada de parada.", min: 0, max: 11, d: 0, opts: { 0: "Ramp, CF", 1: "Coast, CF", 2: "DC Brake, CF", 3: "DCBrkAuto,CF", 4: "Ramp", 5: "Coast", 6: "DC Brake", 7: "DC BrakeAuto", 8: "Ramp+EM B,CF", 9: "Ramp+EM Brk", 10: "PointStp,CF", 11: "PointStop" } },
    { c: "P046", n: "Start Source 1", pt: "De onde vem o comando de partida: 1 = teclado (IHM), 2 = bornes (entradas digitais).", min: 1, max: 5, d: 1, stop: 1, opts: SRC },
    { c: "P047", n: "Speed Reference1", pt: "De onde vem a velocidade: 1 = potenciômetro do inversor, 5 = 0-10 V (borne 13), 6 = 4-20 mA (borne 15).", min: 1, max: 16, d: 1, opts: REF },
    { c: "P048", n: "Start Source 2", pt: "Origem de partida alternativa, usada quando uma entrada digital a seleciona.", min: 1, max: 5, d: 2, stop: 1, opts: SRC },
    { c: "P049", n: "Speed Reference2", pt: "Referência de velocidade alternativa.", min: 1, max: 16, d: 5, opts: REF },
    { c: "P050", n: "Start Source 3", pt: "Terceira origem de partida.", min: 1, max: 5, d: 5, stop: 1, opts: SRC },
    { c: "P051", n: "Speed Reference3", pt: "Terceira referência de velocidade.", min: 1, max: 16, d: 15, opts: REF },
    { c: "P052", n: "Average kWh Cost", pt: "Custo médio do kWh (para o cálculo de economia).", min: 0, max: 655.35, dec: 2, d: 0 },
    { c: "P053", n: "Reset To Defalts", pt: "Volta os parâmetros ao padrão de fábrica (1 = Param Reset, 2 = Factory Rset). Depois aparece a falha F048, que se limpa com Stop.", min: 0, max: 4, d: 0, stop: 1, opts: { 0: "Ready/Idle", 1: "Param Reset", 2: "Factory Rset", 3: "Power Reset", 4: "Module Reset" } },
    // grupo t · Terminal Block (pág. 90–92)
    { c: "t062", n: "DigIn TermBlk 02", pt: "Função do borne 02. 48 = 2-Wire FWD (liga enquanto o contato estiver fechado).", min: 0, max: 52, d: 48, stop: 1, opts: DIN },
    { c: "t063", n: "DigIn TermBlk 03", pt: "Função do borne 03. 50 = 2-Wire REV.", min: 0, max: 52, d: 50, stop: 1, opts: DIN },
    { c: "t064", n: "2-Wire Mode", pt: "Modo do comando a 2 fios: 0 = por borda (precisa abrir e fechar de novo depois de um Stop), 1 = por nível.", min: 0, max: 3, d: 0, stop: 1, opts: { 0: "Edge Trigger", 1: "Level Sense", 2: "Hi-Spd Edge", 3: "Momentary" } },
    { c: "t065", n: "DigIn TermBlk 05", pt: "Função do borne 05.", min: 0, max: 52, d: 7, stop: 1, opts: DIN },
    { c: "t066", n: "DigIn TermBlk 06", pt: "Função do borne 06.", min: 0, max: 52, d: 7, stop: 1, opts: DIN },
    { c: "t067", n: "DigIn TermBlk 07", pt: "Função do borne 07.", min: 0, max: 52, d: 5, stop: 1, opts: DIN },
    { c: "t068", n: "DigIn TermBlk 08", pt: "Função do borne 08.", min: 0, max: 52, d: 9, stop: 1, opts: DIN },
    // grupo A · Advanced Program (só o que a bancada usa)
    { c: "A544", n: "Reverse Disable", pt: "Bloqueia a reversão (tecla de reversão e borne 03).", min: 0, max: 1, d: 0, stop: 1, opts: { 0: "Rev Enabled", 1: "Rev Disabled" } },
  ];
  const BY = {}; DEFS.forEach(p => { BY[p.c] = p; if (p.dec == null) p.dec = 0; });
  const GROUPS = ["b", "P", "t", "A", "M"];
  const FAULTS = { 0: "No Fault", 7: "Motor Overload", 48: "Params Defaulted", 80: "Autotune Failure" };

  /* ---------- estado ---------- */
  const st = {
    par: {}, run: false, dir: 1, outF: 0, cmdF: 0, n: 0, I: 0, V: 0, bus: 325, status: 0, ctrlSrc: 11, inStat: 1,
    fault: 0, flog: [0, 0, 0], pot: 0, ol: 0, di02: false, di02Prev: false, ai: null, coast: false, tune: 0,
    accel: false, decel: false, ach45: false, stopAfter45: false, ranDI: false,
  };
  let mode = "direta";
  function defaults() { const p = {}; DEFS.forEach(d => { if (!d.ro) p[d.c] = d.d; }); return p; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st.par)); } catch (e) { } }
  (function load() {
    st.par = defaults();
    try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j) for (const k in j) if (k in st.par) st.par[k] = j[k]; } catch (e) { }
    try { const m = localStorage.getItem(KMODE); if (m === "inversor" || m === "direta") mode = m; } catch (e) { }
  })();
  const P = c => st.par[c];
  // a seletora de partida agora fica em window.DRV (app-drives.js): Direta / PF525 / ATV12 / CFW500
  const curMode = () => window.DRV ? (window.DRV.sel === "pf525" ? "inversor" : "direta") : mode;
  const val = c => { const d = BY[c]; return d.ro ? d.get(st) : st.par[c]; };
  const running = () => st.run || st.outF > 0.01;
  const listeners = [];
  const changed = () => { save(); listeners.forEach(f => { try { f(); } catch (e) { } }); };

  /* ---------- simulação do acionamento ---------- */
  function setFault(code) {
    if (st.fault) return;
    st.fault = code; st.run = false; st.outF = 0; st.coast = true;
    if (st.flog[0] !== code) st.flog = [code, st.flog[0], st.flog[1]];
    msg(`Falha <b>F${String(code).padStart(3, "0")} · ${FAULTS[code] || ""}</b>. Corrija a causa e aperte <b>Stop</b> para limpar.`, "bad");
    changed();
  }
  function refFrac() {
    const r = P("P047");
    if (r === 1) return { f: st.pot, src: 1 };
    if (r === 6) return { f: st.ai == null ? 0 : st.ai, src: 6 };
    if (r === 5) return { f: 0, src: 5 };
    return { f: 0, src: r };
  }
  function step(dt, inp = {}) {
    st.di02 = !!inp.di02; st.ai = inp.ai == null ? null : Math.max(0, Math.min(1, inp.ai));
    const src = P("P046"), fmin = P("P043"), fmax = Math.max(P("P044"), 0.01);
    // partida pelos bornes (2 fios)
    if (src === 2 && !st.fault) {
      const t62 = P("t062"), edge = st.di02 && !st.di02Prev;
      if (t62 === 48) {
        const lvl = P("t064") === 1;
        if (lvl ? st.di02 : edge) { if (!st.run) { st.run = true; st.dir = 1; } }
        if (!st.di02 && P("t064") !== 3) st.run = false;
      } else if (t62 === 49) { if (edge) { st.run = true; st.dir = 1; } }
      if (st.run) st.ranDI = true;
    }
    st.di02Prev = st.di02;
    if (src === 2 && P("t062") !== 48 && P("t062") !== 49 && st.run && !st.di02) { /* entrada sem função de partida */ }
    // autotune (simplificado)
    if (st.tune > 0) { st.tune -= dt; if (st.tune <= 0) { st.par.P040 = 0; msg("Autotune concluído: o inversor mediu o motor. <b>P040</b> voltou para 0.", "ok"); changed(); } }
    // referência e rampa
    const rf = refFrac();
    st.cmdF = fmin + rf.f * (fmax - fmin);
    const up = P("P041") > 0 ? fmax / P("P041") : 1e4, dn = P("P042") > 0 ? fmax / P("P042") : 1e4;
    const prevF = st.outF;
    if (st.run && !st.fault) {
      st.coast = false;
      const tgt = Math.max(fmin, st.cmdF);
      if (st.outF < tgt) st.outF = Math.min(tgt, st.outF + up * dt); else st.outF = Math.max(tgt, st.outF - dn * dt);
    } else {
      const sm = P("P045"), coast = sm === 1 || sm === 5;
      if (coast) { if (st.outF > 0) st.coast = true; st.outF = 0; }
      else { const k = sm === 2 || sm === 3 || sm === 6 || sm === 7 ? 3 : 1; st.outF = Math.max(0, st.outF - dn * k * dt); }
    }
    st.accel = st.outF > prevF + 1e-6; st.decel = st.outF < prevF - 1e-6;
    // motor: segue a frequência; em inércia, perde rotação devagar
    const sync = Math.max(P("P032"), 1), tgtN = st.outF / sync;
    if (st.outF > 0) st.n += (tgtN - st.n) * Math.min(1, dt * 6); else st.n = st.coast ? st.n * Math.exp(-dt / 2.5) : Math.max(0, st.n - dt * 2);
    if (st.n < 0.002) { st.n = 0; st.coast = false; }
    // corrente (bomba centrífuga: carga cresce com o cubo da rotação), tensão (V/Hz) e barramento
    const fla = P("P034") > 0 ? P("P034") : RATED.A, nn = Math.min(st.outF / sync, 1.25);
    st.I = st.outF > 0.05 ? fla * (0.32 + 0.6 * nn * nn * nn) + (st.accel ? 0.35 * fla * Math.min(1, up / 12) : 0) : 0;
    st.I = Math.min(st.I, RATED.A * 2);
    st.V = st.outF > 0.05 ? Math.min(P("P031"), P("P031") * st.outF / sync + 4) : 0;
    st.bus = Math.round(325 - st.I * 1.6);
    // sobrecarga eletrônica do motor (F007)
    const ol = P("P033");
    if (st.I > 0 && ol > 0 && st.I > ol) st.ol += ((st.I / ol) ** 2 - 1) * dt; else st.ol = Math.max(0, st.ol - dt * 0.5);
    if (st.I > 0 && ol <= 0) st.ol += dt * 2;
    if (st.ol > 20) { st.ol = 0; setFault(7); }
    // indicadores b006, b012, b013
    st.status = (running() ? 1 : 0) + (st.dir > 0 ? 10 : 0) + (st.accel ? 100 : 0) + (st.decel ? 1000 : 0);
    st.ctrlSrc = src + 10 * rf.src;
    st.inStat = 1 + (st.di02 ? 10 : 0);
    // checklist: chegou a ~45 Hz pela IHM e depois parou
    if (src === 1 && st.run && Math.abs(st.outF - 45) < 2.5) st.ach45 = true;
    if (st.ach45 && !running()) st.stopAfter45 = true;
    return { n: st.n * st.dir, outF: st.outF, running: running(), fault: st.fault };
  }

  /* ---------- IHM: teclas e display ---------- */
  const ui = { mode: "disp", grp: "b", idx: { b: 0, P: 0, t: 0, A: 0, M: 0 }, disp: 0, ed: null, flash: null, msg: null, msgKind: "" };
  const groupList = g => g === "M" ? DEFS.filter(d => !d.ro && st.par[d.c] !== d.d) : DEFS.filter(d => d.c[0] === g);
  const curDef = () => { const l = groupList(ui.grp); if (!l.length) return null; ui.idx[ui.grp] = Math.min(ui.idx[ui.grp], l.length - 1); return l[ui.idx[ui.grp]]; };
  const bList = () => groupList("b");
  function msg(html, kind = "") { ui.msg = html; ui.msgKind = kind; }
  function flash(txt, ms = 1200) { ui.flash = { txt, until: performance.now() + ms }; }
  function fmtVal(d, v) {
    if (d.fcode) return "F" + v;
    if (d.bits) return String(v).padStart(d.bits, "0");
    if (d.pad) return String(v).padStart(d.pad, "0");
    return Number(v).toFixed(d.dec);
  }
  const stepOf = (d, pos) => Math.pow(10, pos) / Math.pow(10, d.dec);
  function key(k) {
    const d = curDef();
    if (k === "stop") {
      if (st.fault) { st.fault = 0; st.ol = 0; msg("Falha limpa pela tecla Stop.", "ok"); changed(); return; }
      st.run = false; return;
    }
    if (k === "start") {
      if (st.fault) { msg("O inversor está em falha: aperte <b>Stop</b> para limpar antes de partir.", "bad"); return; }
      if (P("P046") !== 1) { msg(`A tecla Start está inativa: <b>P046 = ${P("P046")} (${SRC[P("P046")]})</b>. Para partir pela IHM, use P046 = 1 (Keypad).`, "bad"); return; }
      if (P("P040") !== 0) { st.tune = 3; flash("tUnE", 3000); msg("Autotune em andamento (P040 ≠ 0): o motor é medido e o inversor não parte agora.", ""); return; }
      st.run = true; return;
    }
    if (k === "rev") {
      if (P("P046") !== 1) { msg("A tecla de reversão só vale com P046 = 1 (Keypad).", "bad"); return; }
      if (P("A544") === 1) { msg("Reversão bloqueada: <b>A544 = 1</b> (Rev Disabled).", "bad"); return; }
      st.dir = -st.dir; msg(st.dir < 0 ? "Sentido <b>reverso</b> (REV). Numa bomba centrífuga, girar ao contrário entrega bem menos vazão." : "Sentido <b>direto</b> (FWD).", ""); return;
    }
    if (ui.mode === "disp") {
      if (k === "esc") { ui.mode = "pnum"; ui.grp = "b"; ui.idx.b = ui.disp; }
      else if (k === "up" || k === "down") { const n = bList().length; ui.disp = (ui.disp + (k === "up" ? 1 : n - 1)) % n; flash(bList()[ui.disp].c, 900); }
      return;
    }
    if (ui.mode === "group") {
      const gi = GROUPS.indexOf(ui.grp);
      if (k === "up" || k === "down") ui.grp = GROUPS[(gi + (k === "up" ? 1 : GROUPS.length - 1)) % GROUPS.length];
      else if (k === "enter" || k === "sel") { if (!groupList(ui.grp).length) { flash("----", 900); msg("O grupo <b>M</b> (Modified) lista só os parâmetros alterados. Ainda não há nenhum.", ""); return; } ui.mode = "pnum"; }
      else if (k === "esc") ui.mode = "disp";
      return;
    }
    if (ui.mode === "pnum") {
      const n = groupList(ui.grp).length;
      if (k === "up" || k === "down") ui.idx[ui.grp] = (ui.idx[ui.grp] + (k === "up" ? 1 : n - 1)) % n;
      else if (k === "enter" || k === "sel") { if (d && d.ro) { ui.disp = bList().indexOf(d); ui.mode = "disp"; msg(`<b>${d.c}</b> é uma <b>leitura</b> (grupo b): só mostra valores. Para programar, aperte <b>Esc 2 vezes</b> até a letra piscar e <b>▲</b> até o grupo <b>P</b>.`, ""); } else ui.mode = "view"; }
      else if (k === "esc") ui.mode = "group";
      return;
    }
    if (ui.mode === "view") {
      if (k === "esc") ui.mode = "pnum";
      else if ((k === "enter" || k === "sel") && d && !d.ro) {
        if (d.stop && running()) { flash("StoP", 1300); msg(`<b>${d.c}</b> só pode ser alterado com o inversor <b>parado</b> (símbolo de Stop no manual, pág. 65). Pare o motor primeiro.`, "bad"); return; }
        ui.mode = "edit"; ui.ed = { v: st.par[d.c], pos: 0 };
      }
      return;
    }
    if (ui.mode === "edit" && d) {
      const e = ui.ed, nd = Math.max(1, String(Math.round(d.max * Math.pow(10, d.dec))).length);
      if (k === "up" || k === "down") { let v = e.v + (k === "up" ? 1 : -1) * stepOf(d, e.pos); v = Math.round(v * 1e4) / 1e4; e.v = Math.max(d.min, Math.min(d.max, v)); }
      else if (k === "sel") e.pos = (e.pos + 1) % nd;
      else if (k === "esc") { ui.mode = "view"; ui.ed = null; }
      else if (k === "enter") {
        if (d.stop && running()) { flash("StoP", 1300); msg(`Pare o inversor antes de salvar <b>${d.c}</b>.`, "bad"); return; }
        if (d.c === "P053" && (e.v === 1 || e.v === 2)) {
          const keep = e.v === 1 ? {} : null;
          st.par = defaults(); if (keep) { }
          ui.mode = "view"; ui.ed = null; st.fault = 0; setFault(48); msg("Parâmetros voltaram ao <b>padrão de fábrica</b> (P053). O inversor mostra <b>F048 Params Defaulted</b>: aperte Stop para limpar.", "bad"); return;
        }
        st.par[d.c] = e.v; ui.mode = "view"; ui.ed = null;
        msg(`<b>${d.c} [${d.n}]</b> salvo: <b>${fmtVal(d, e.v)}</b>${d.opts && d.opts[e.v] ? " = " + d.opts[e.v] : d.u ? " " + uName(d.u) : ""}.`, "ok");
        changed();
      }
    }
  }
  const uName = u => ({ HERTZ: "Hz", VOLTS: "V", AMPS: "A" })[u] || "";

  // conteúdo do display: { txt, blinkIdx (índice do caractere que pisca, -1 nenhum, "all"), unit, prog }
  function lcd() {
    const now = performance.now();
    const base = { unit: null, prog: false, fwd: running() && st.dir > 0, rev: running() && st.dir < 0, fault: !!st.fault, blink: -1 };
    if (ui.flash && now < ui.flash.until) return { ...base, txt: ui.flash.txt };
    if (st.fault && ui.mode === "disp") return { ...base, txt: "F" + String(st.fault).padStart(3, " ").replace(/ /g, " "), blink: "all" };
    const d = curDef();
    if (ui.mode === "disp") { const b = bList()[ui.disp]; return { ...base, txt: fmtVal(b, b.get(st)), unit: b.u || null }; }
    if (ui.mode === "group") { const l = groupList(ui.grp), x = l[ui.idx[ui.grp]] || l[0]; return { ...base, txt: x ? x.c : ui.grp + "---", blink: 0 }; }
    if (ui.mode === "pnum") return { ...base, txt: d.c, blink: d.c.length - 1 };
    if (ui.mode === "view") return { ...base, txt: fmtVal(d, val(d.c)), unit: d.u || null };
    if (ui.mode === "edit") {
      let t = fmtVal(d, ui.ed.v); // dígito que pisca: ui.ed.pos, contando da direita; mostra zeros à esquerda se precisar
      const nDig = t.replace(".", "").length; if (ui.ed.pos >= nDig) t = "0".repeat(ui.ed.pos - nDig + 1) + t;
      let i = t.length - 1, cnt = -1; for (; i >= 0; i--) { if (t[i] !== ".") cnt++; if (cnt === ui.ed.pos) break; }
      return { ...base, txt: t, unit: d.u || null, prog: true, blink: i };
    }
    return { ...base, txt: "" };
  }

  /* ---------- display de 7 segmentos ---------- */
  const SEG = { "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg", A: "abcefg", b: "cdefg", C: "adef", c: "deg", d: "bcdeg", E: "adefg", F: "aefg", G: "acdef", H: "bcefg", L: "def", n: "ceg", o: "cdeg", P: "abefg", r: "eg", t: "defg", U: "bcdef", u: "cde", M: "abcef", S: "acdfg", "-": "g", " ": "" };
  // converte o texto em 5 células com ponto decimal
  function cells(txt) {
    const out = [];
    for (const ch of String(txt)) { if (ch === "." && out.length) out[out.length - 1].dp = true; else out.push({ ch, dp: false }); }
    while (out.length < 5) out.unshift({ ch: " ", dp: false });
    return out.slice(-5);
  }
  function segPoly(s, x, y, w, h) {
    const t = w * 0.17, m = y + h / 2, sk = 0;
    const H = (yy) => `${x + t},${yy} ${x + w - t},${yy} ${x + w - t * 1.6},${yy + t * 0.8} ${x + t * 1.6},${yy + t * 0.8}`;
    const P2 = { a: `${x + t * 0.6},${y} ${x + w - t * 0.6},${y} ${x + w - t * 1.6},${y + t} ${x + t * 1.6},${y + t}`,
      d: `${x + t * 1.6},${y + h - t} ${x + w - t * 1.6},${y + h - t} ${x + w - t * 0.6},${y + h} ${x + t * 0.6},${y + h}`,
      g: `${x + t},${m} ${x + t * 1.6},${m - t / 2} ${x + w - t * 1.6},${m - t / 2} ${x + w - t},${m} ${x + w - t * 1.6},${m + t / 2} ${x + t * 1.6},${m + t / 2}`,
      f: `${x},${y + t * 0.6} ${x + t},${y + t * 1.6} ${x + t},${m - t * 0.6} ${x},${m - t * 0.1}`,
      b: `${x + w},${y + t * 0.6} ${x + w},${m - t * 0.1} ${x + w - t},${m - t * 0.6} ${x + w - t},${y + t * 1.6}`,
      e: `${x},${m + t * 0.1} ${x + t},${m + t * 0.6} ${x + t},${y + h - t * 1.6} ${x},${y + h - t * 0.6}`,
      c: `${x + w},${m + t * 0.1} ${x + w},${y + h - t * 0.6} ${x + w - t},${y + h - t * 1.6} ${x + w - t},${m + t * 0.6}` };
    void H; void sk; return P2[s];
  }
  function lcdSVG(L, blinkOn) {
    const cs = cells(L.txt), W = 28, Hh = 50, G = 8, X0 = 28, Y0 = 12;
    let s = `<svg viewBox="0 0 262 78" class="pf-lcdsvg" aria-label="Display: ${L.txt}">`;
    cs.forEach((c, i) => {
      const x = X0 + i * (W + G), hide = (L.blink === "all" || L.blink === i) && !blinkOn;
      const on = hide ? "" : (SEG[c.ch] ?? SEG[c.ch.toUpperCase()] ?? "");
      for (const sg of "abcdefg") s += `<polygon points="${segPoly(sg, x, Y0, W, Hh)}" class="${on.includes(sg) ? "on" : "off"}"/>`;
      s += `<circle cx="${x + W + 4}" cy="${Y0 + Hh - 2}" r="2.6" class="${c.dp && !hide ? "on" : "off"}"/>`;
    });
    s += `<text x="4" y="22" class="${L.fwd ? "lon" : "loff"}">FWD</text><text x="4" y="36" class="${L.rev ? "lon" : "loff"}">REV</text>`;
    ["HERTZ", "VOLTS", "AMPS"].forEach((u, i) => { s += `<text x="258" y="${20 + i * 13}" text-anchor="end" class="${L.unit === u ? "lon" : "loff"}">${u}</text>`; });
    s += `<text x="258" y="74" text-anchor="end" class="${L.prog ? "lon" : "loff"}">PROGRAM</text>`;
    return s + "</svg>";
  }
  // índice de piscar: converte índice no texto para índice de célula
  function blinkCell(L) {
    if (L.blink === "all" || L.blink < 0) return L.blink;
    const cs = []; for (const ch of String(L.txt)) { if (ch === "." && cs.length) continue; cs.push(ch); }
    let pos = 0; for (let i = 0, k = -1; i < String(L.txt).length; i++) { if (String(L.txt)[i] !== ".") k++; if (i === L.blink) { pos = k; break; } }
    return 5 - cs.length + pos;
  }

  /* ---------- frente do inversor (imagem + partes animadas) ---------- */
  // coordenadas na imagem recortada (400 × 885): [x, y, raio] ou [x0, y0, x1, y1]
  const FW = 400, FH = 855;
  const FACE = { lcd: [77, 111, 282, 177], up: [143, 253, 26], down: [143, 371, 26], esc: [78, 313, 26], enter: [207, 313, 26], sel: [143, 313, 32],
    start: [304, 267, 32], stop: [304, 349, 32], rev: [254, 308, 12], pot: [319, 153, 29], fault: [273, 193, 6], lbl: [180, 481, 229, 510] };
  const IMG = new Image(); let imgOk = false;
  IMG.onload = () => { imgOk = true; }; IMG.src = window.PF525_IMG || "";
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function drawFace(g, W, H) {
    g.save(); g.setTransform(W / FW, 0, 0, H / FH, 0, 0);
    if (imgOk) g.drawImage(IMG, 0, 0, FW, FH); else { g.fillStyle = "#26292E"; g.fillRect(0, 0, FW, FH * 0.5); g.fillStyle = "#D6D7D3"; g.fillRect(0, FH * 0.5, FW, FH * 0.5); }
    const now = performance.now(), on = Math.floor(now / 350) % 2 === 0;
    // display de cristal líquido verde com o conteúdo da simulação
    const [x0, y0, x1, y1] = FACE.lcd, L = lcd(), cs = cells(L.txt), bc = blinkCell(L);
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, "#B4DB6A"); gr.addColorStop(1, "#93C247");
    g.fillStyle = gr; rr(g, x0, y0, x1 - x0, y1 - y0, 4); g.fill();
    g.fillStyle = "rgba(0,40,0,.07)"; for (let yy = y0 + 3; yy < y1; yy += 3) g.fillRect(x0 + 2, yy, x1 - x0 - 4, 1);
    g.fillStyle = "#14320B"; g.textBaseline = "alphabetic";
    g.font = "bold 46px 'Courier New', monospace";
    cs.forEach((c, i) => { const hide = (bc === "all" || bc === i) && !on; if (hide) return; const x = x0 + 26 + i * 33; g.fillText(c.ch, x, y1 - 14); if (c.dp) g.fillRect(x + 27, y1 - 21, 6, 6); });
    g.font = "bold 11px Arial";
    g.textAlign = "left"; if (L.fwd) g.fillText("FWD", x0 + 6, y0 + 14); if (L.rev) g.fillText("REV", x0 + 6, y0 + 14); if (L.prog) g.fillText("PROGRAM", x0 + 6, y1 - 4);
    g.textAlign = "right"; if (L.unit) g.fillText(L.unit, x1 - 6, y0 + 14); g.textAlign = "left";
    // LED de falha
    g.fillStyle = "#AEB4BB"; g.font = "bold 10px Arial"; g.textAlign = "right"; g.fillText("FAULT", FACE.fault[0] - 10, FACE.fault[1] + 4); g.textAlign = "left";
    g.beginPath(); g.arc(FACE.fault[0], FACE.fault[1], FACE.fault[2], 0, 7); g.fillStyle = st.fault && on ? "#FF3B2E" : "#4A2A28"; g.fill();
    if (st.fault && on) { g.beginPath(); g.arc(FACE.fault[0], FACE.fault[1], 13, 0, 7); g.fillStyle = "rgba(255,59,46,.25)"; g.fill(); }
    // potenciômetro: o botão da imagem gira conforme o valor
    const [px, py, pr0] = FACE.pot, pr = pr0 - 3;
    const pg = g.createRadialGradient(px - 6, py - 7, 3, px, py, pr); pg.addColorStop(0, "#4A4E55"); pg.addColorStop(1, "#0E0F11");
    g.beginPath(); g.arc(px, py, pr, 0, 7); g.fillStyle = pg; g.fill();
    for (let k = 0; k <= 10; k++) { const an = (-135 + 27 * k) * Math.PI / 180; g.fillStyle = "#8A9098"; g.fillRect(px + Math.sin(an) * (pr + 7) - 1, py - Math.cos(an) * (pr + 7) - 1, 2, 2); }
    const an = (-135 + 270 * st.pot) * Math.PI / 180; g.strokeStyle = "#F2F2F2"; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.moveTo(px + Math.sin(an) * 6, py - Math.cos(an) * 6); g.lineTo(px + Math.sin(an) * (pr - 4), py - Math.cos(an) * (pr - 4)); g.stroke();
    // tecla de reversão
    const [rx, ry, rr2] = FACE.rev; g.fillStyle = "#5A6068"; rr(g, rx - rr2 * 1.5, ry - rr2, rr2 * 3, rr2 * 2, 7); g.fill();
    g.fillStyle = "#fff"; g.font = "bold 15px Arial"; g.textAlign = "center"; g.fillText("⇆", rx, ry + 5); g.textAlign = "left";
    // etiqueta: o modelo da bancada é o 525
    const [lx0, ly0, lx1, ly1] = FACE.lbl; if (imgOk) g.drawImage(IMG, 240, ly0, lx1 - lx0, ly1 - ly0, lx0, ly0, lx1 - lx0, ly1 - ly0); else { g.fillStyle = "#D5D6D2"; g.fillRect(lx0, ly0, lx1 - lx0, ly1 - ly0); } // cobre o 523 com o cinza da própria imagem
    g.fillStyle = "#3B3E43"; g.font = "italic bold 30px Arial"; g.fillText("525", lx0 - 1, ly1 - 3);
    // tecla apertada
    if (st.hit && now - st.hit.t < 220) { const z = FACE[st.hit.k]; if (z) { g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.arc(z[0], z[1], z[2] + 2, 0, 7); g.fill(); } }
    g.restore();
  }
  function paint3D(c) { drawFace(c.getContext("2d"), c.width, c.height); }
  // clique na frente: (u, v) da textura → tecla
  function hitKey(u, v) {
    const x = u * FW, y = (1 - v) * FH, d = (p) => Math.hypot(x - p[0], y - p[1]);
    if (d(FACE.pot) < FACE.pot[2] + 8) return "pot";
    for (const k of ["start", "stop", "rev"]) if (d(FACE[k]) < FACE[k][2] + 8) return k;
    const r = d(FACE.sel);
    if (r < FACE.sel[2] + 2) return "sel";
    if (r < 92) { const dx = x - FACE.sel[0], dy = y - FACE.sel[1]; return Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? "up" : "down") : (dx < 0 ? "esc" : "enter"); }
    return null;
  }
  function pressAt(u, v, ev) {
    const k = hitKey(u, v); if (!k) return null;
    st.hit = { k, t: performance.now() };
    if (k === "pot") potSlider(ev ? ev.clientX : innerWidth / 2, ev ? ev.clientY : innerHeight / 2);
    else key(k);
    paint(); return k;
  }
  // potenciômetro: ao clicar, abre uma barra deslizante (sobe = mais velocidade)
  let potPop = null;
  function potSlider(x, y) {
    if (!document.getElementById("pf525css")) { const s = document.createElement("style"); s.id = "pf525css"; s.textContent = CSS; document.head.appendChild(s); }
    if (potPop) potPop.remove();
    const host = document.fullscreenElement || document.body;
    const d = document.createElement("div"); d.className = "pf-potpop";
    d.innerHTML = `<div class="pp-h"><b>Potenciômetro</b><button class="pp-x" aria-label="Fechar">✕</button></div>
      <div class="pp-b"><input type="range" min="0" max="100" step="1" aria-label="Potenciômetro do inversor"><div class="pp-v"><b class="pp-p"></b><span class="pp-hz"></span></div></div>
      <div class="pp-n">Arraste para cima ou para baixo. Vale com <b>P047 = 1</b> (Drive Pot).</div>`;
    host.appendChild(d); potPop = d;
    const W = 190, H = 300; d.style.left = Math.max(8, Math.min(innerWidth - W - 8, x + 18)) + "px"; d.style.top = Math.max(8, Math.min(innerHeight - H - 8, y - H / 2)) + "px";
    const r = d.querySelector("input");
    const upd = () => { r.value = Math.round(st.pot * 100); const hz = P("P043") + st.pot * (P("P044") - P("P043")); d.querySelector(".pp-p").textContent = Math.round(st.pot * 100) + " %"; d.querySelector(".pp-hz").textContent = "≈ " + hz.toFixed(1).replace(".", ",") + " Hz pedidos"; };
    r.oninput = () => { st.pot = +r.value / 100; upd(); paint(); };
    const close = () => { d.remove(); if (potPop === d) potPop = null; document.removeEventListener("pointerdown", out, true); document.removeEventListener("keydown", esc, true); };
    const out = e => { if (!d.contains(e.target)) close(); };
    const esc = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    d.querySelector(".pp-x").onclick = close;
    setTimeout(() => { document.addEventListener("pointerdown", out, true); document.addEventListener("keydown", esc, true); }, 0);
    upd(); r.focus();
  }
  // área clicável na IHM ampliada (em % da imagem)
  const hot = (k, cls = "hk") => { const [x, y, r] = FACE[k]; return `left:${(x - r) / FW * 100}%;top:${(y - r) / FH * 100}%;width:${2 * r / FW * 100}%;height:${2 * r / FH * 100}%`; };

  /* ---------- janela da IHM + checklist ---------- */
  const EX = {
    a1: { t: "Atividade 1 · Partida pela IHM", note: "Dados de placa de um motor de 0,75 kW usados como <b>exemplo</b>: confira a placa do motor da bancada e ajuste.", items: [
      ["Seletora de partida em <b>PowerFlex 525</b>", () => curMode() === "inversor"],
      ["P031 [Motor NP Volts] = 220 V", () => P("P031") === 220],
      ["P032 [Motor NP Hertz] = 60 Hz", () => P("P032") === 60],
      ["P033 [Motor OL Current] = 3,0 A", () => Math.abs(P("P033") - 3) < 0.05],
      ["P034 [Motor NP FLA] = 3,0 A", () => Math.abs(P("P034") - 3) < 0.05],
      ["P035 [Motor NP Poles] = 4", () => P("P035") === 4],
      ["P036 [Motor NP RPM] = 1720 rpm", () => P("P036") === 1720],
      ["P041 [Accel Time 1] = 5,00 s", () => Math.abs(P("P041") - 5) < 0.005],
      ["P042 [Decel Time 1] = 5,00 s", () => Math.abs(P("P042") - 5) < 0.005],
      ["P043 [Minimum Freq] = 0,00 Hz e P044 [Maximum Freq] = 60,00 Hz", () => P("P043") === 0 && Math.abs(P("P044") - 60) < 0.005],
      ["P045 [Stop Mode] = 0 (Ramp, CF)", () => P("P045") === 0],
      ["P046 [Start Source 1] = 1 (Keypad)", () => P("P046") === 1],
      ["P047 [Speed Reference1] = 1 (Drive Pot)", () => P("P047") === 1],
      ["Partir pela tecla verde (I) e levar a <b>45 Hz</b> pelo potenciômetro (veja b001 e b003)", () => st.ach45],
      ["Parar pela tecla vermelha (O) e observar a rampa de desaceleração", () => st.stopAfter45],
    ] },
    a2: { t: "Atividade 2 · Partida pelo CLP (2 fios)", note: "O Y0 do CLP fecha o borne 02 (Run FWD). A seletora precisa estar em INVERSOR e a bomba recebe o comando do CLP (RUN) ou do botão local.", items: [
      ["Seletora de partida em <b>PowerFlex 525</b>", () => curMode() === "inversor"],
      ["P046 [Start Source 1] = 2 (DigIn TrmBlk)", () => P("P046") === 2],
      ["t062 [DigIn TermBlk 02] = 48 (2-Wire FWD)", () => P("t062") === 48],
      ["t064 [2-Wire Mode] = 0 (Edge Trigger)", () => P("t064") === 0],
      ["P047 = 1 (Drive Pot) ou 6 (4-20mA Input, saída D1117 do CLP no borne 15)", () => P("P047") === 1 || P("P047") === 6],
      ["Ligar a bomba pelo CLP (Y0) ou pelo botão local e ver o inversor partir", () => st.ranDI],
    ] },
  };
  let hosts = [], tab = "a1", timer = null;
  const CSS = `
  .pf-wrap{display:grid;grid-template-columns:330px minmax(0,1fr);gap:16px;align-items:start}
  @media (max-width:820px){.pf-wrap{grid-template-columns:1fr}}
  .pf-dev2{position:relative;width:300px;aspect-ratio:400/855;margin:0 auto;user-select:none;-webkit-user-select:none;touch-action:none;filter:drop-shadow(0 12px 22px rgba(0,0,0,.35))}
  .pf-dev2 canvas{display:block;width:100%;height:100%}
  .pf-dev2 .hk{position:absolute;border:0;border-radius:50%;background:transparent;cursor:pointer;padding:0}
  .pf-dev2 .hk:active,.pf-dev2 .hk.dn{background:rgba(255,255,255,.22)}
  .pf-dev2 .potz{cursor:ns-resize}
  .pf-dev{position:relative;width:310px;height:600px;margin:0 auto;border-radius:10px;background:linear-gradient(90deg,#141518,#25282d 50%,#141518);box-shadow:0 10px 30px rgba(0,0,0,.35);overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}
  .pf-dev .low{position:absolute;left:0;right:0;bottom:0;height:258px;background:#D9DBDD;border-top:2px solid #0d0e10}
  .pf-dev .vent{position:absolute;left:34px;right:70px;top:18px;height:130px;background:repeating-linear-gradient(90deg,#c3c6c9 0 9px,transparent 9px 21px)}
  .pf-dev .brand{position:absolute;left:16px;bottom:26px;color:#B23A2E;font:italic 700 38px Arial,sans-serif;letter-spacing:-1px}
  .pf-dev .brand small{font-size:18px;margin-left:2px}
  .pf-dev .nets{position:absolute;right:14px;bottom:18px;font:11px Arial;color:#3A3D42;line-height:15px;text-align:right}
  .pf-dev .nets i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#3A3D42;margin-left:6px}
  .pf-dev .nets i.g{background:#2EE07A}
  .pf-dev .logo{position:absolute;left:18px;top:14px;color:#C9CDD2;font:700 15px Arial;display:flex;align-items:center;gap:6px}
  .pf-dev .logo b{display:inline-grid;place-items:center;width:22px;height:22px;border:2px solid #C9CDD2;border-radius:50%;font-size:9px}
  .pf-dev .lcd{position:absolute;left:14px;top:44px;width:212px;height:66px;background:#AEB8AC;border-radius:4px;box-shadow:inset 0 2px 6px rgba(0,0,0,.45)}
  .pf-lcdsvg{width:100%;height:100%}
  .pf-lcdsvg .on{fill:#151a15}.pf-lcdsvg .off{fill:rgba(20,30,20,.035)}
  .pf-lcdsvg text{font:700 8.5px Arial}.pf-lcdsvg .lon{fill:#151a15}.pf-lcdsvg .loff{fill:rgba(20,30,20,.12)}
  .pf-dev .enet{position:absolute;left:20px;top:122px;font:9px Arial;color:#8A9098}
  .pf-dev .fault{position:absolute;left:150px;top:124px;font:700 11px Arial;color:#C9CDD2;display:flex;align-items:center;gap:6px}
  .pf-dev .fault i{width:11px;height:11px;border-radius:50%;background:#4A2A28;box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}
  .pf-dev .fault i.on{background:#FF3B2E;box-shadow:0 0 10px #FF3B2E}
  .pf-dev .pot{position:absolute;right:22px;top:40px;width:58px;height:58px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#3a3d42,#0b0c0e 70%);border:2px solid #6E747C;cursor:ns-resize}
  .pf-dev .pot::after{content:"";position:absolute;left:27px;top:6px;width:4px;height:20px;background:#E8E8E8;border-radius:2px;transform-origin:2px 23px;transform:rotate(var(--a,-135deg))}
  .pf-dev .pot .marks{position:absolute;inset:-9px;border-radius:50%;border:2px dashed rgba(201,205,210,.35)}
  .pf-dev .pad{position:absolute;left:30px;top:150px;width:148px;height:148px}
  .pf-dev .pad button,.pf-dev .kb{position:absolute;border:0;cursor:pointer;color:#fff;font:700 14px Arial;display:grid;place-items:center}
  .pf-dev .pad .ring{position:absolute;inset:0;border-radius:50%;background:#2E6FBF;box-shadow:inset 0 -4px 0 rgba(0,0,0,.25)}
  .pf-dev .pad .q{width:74px;height:74px;background:transparent}
  .pf-dev .pad .q:active,.pf-dev .pad .q.dn{background:rgba(255,255,255,.18)}
  .pf-dev .pad .up{left:37px;top:0;border-radius:50% 50% 0 0;width:74px;height:46px}
  .pf-dev .pad .dw{left:37px;bottom:0;border-radius:0 0 50% 50%;width:74px;height:46px}
  .pf-dev .pad .es{left:0;top:37px;border-radius:50% 0 0 50%;width:46px;height:74px}
  .pf-dev .pad .en{right:0;top:37px;border-radius:0 50% 50% 0;width:46px;height:74px}
  .pf-dev .pad .sel{left:49px;top:49px;width:50px;height:50px;border-radius:50%;background:#9AA3AD;color:#fff;box-shadow:0 0 0 4px #1A1C20}
  .pf-dev .pad .sel:active,.pf-dev .pad .sel.dn{filter:brightness(.85)}
  .pf-dev .pad .gap{position:absolute;inset:0;pointer-events:none;background:linear-gradient(45deg,transparent 48.5%,#1A1C20 48.5% 51.5%,transparent 51.5%),linear-gradient(-45deg,transparent 48.5%,#1A1C20 48.5% 51.5%,transparent 51.5%);border-radius:50%}
  .pf-dev .kstart{right:28px;top:150px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#2fc066,#167a3a);box-shadow:0 3px 0 #0c4a22}
  .pf-dev .kstart::after{content:"";width:4px;height:16px;background:#fff;border-radius:2px}
  .pf-dev .krev{right:84px;top:222px;width:38px;height:30px;border-radius:12px;background:#5A6068;box-shadow:0 3px 0 #2d3136;font-size:15px}
  .pf-dev .kstop{right:22px;top:206px;width:52px;height:52px;border-radius:8px;background:#C8342A;box-shadow:0 3px 0 #7a1d16}
  .pf-dev .kstop::after{content:"";width:20px;height:20px;border:3px solid #fff;border-radius:50%}
  .pf-dev .kb:active,.pf-dev .kb.dn{transform:translateY(2px);box-shadow:none}
  .pf-dev .tag{position:absolute;left:0;right:0;top:308px;text-align:center;font:10px Arial;color:#7d838b}
  .pf-side{display:grid;gap:12px}
  .pf-side .box{background:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 1px 2px rgba(31,42,55,.06),0 4px 14px rgba(31,42,55,.05)}
  .pf-side h4{margin:0 0 8px;color:var(--navy,#1E3A5F);font-size:16px}
  .pf-st{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .pf-st div{background:var(--bg,#EEF2F7);border-radius:10px;padding:6px 10px}
  .pf-st b{display:block;font-size:20px;color:var(--navy,#1E3A5F);font-variant-numeric:tabular-nums}
  .pf-st span{font-size:12px;color:var(--muted,#5B6B80);text-transform:uppercase;letter-spacing:.04em}
  .pf-now{font-size:15px}
  .pf-now code{font-family:"Courier New",monospace;font-weight:700;color:var(--orange,#E87722)}
  .pf-msg{border-radius:10px;padding:8px 12px;font-size:14px;background:var(--bg,#EEF2F7)}
  .pf-msg.bad{background:#F8E6E4;color:#7E2A22}.pf-msg.ok{background:#E3F3EF;color:#1F5F54}
  .pf-ck{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}
  .pf-ck li{display:flex;gap:8px;align-items:flex-start;font-size:14px;padding:4px 6px;border-radius:8px}
  .pf-ck li i{flex:0 0 20px;height:20px;border-radius:50%;border:2px solid #9AA5B1;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:700;color:#fff}
  .pf-ck li.ok{background:#E3F3EF}.pf-ck li.ok i{background:#2E8B7A;border-color:#2E8B7A}
  .pf-next{max-width:310px;margin:10px auto 0;background:#FFF4EA;border:2px solid #E87722;border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.45}
  .pf-next b.h{display:block;color:#B35A12;font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
  .pf-next ol{margin:4px 0 0;padding-left:20px}.pf-next li{margin:2px 0}
  .pf-next .x{float:right;border:0;background:none;cursor:pointer;color:#B35A12;font-weight:700}
  .pf-ck li a{margin-left:auto;white-space:nowrap;font-size:12px;color:#2F6DB5;cursor:pointer;text-decoration:underline}
  .pf-ck li.sel{outline:2px solid #E87722}
  .pf-potpop{position:fixed;z-index:2000;width:190px;background:#fff;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.35);padding:10px 12px;font:14px Calibri,Arial,sans-serif;color:#1F2A37}
  .pf-potpop .pp-h{display:flex;justify-content:space-between;align-items:center;color:#1E3A5F}
  .pf-potpop .pp-x{border:0;background:none;font-size:16px;cursor:pointer;color:#5B6B80}
  .pf-potpop .pp-b{display:flex;gap:14px;align-items:center;margin:8px 0}
  .pf-potpop input{writing-mode:vertical-lr;direction:rtl;height:190px;width:34px;accent-color:#E87722;cursor:ns-resize}
  .pf-potpop .pp-v b{display:block;font-size:26px;color:#1E3A5F}
  .pf-potpop .pp-v span{font-size:13px;color:#5B6B80}
  .pf-potpop .pp-n{font-size:12px;color:#5B6B80}
  .pf-compact{display:grid;gap:10px}
  .pf-compact .pf-next{max-width:none;margin:0}
  .pf-compact .pf-st b{font-size:17px}
  .pf-hint3d{font-size:13px;color:#1E3A5F;background:#E8F0FA;border-radius:10px;padding:8px 10px}
  .pf-keys{font-size:13px;color:var(--muted,#5B6B80);line-height:1.5}
  .pf-keys kbd{display:inline-block;min-width:22px;text-align:center;border:1px solid #B9C2CC;border-radius:5px;padding:0 4px;background:#fff;font:700 12px Arial;color:#1E3A5F}
  `;
  const COMPACT = `<div class="pf-side pf-compact">
        <div class="pf-hint3d">Opere as <b>teclas do inversor no painel 3D</b>: clique nelas como no equipamento real. No teclado azul, <b>◄ = Esc</b> e <b>► = ↵ (Enter)</b>. O botão redondo ao lado do display é o <b>potenciômetro</b>: clique nele para abrir a barra deslizante. A tecla ⇆ é a reversão.</div>
        <div class="pf-next" id="pfNext"></div>
        <div class="box pf-now" id="pfNow"></div>
        <div class="pf-msg" id="pfMsg"></div>
        <div class="box"><div class="pf-st" id="pfSt"></div>
          <label class="note" style="display:block;margin-top:8px">Potenciômetro do inversor (o botão redondo ao lado do display): <b id="pfPotT"></b></label>
          <input type="range" id="pfPotR" min="0" max="100" step="1" style="width:100%"></div>
        <div class="box"><h4>Partida da bomba</h4>
          <div class="dv-sel" id="pfMode"></div>
          <div class="note" style="margin-top:6px" id="pfModeNote"></div></div>
        <div class="box"><div class="seg" id="pfTab"><button data-t="a1">Atividade 1 · IHM</button><button data-t="a2">Atividade 2 · CLP</button></div>
          <div id="pfCk"></div>
          <div class="row" style="margin-top:10px;gap:8px"><button class="btn" id="pfDefaults" title="Equivale a P053 = 2 (Factory Rset)">Restaurar padrão de fábrica</button></div></div>
      </div>`;
  function mount(el, opts = {}) {
    if (!document.getElementById("pf525css")) { const s = document.createElement("style"); s.id = "pf525css"; s.textContent = CSS; document.head.appendChild(s); }
    hosts = hosts.filter(h => h !== el && document.contains(h)); hosts.push(el);
    el.innerHTML = opts.compact ? COMPACT : `<div class="pf-wrap">
      <div>
        <div class="pf-dev2" id="pfDev"><canvas id="pfCanvas" width="400" height="855"></canvas>
          ${["up", "down", "esc", "enter", "sel"].map(k => `<button class="hk" data-k="${k}" style="${hot(k)}" aria-label="${{ up: "Seta para cima", down: "Seta para baixo", esc: "Esc", enter: "Enter", sel: "Sel" }[k]}"></button>`).join("")}
          <button class="hk" data-k="start" style="${hot("start")}" aria-label="Start (partir)" title="Start"></button>
          <button class="hk" data-k="stop" style="${hot("stop")}" aria-label="Stop (parar / limpar falha)" title="Stop"></button>
          <button class="hk" data-k="rev" style="${hot("rev")}" aria-label="Reversão" title="Reversão"></button>
          <div class="hk potz" id="pfPot" style="${hot("pot")}" title="Potenciômetro: clique para abrir a barra deslizante"></div>
        </div>
        <div class="pf-keys" style="max-width:310px;margin:8px auto 0">No teclado azul, <kbd>◄</kbd> = <b>Esc</b> e <kbd>►</kbd> = <b>↵ Enter</b>. <kbd>Esc</kbd> volta um nível · <kbd>▲</kbd><kbd>▼</kbd> navegam ou mudam o valor · <kbd>Sel</kbd>/<kbd>↵</kbd> entram · em edição, <kbd>Sel</kbd> troca o dígito e <kbd>↵</kbd> salva.</div>
        <div class="pf-next" id="pfNext"></div>
      </div>
      <div class="pf-side">
        <div class="box"><h4>Partida da bomba</h4>
          <div class="dv-sel" id="pfMode"></div>
          <div class="note" style="margin-top:6px" id="pfModeNote"></div></div>
        <div class="box"><div class="pf-st" id="pfSt"></div></div>
        <div class="box pf-now" id="pfNow"></div>
        <div class="pf-msg" id="pfMsg"></div>
        <div class="box"><div class="seg" id="pfTab"><button data-t="a1">Atividade 1 · IHM</button><button data-t="a2">Atividade 2 · CLP</button></div>
          <div id="pfCk"></div>
          <div class="row" style="margin-top:10px;gap:8px"><button class="btn" id="pfDefaults" title="Equivale a P053 = 2 (Factory Rset)">Restaurar padrão de fábrica</button><span class="note">Melhor fazer pela IHM: P053 = 2.</span></div></div>
      </div></div>`;
    // teclas (com repetição ao segurar ▲▼)
    el.querySelectorAll("[data-k]").forEach(b => {
      let rep = null;
      const go = () => { st.hit = { k: b.dataset.k, t: performance.now() }; key(b.dataset.k); paint(); };
      b.addEventListener("pointerdown", e => { e.preventDefault(); b.classList.add("dn"); go(); if (b.dataset.k === "up" || b.dataset.k === "down") rep = setTimeout(function r() { go(); rep = setTimeout(r, 90); }, 450); });
      const end = () => { b.classList.remove("dn"); clearTimeout(rep); rep = null; };
      b.addEventListener("pointerup", end); b.addEventListener("pointerleave", end);
    });
    // potenciômetro
    const pr = el.querySelector("#pfPotR"); if (pr) pr.oninput = () => { st.pot = +pr.value / 100; paint(); };
    const pot = el.querySelector("#pfPot") || document.createElement("div");
    let drag = null;
    void drag; pot.addEventListener("click", e => { st.hit = { k: "pot", t: performance.now() }; potSlider(e.clientX, e.clientY); });
    pot.addEventListener("wheel", e => { e.preventDefault(); st.pot = Math.max(0, Math.min(1, st.pot + (e.deltaY < 0 ? 0.02 : -0.02))); paint(); }, { passive: false });
    el.querySelectorAll("#pfTab button").forEach(b => b.onclick = () => { tab = b.dataset.t; paint(); });
    const bd = el.querySelector("#pfDefaults");
    let armed = 0;
    bd.onclick = () => {
      if (running()) { msg("Pare o inversor antes de restaurar os parâmetros.", "bad"); paint(); return; }
      if (Date.now() - armed > 3000) { armed = Date.now(); bd.textContent = "Clique de novo para confirmar"; setTimeout(() => { bd.textContent = "Restaurar padrão de fábrica"; }, 3000); return; }
      armed = 0; bd.textContent = "Restaurar padrão de fábrica"; st.par = defaults(); st.ach45 = st.stopAfter45 = st.ranDI = false; changed(); msg("Parâmetros no padrão de fábrica.", "ok"); paint();
    };
    if (!timer) timer = setInterval(() => { if (hosts.some(h => h.offsetParent)) paint(); }, 120);
    paint();
  }
  function paint() { hosts = hosts.filter(h => document.contains(h)); for (const h of hosts) if (h.offsetParent || h === hosts[hosts.length - 1]) paintHost(h); }
  function paintHost(host) {
    const $ = s => host.querySelector(s);
    const L = lcd(), on = Math.floor(performance.now() / 350) % 2 === 0;
    if ($("#pfLcd")) $("#pfLcd").innerHTML = lcdSVG({ ...L, blink: blinkCell(L) }, on);
    const cv = $("#pfCanvas"); if (cv) drawFace(cv.getContext("2d"), cv.width, cv.height);
    if ($("#pfFault")) $("#pfFault").classList.toggle("on", !!st.fault && on);
    if ($("#pfPot")) $("#pfPot").style.setProperty("--a", (-135 + 270 * st.pot) + "deg");
    const pr = $("#pfPotR"); if (pr && document.activeElement !== pr) pr.value = Math.round(st.pot * 100);
    if ($("#pfPotT")) $("#pfPotT").textContent = Math.round(st.pot * 100) + " %";
    if (window.DRV) window.DRV.renderSel($("#pfMode"));
    const sel = window.DRV ? window.DRV.sel : "pf525";
    $("#pfModeNote").innerHTML = sel === "pf525"
      ? "O motor da bomba é alimentado por <b>este inversor</b> (PowerFlex 525): rampa de aceleração e velocidade ajustável. A vazão acompanha a rotação."
      : sel === "direta" ? "O motor parte <b>direto na rede</b> pelo contator K1: 60 Hz na hora, sem rampa. Os inversores ficam fora do circuito."
      : `A bomba está em <b>${window.DRV.names[sel]}</b>. Este inversor pode ser parametrizado, mas não aciona o motor.`;
    const sit = st.fault ? `<span style="color:#B83A2E">FALHA F${String(st.fault).padStart(3, "0")}</span>` : st.tune > 0 ? "Autotune" : running() ? (st.accel ? "Acelerando" : st.decel ? "Desacelerando" : "Rodando") : "Parado";
    const rpm = Math.round(Math.abs(st.n) * (P("P036") || 1750));
    $("#pfSt").innerHTML = `<div><span>Situação</span><b>${sit}</b></div><div><span>b001 saída</span><b>${st.outF.toFixed(2)} Hz</b></div><div><span>b003 corrente</span><b>${st.I.toFixed(2)} A</b></div>
      <div><span>b002 pedida</span><b>${st.cmdF.toFixed(2)} Hz</b></div><div><span>Partida (P046)</span><b style="font-size:15px">${SRC[P("P046")] || P("P046")}</b></div><div><span>Motor</span><b>${rpm} rpm</b></div>`;
    // o que o display está mostrando, em texto (como o QuickView do PF525 faria)
    const d = curDef(); let now = "";
    if (st.fault && ui.mode === "disp") now = `Display: <code>F${String(st.fault).padStart(3, "0")}</code> · <b>${FAULTS[st.fault] || "falha"}</b>. Aperte Stop para limpar.`;
    else if (ui.mode === "disp") { const b = bList()[ui.disp]; now = `Display: <code>${b.c}</code> [${b.n}] — ${b.pt} <span class="note">(Esc entra no menu de parâmetros)</span>`; }
    else if (ui.mode === "group") now = `Escolhendo o <b>grupo</b> (${ui.grp}): ${{ b: "Basic Display · leituras", P: "Basic Program · programação básica", t: "Terminal Block · bornes", A: "Advanced Program · avançados", M: "Modified · só os alterados" }[ui.grp]}. ▲▼ trocam, ↵ entra.`;
    else if (d) { const v = ui.mode === "edit" ? ui.ed.v : val(d.c); now = `<code>${d.c}</code> <b>[${d.n}]</b> = <b>${fmtVal(d, v)}</b>${d.opts && d.opts[v] != null ? " · “" + d.opts[v] + "”" : d.u ? " " + uName(d.u) : ""}${ui.mode === "edit" ? " <b style=\"color:#E87722\">(editando)</b>" : ""}<div class="note" style="margin-top:4px">${d.pt}${d.ro ? "" : ` Faixa ${d.min}–${d.max}${d.u ? " " + uName(d.u) : ""} · padrão ${fmtVal(d, d.d)}.`}${d.stop ? " <b>Só altera com o inversor parado.</b>" : ""}</div>`; }
    $("#pfNow").innerHTML = now;
    $("#pfNext").innerHTML = ui.guide ? guideHTML(ui.guide) : `<b class="h">Próxima tecla</b>${nextHint()}`;
    const gx = $("#pfNext .x"); if (gx) gx.onclick = () => { ui.guide = null; paint(); };
    const m = $("#pfMsg"); m.className = "pf-msg " + ui.msgKind; m.innerHTML = ui.msg || "Use a IHM como no inversor real. O checklist confere os valores <b>gravados</b> no inversor.";
    host.querySelectorAll("#pfTab button").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
    const ex = EX[tab]; const done = ex.items.filter(i => i[1]()).length;
    $("#pfCk").innerHTML = `<div style="margin-top:8px"><b>${ex.t}</b> · ${done}/${ex.items.length}</div><div class="note">${ex.note} Clique em <b>como fazer</b> para ver o caminho das teclas.</div><ul class="pf-ck">${ex.items.map(i => { const ok = i[1](), m = i[0].match(/\b([PtA]\d{3})\b/), c = m ? m[1] : ""; return `<li class="${ok ? "ok" : ""}${c && ui.guide === c ? " sel" : ""}"><i>${ok ? "✓" : ""}</i><span>${i[0]}</span>${c ? `<a data-g="${c}">como fazer ›</a>` : ""}</li>`; }).join("")}</ul>`;
    host.querySelectorAll("#pfCk [data-g]").forEach(a => a.onclick = () => { ui.guide = a.dataset.g; paint(); const n = host.querySelector("#pfNext"); if (n && n.scrollIntoView) n.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
  }
  // dica da próxima tecla, conforme o ponto da navegação
  function nextHint() {
    const d = curDef();
    if (st.fault) return "Inversor em <b>falha</b>: aperte o botão vermelho <kbd>O</kbd> (Stop) para limpar.";
    if (ui.mode === "disp") return "Esta é a tela de <b>leitura</b>. Para <b>programar</b>: aperte <kbd>Esc</kbd> <b>2 vezes</b> (a letra <b>b</b> fica piscando), depois <kbd>▲</kbd> até aparecer <b>P</b> e <kbd>↵</kbd>.";
    if (ui.mode === "pnum" && ui.grp === "b") return "Você está nas <b>leituras</b> (grupo b, só visualizar). Aperte <kbd>Esc</kbd> (a letra pisca) e <kbd>▲</kbd> até <b>P</b>; depois <kbd>↵</kbd>.";
    if (ui.mode === "group") return "A <b>letra do grupo</b> está piscando: <kbd>▲</kbd><kbd>▼</kbd> trocam (b → P → t → A → M) e <kbd>↵</kbd> entra. Os dados do motor e as rampas ficam no grupo <b>P</b>.";
    if (ui.mode === "pnum") return `<kbd>▲</kbd><kbd>▼</kbd> escolhem o parâmetro (agora <b>${d.c}</b>) e <kbd>↵</kbd> mostra o valor. <kbd>Esc</kbd> volta para os grupos.`;
    if (ui.mode === "view") return d.ro ? "Valor só de leitura. <kbd>Esc</kbd> volta para a lista." : `Mostrando o valor de <b>${d.c}</b>. Aperte <kbd>↵</kbd> (ou <kbd>Sel</kbd>) para <b>editar</b>; <kbd>Esc</kbd> volta para a lista.`;
    if (ui.mode === "edit") return `<b>Editando ${d.c}</b> (PROGRAM aceso): <kbd>▲</kbd><kbd>▼</kbd> mudam o <b>dígito que pisca</b>, <kbd>Sel</kbd> passa para o dígito da esquerda, <kbd>↵</kbd> <b>salva</b> e <kbd>Esc</kbd> cancela.`;
    return "";
  }
  // passo a passo das teclas até um parâmetro (ex.: P041)
  function guideHTML(code) {
    const dd = BY[code]; if (!dd) return "";
    const g = code[0], gi = GROUPS.indexOf(g), list = groupList(g), i = list.indexOf(dd), first = list[0].c;
    const ex = dd.opts ? ` (${Object.entries(dd.opts).slice(0, 3).map(([k, v]) => k + " = " + v).join(", ")}…)` : "";
    return `<button class="x" title="Fechar">✕</button><b class="h">Como chegar em ${code} [${dd.n}]</b><ol>
      <li>Na tela inicial (valor em Hz), aperte <kbd>Esc</kbd> <b>2 vezes</b>: a letra do grupo pisca.</li>
      <li>${gi > 0 ? `Aperte <kbd>▲</kbd> <b>${gi}×</b> até aparecer <b>${g}</b>.` : "Fique no grupo <b>b</b>."}</li>
      <li><kbd>↵</kbd> entra no grupo (aparece <b>${first}</b>).</li>
      <li>${i > 0 ? `Aperte <kbd>▲</kbd> <b>${i}×</b> até <b>${code}</b>.` : `Você já está em <b>${code}</b>.`}</li>
      <li><kbd>↵</kbd> mostra o valor; <kbd>↵</kbd> de novo para <b>editar</b> (acende PROGRAM)${dd.stop ? " — com o motor <b>parado</b>" : ""}.</li>
      <li><kbd>▲</kbd><kbd>▼</kbd> mudam o dígito que pisca (começa pelo da direita); <kbd>Sel</kbd> passa para o dígito da esquerda.${ex}</li>
      <li><kbd>↵</kbd> <b>salva</b>. Depois <kbd>Esc</kbd> volta para a lista.</li></ol>`;
  }
  function setMode(m) {
    if (m !== "direta" && m !== "inversor") return;
    if (window.DRV) { window.DRV.setSel(m === "inversor" ? "pf525" : "direta"); return; }
    if (m === mode) return;
    mode = m; if (m === "direta") st.run = false;
    msg(m === "inversor" ? "Seletora em <b>INVERSOR</b>: o motor da bomba agora é alimentado pelo PowerFlex 525." : "Seletora em <b>DIRETA</b>: o motor parte pelo contator K1, direto na rede.", "");
    changed(); paint();
  }

  window.PF525 = {
    step, press: k => { key(k); paint(); }, mount, paint, pressAt, hitKey, potSlider, lcd: () => { const L = lcd(); return { ...L, blink: blinkCell(L) }; }, paint3D,
    key: "pf525", name: "PowerFlex 525", model: "25B-B5P0N104 · 200–240 V · 5,0 A", FW, FH,
    get mode() { return curMode(); }, setMode, onChange: f => listeners.push(f),
    get state() { return st; }, param: c => val(c), setParam: (c, v) => { if (c in st.par) { st.par[c] = v; if (!(window.DRV && window.DRV._batch)) changed(); } }, flush: changed,
    get faulted() { return !!st.fault; }, trip: () => { setFault(7); changed(); }, defs: DEFS, defaults: () => { st.par = defaults(); changed(); },
  };
})();
