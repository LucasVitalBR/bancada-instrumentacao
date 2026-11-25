/* Modo comando direto: botoeira LIGA (NA) + DESLIGA (NF) + contator K1 com selo.
   Ativo quando o CLP está em STOP. Chamado por app-3d.js (stepLevel/stepProc/renderHud). */
(function () {
  "use strict";
  const MD = window.MD = {
    k1: false,        // bobina do contator K1 (selo)
    liga: false,      // botão LIGA pressionado (NA, momentâneo)
    desl: false,      // botão DESLIGA pressionado (NF abre)
    auto: false,      // chave AUTO: LSL (nível baixo) dá a partida
    lsh: false, lsl: false, msg: "", _t: 0, _box: null
  };
  try { MD.auto = localStorage.getItem("nivel-md-auto") === "1"; } catch (e) {}
  const active = () => !(window.PLC && window.PLC.run);
  MD.active = active;

  // Circuito de comando: L1 → DESLIGA(NF) → [LIGA(NA) ‖ selo K1] → LSH(NF) → bobina K1 → N
  MD.level = function (L, io) {
    MD.lsl = !!io.X[0]; MD.lsh = !!io.X[1];
    // modo demonstração: enche até a boia superior (LSH), abre o dreno e esvazia até a boia inferior (LSL), e recomeça sozinho
    if (MD.demo) {
      if (MD._init) { MD._init = false; L.drainPct = 100; L.drain = MD.lsh; MD.k1 = !MD.lsh; }
      MD.auto = true;                                           // AUTO: o LSL dá a partida
      if (MD.lsh) L.drain = true; else if (MD.lsl) L.drain = false;
    } else if (MD._stop) { MD._stop = false; L.drain = false; L.drainPct = 30; MD.auto = MD._autoPrev; }
    const lshOpen = MD.lsh;                                   // LSH atuado abre o contato NF
    const start = MD.liga || (MD.auto && MD.lsl);             // LIGA (NA) ou LSL em AUTO
    const was = MD.k1;
    MD.k1 = !MD.desl && !MD.emerg && !lshOpen && (start || MD.k1);
    if (was && !MD.k1) MD.msg = lshOpen ? "LSH atuou: abriu o contato NF e desenergizou a bobina K1. O selo caiu." : "DESLIGA abriu o circuito: K1 desenergizou e o selo caiu.";
    if (!was && MD.k1) MD.msg = MD.liga ? "LIGA fechou: K1 energizou e o contato de selo (13-14) manteve a bobina ligada." : "LSL (nível baixo) deu a partida em AUTO: K1 selou.";
    if (!was && !MD.k1 && MD.liga && lshOpen) MD.msg = "Partida bloqueada: o LSH (NF) está aberto. Esvazie o tanque (abra o dreno).";
    L.pump = MD.k1; L.trip = lshOpen && !MD.k1;
  };

  // Resistência com termostato (TSH-104 protege; ajuste do termostato = setpoint)
  MD.heat = function (P) {
    if (!P.run) return false;
    return P.T < P.sp - 1 ? true : P.T > P.sp + 1 ? false : !!P.ctrl;
  };

  const on = (c, v) => c ? "#2EE07A" : "#8FA3BA";
  function svg() {
    const k = MD.k1, nf = !MD.desl, lshOk = !MD.lsh;
    const w1 = nf, w2 = w1 && (MD.liga || k || (MD.auto && MD.lsl)), w3 = w2 && lshOk;
    return `<svg viewBox="0 0 300 118" style="width:100%;margin-top:6px;background:rgba(255,255,255,.06);border-radius:6px" font-family="Courier New" font-size="9" fill="#fff">
<text x="4" y="12">L1</text><line x1="20" y1="9" x2="296" y2="9" stroke="${on(1)}"/>
<line x1="24" y1="9" x2="24" y2="40" stroke="${on(1)}"/>
<text x="6" y="36" fill="#fff"></text>
<rect x="24" y="40" width="40" height="18" fill="none" stroke="${on(nf)}"/><text x="28" y="52">S0 NF</text>
<line x1="64" y1="49" x2="90" y2="49" stroke="${on(w1)}"/>
<rect x="90" y="40" width="48" height="18" fill="none" stroke="${on(w2)}"/><text x="94" y="52">S1 LIGA</text>
<rect x="90" y="68" width="48" height="18" fill="none" stroke="${on(w2 && k)}"/><text x="94" y="80">K1 selo</text>
<line x1="90" y1="49" x2="90" y2="77" stroke="${on(w1)}"/><line x1="138" y1="49" x2="150" y2="49" stroke="${on(w2)}"/><line x1="138" y1="77" x2="150" y2="77" stroke="${on(w2 && k)}"/><line x1="150" y1="49" x2="150" y2="77" stroke="${on(w2)}"/>
<line x1="150" y1="49" x2="164" y2="49" stroke="${on(w2)}"/>
<rect x="164" y="40" width="48" height="18" fill="none" stroke="${on(w3)}"/><text x="168" y="52">LSH NF</text>
<line x1="212" y1="49" x2="240" y2="49" stroke="${on(w3)}"/>
<circle cx="252" cy="49" r="12" fill="${k ? "#2EE07A" : "none"}" stroke="${on(k)}"/><text x="244" y="52" fill="${k ? "#000" : "#fff"}">K1</text>
<line x1="252" y1="61" x2="252" y2="100" stroke="${on(k)}"/><line x1="24" y1="100" x2="296" y2="100" stroke="#8FA3BA"/><text x="4" y="103">N</text>
<text x="4" y="116" fill="#FFB020">${MD.auto ? "AUTO: LSL fecha a partida em paralelo com LIGA" : "MANUAL: só LIGA dá a partida"}</text>
</svg>`;
  }

  const hud = () => { if (window.App3D && App3D.refreshHud) App3D.refreshHud(); };
  // aba CLP: escolha do modo e esquema do circuito de comando
  MD.render = function (box, quiet) {
    if (!box) return; MD._box = box;
    const a = active();
    box.innerHTML = `<div class="small">Modo de comando: <b>${a ? "Simulação sem programa (partida direta + K1)" : "Programa no ISPSoft (inversor)"}</b></div>
      <div class="row3"><button class="b3 ${a ? "pri" : ""}" id="mdDir" title="Opera a bancada sem programa no CLP">Simular sem programa</button><button class="b3 ${a ? "" : "pri"}" id="mdClp">ISPSoft + inversor</button></div>
      ${a ? `<div id="mdSvg">${svg()}</div><div class="small" id="mdMsg">${MD.msg}</div>` : ""}`;
    const g = id => box.querySelector(id);
    g("#mdDir").onclick = () => { if (window.ISP && window.ISP.active) window.ISP.disconnect(); if (window.DRV && window.DRV.sel !== "direta") window.DRV.setSel("direta"); if (window.PLC && window.PLC.run) window.PLC.setRun(false); else MD.render(box); hud(); };
    g("#mdClp").onclick = () => { if (window.DRV && window.DRV.sel === "direta") window.DRV.setSel("pf525"); if (window.ISP && !window.ISP.active) window.ISP.connect(); };
  };
  // painel 3D: atalhos LIGA / DESLIGA / AUTO do comando direto (só no modo sem programa)
  MD.renderCtl = function (box) {
    if (!box) return;
    if (!active()) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="row3"><button class="b3" id="mdLiga">LIGA (NA)</button><button class="b3" id="mdDesl">DESLIGA (NF)</button><button class="b3 ${MD.auto ? "on" : ""}" id="mdAuto">AUTO: ${MD.auto ? "sim" : "não"}</button></div>`;
    const g = id => box.querySelector(id);
    const hold = (el, key) => { const d = () => { MD[key] = true; }, u = () => { MD[key] = false; }; el.onpointerdown = d; el.onpointerup = u; el.onpointerleave = u; el.onpointercancel = u; };
    hold(g("#mdLiga"), "liga"); hold(g("#mdDesl"), "desl");
    g("#mdAuto").onclick = () => { MD.auto = !MD.auto; try { localStorage.setItem("nivel-md-auto", MD.auto ? "1" : "0"); } catch (e) {} MD.renderCtl(box); };
  };
  MD.refresh = function (dt) {
    MD._t += dt; if (MD._t < 0.25) return; MD._t = 0;
    const b = MD._box; if (!b || !b.isConnected || !active()) return;
    const s = b.querySelector("#mdSvg"), m = b.querySelector("#mdMsg");
    if (s) s.innerHTML = svg(); if (m) m.textContent = MD.msg.replace(/<[^>]+>/g, "");
  };

  // botão "Simular sem programa" da bancada 3D: liga/desliga a demonstração
  MD.toggleDemo = function () {
    if (!MD.demo) {
      if (window.ISP && window.ISP.active) window.ISP.disconnect();
      if (window.DRV && window.DRV.sel !== "direta") window.DRV.setSel("direta");
      if (window.PLC && window.PLC.run) window.PLC.setRun(false);
      MD._autoPrev = MD.auto; MD._init = true; MD._stop = false; MD.demo = true; MD.auto = true;
    } else { MD.demo = false; MD._stop = true; MD.auto = MD._autoPrev; }
    if (window.App3D && App3D.refreshHud) App3D.refreshHud();
    return MD.demo;
  };

  // atalhos de teste por texto
  MD.press = function (b, on) { MD[b] = !!on; };
})();
