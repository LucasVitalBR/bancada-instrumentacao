/* Modo ISPSoft: o programa roda no simulador do ISPSoft (via ponte.js, Modbus ASCII na porta do driver Simulator do COMMGR).
   A página faz o papel do processo: envia as entradas (boias, botões, TSH, falha do inversor, temperatura) e lê as saídas (Y) e a referência de velocidade.
   Cada sinal tem endereço (vazio = não usado, a página não escreve nele) e o tipo de contato ligado ao CLP: NA (X = 1 quando acionado) ou NF (X = 1 em repouso). */
(function () {
  "use strict";
  const KEY = "nivel-isp-cfg-v4";
  // padrão = programa "Controle_Tanque" da aula: X0 emergência (NF), X1 LIGA, X2 seletora da resistência, X3 DESLIGA, X4 = boia baixa (fecha com água acima), X5 = boia alta, X2/X3 = liga/desliga da resistência; Y2 = bomba, Y3 = tanque cheio, Y0 = resistência
  const DEF = {   // preenchimento do programa da aula (só aplicado por "Montar automaticamente" ou pelo botão de padrão)
    port: 10004, dTemp: 1111, dRef: 1116, dSp: 200, dLevel: 1110,
    x: { EMERG: { n: 0, nf: true }, LIGA: { n: 1, nf: false }, DESL: { n: 2, nf: false }, SELRES: { n: 3, nf: false }, LSL: { n: 4, nf: false }, LSH: { n: 5, nf: false }, AUTO: { n: null, nf: false }, TSH: { n: null, nf: false }, FALHA: { n: null, nf: false } },
    y: { BOMBA: 2, VY: 2, RES: 0, SINAL: 3, ALARME: null } };
  const LBL = { LSL: "Boia baixa LSL", LSH: "Boia alta LSH", EMERG: "Botão de emergência", LIGA: "Botão LIGA", DESL: "Botão DESLIGA", SELRES: "Seletora da resistência", AUTO: "Chave AUTO", TSH: "Termostato TSH-104", FALHA: "Falha do inversor", BOMBA: "Bomba / marcha do inversor", VY: "Solenoide VY-01 (abre com a bomba)", RES: "Resistência", SINAL: "Sinaleiro", ALARME: "Lâmpada de alarme" };
  const XIDX = { EMERG: 0, SELRES: 6, LSL: 0, LSH: 1, LIGA: 2, DESL: 3, AUTO: 4, TSH: 5, FALHA: 7 }, YIDX = { BOMBA: 0, VY: 1, ALARME: 2, SINAL: 3, RES: 4 };
  const EMPTY = () => ({ port: DEF.port, dTemp: null, dRef: null, dSp: null, dLevel: null,
    x: Object.fromEntries(Object.keys(DEF.x).map(k => [k, { n: null, nf: false }])), y: Object.fromEntries(Object.keys(DEF.y).map(k => [k, null])) });
  const ISP = window.ISP = { active: false, busy: false, ok: false, msg: "Desconectado.", cfg: EMPTY(), t: 0, n: 0, _box: null, manualX: {} };   // começa tudo vazio: o aluno configura
  // Persistência automática: a configuração do aluno fica no sessionStorage da aba (sobrevive a recarregar/F5; some ao fechar a guia). Nada é salvo em arquivo.
  const okN = v => Number.isInteger(v) && v >= 0 && v < 16 ? v : null, okD = v => Number.isInteger(v) && v >= 0 && v < 65536 ? v : null;
  function sanitize(j) {
    const c = EMPTY(); if (!j || typeof j !== "object") return c;
    c.port = Number.isInteger(+j.port) && +j.port > 0 && +j.port < 65536 ? +j.port : DEF.port;
    for (const k of ["dTemp", "dRef", "dSp", "dLevel"]) c[k] = okD(j[k]);
    for (const k in c.x) if (j.x && j.x[k]) c.x[k] = { n: okN(j.x[k].n), nf: !!j.x[k].nf };
    for (const k in c.y) if (j.y && k in j.y) c.y[k] = okN(j.y[k]);
    return c;
  }
  try { const j = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (j) ISP.cfg = sanitize(j); } catch (e) {}
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(ISP.cfg)); } catch (e) {} };
  const BASE = location.protocol === "file:" || !/^(localhost|127.0.0.1)$/.test(location.hostname) ? "http://localhost:8765" : "";   // página hospedada (Vercel) ou arquivo: a ponte roda no computador do aluno
  const post = (u, b) => fetch(BASE + "/api/" + u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(r => r.json());
  const PLCo = () => window.PLC;
  ISP.applyDefaults = () => { const p = ISP.cfg.port; ISP.cfg = JSON.parse(JSON.stringify(DEF)); ISP.cfg.port = p; ISP.manualX = {}; save(); ISP.render(); };   // programa da aula
  ISP.isEmpty = () => { const c = ISP.cfg; return Object.values(c.x).every(m => m.n == null) && Object.values(c.y).every(v => v == null) && [c.dTemp, c.dRef, c.dSp, c.dLevel].every(v => v == null); };
  ISP.autoFill = () => { if (ISP.isEmpty()) ISP.applyDefaults(); };   // Montar automaticamente: só preenche se o aluno ainda não configurou nada
  ISP.reset = ISP.applyDefaults;
  ISP.clear = () => { const p = ISP.cfg.port; ISP.cfg = EMPTY(); ISP.cfg.port = p; ISP.manualX = {}; save(); ISP.render(); };

  ISP.connect = async function () {
    ISP.msg = "Conectando…"; ISP.render();
    let r; try { r = await post("connect", { port: ISP.cfg.port }); } catch (e) {
      // ponte parada: tenta iniciá-la em segundo plano pelo atalho nivelponte: (registrado por REGISTRAR-INICIO-AUTOMATICO.bat)
      ISP.msg = "Iniciando a ponte em segundo plano…"; ISP.render();
      try { const a = document.createElement("a"); a.href = "nivelponte://iniciar"; document.body.appendChild(a); a.click(); a.remove(); } catch (e2) {}
      let up = false; for (let i = 0; i < 16 && !up; i++) { await new Promise(z => setTimeout(z, 750)); try { up = (await post("ping")).ok; } catch (e3) {} }
      if (up) { try { r = await post("connect", { port: ISP.cfg.port }); } catch (e4) { r = { ok: false, error: "a ponte iniciou, mas não respondeu; tente de novo" }; } }
      else r = { ok: false, error: "a ponte não iniciou. Execute REGISTRAR-INICIO-AUTOMATICO.bat (uma vez) ou INICIAR-PONTE.bat" };
    }
    if (!r.ok) { ISP.msg = r.error; ISP.active = false; ISP.render(); return; }
    const P = PLCo(); ISP._aoUsed = P.aoUsed; P.aoUsed = () => true;           // a referência de velocidade vem do programa do ISPSoft
    P.run = true; P.firstScan = false; P.io.Y.fill(false);
    ISP.active = true; ISP.ok = true; ISP.msg = "Conectado (porta " + ISP.cfg.port + "). O CLP precisa estar em RUN no ISPSoft."; ISP.render();
    if (window.App3D && App3D.refreshHud) App3D.refreshHud();
  };
  ISP.disconnect = async function () {
    ISP.active = false; ISP.ok = false; try { await post("disconnect"); } catch (e) {}
    const P = PLCo(); if (ISP._aoUsed) { P.aoUsed = ISP._aoUsed; ISP._aoUsed = null; }
    if (P.run) P.setRun(false);
    ISP.msg = "Desconectado."; ISP.render();
    if (window.App3D && App3D.refreshHud) App3D.refreshHud();
  };

  // chamado a cada passo da simulação (plcCycle): a troca de dados é assíncrona, ~8 por segundo
  ISP.cycle = function (dt, io) {
    io.X[2] = io.btn.X2; io.X[3] = !io.btn.X3; io.X[4] = io.btn.X4;           // botões, igual ao CLP interno (DESLIGA é NF)
    ISP.t += dt; if (ISP.busy || ISP.t < 0.12) return; ISP.t = 0;
    const c = ISP.cfg, x = {}, d = {}; ISP.sentX = ISP.sentX || {};
    for (const k in c.x) { const m = c.x[k]; if (m.n == null) continue; let v = !!io.X[XIDX[k]]; if (k === "LSL") v = !io.X[0]; if (k === "LIGA") v = !!io.btn.X2; if (k === "DESL") v = !!io.btn.X3; if (k === "EMERG") v = !!(window.App3D && App3D.ui.emerg); if (k === "SELRES") v = !!(window.App3D && App3D.ui.selRes); if (k === "AUTO") v = !!io.btn.X4; /* v = dispositivo acionado */ x[m.n] = m.nf ? !v : v; ISP.sentX[m.n] = x[m.n]; }
    for (const n in ISP.manualX) x[n] = ISP.manualX[n];                                // clique no endereço força o estado enviado ao CLP
    for (const n in ISP.sentX) if (!(n in x)) { x[n] = false; delete ISP.sentX[n]; }   // endereço que deixou de ser usado volta a 0 no CLP
    for (const n in x) ISP.sentX[n] = x[n];
    if (c.dTemp != null) d[c.dTemp] = io.D[1111] || 0;
    if (c.dLevel != null) d[c.dLevel] = io.D[1110] || 0;   // nível (LT-101, 0–10 kPa = 0..2000)
    if (c.dSp != null) d[c.dSp] = io.D[200] || 0;   // setpoint de temperatura vem do painel do simulador (10 = 1 °C)
    ISP.busy = true;
    post("xchg", { x, d, ry: 16, rd: c.dRef == null ? [] : [c.dRef] }).then(r => {
      ISP.busy = false; if (!ISP.active) return;
      if (!r.ok) { ISP.ok = false; ISP.msg = r.error; ISP.render(); return; }
      const wasOk = ISP.ok; ISP.ok = true; ISP.n++; ISP.lastY = r.y;
      for (const k in YIDX) io.Y[YIDX[k]] = c.y[k] == null ? false : !!r.y[c.y[k]];
      io.D[1116] = c.dRef == null ? 0 : (r.d[c.dRef] || 0);
      if (!wasOk) { ISP.msg = "Comunicando com o simulador."; ISP.render(); }
    }).catch(e => { ISP.busy = false; ISP.ok = false; ISP.msg = "a ponte parou de responder"; ISP.render(); });
  };

  // painel ao vivo de entradas (enviadas) e saídas (lidas) do simulador do ISPSoft
  function ioPanel() {
    const led = (lbl, v) => '<span style="display:inline-block;min-width:30px;margin:1px;padding:2px 3px;border-radius:4px;text-align:center;font:11px Courier New,monospace;background:' + (v ? "#2EE07A" : "#3a4350") + ';color:' + (v ? "#000" : "#cfd6de") + '">' + lbl + '</span>';
    const sx = ISP.sentX || {}, y = ISP.lastY || [], f = window.App3D ? App3D.force : {}, forced = Object.keys(f).filter(k => f[k] != null), io = PLCo().io;
    const input = i => { const v = Object.prototype.hasOwnProperty.call(ISP.manualX, i) ? ISP.manualX[i] : !!sx[i]; return '<button type="button" data-x="' + i + '" aria-pressed="' + v + '" title="Clique para alternar X' + i.toString(8) + ' ligado/desligado" style="display:inline-block;min-width:30px;margin:1px;padding:2px 3px;border:0;border-radius:4px;text-align:center;cursor:pointer;font:11px Courier New,monospace;background:' + (v ? "#2EE07A" : "#3a4350") + ';color:' + (v ? "#000" : "#cfd6de") + '">X' + i.toString(8) + '</button>'; };
    return '<div class="small" style="margin-top:6px">Entradas enviadas ao CLP · clique para alternar</div><div>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(input).join("") + '</div>' +
      '<div class="small" style="margin-top:4px">Saídas lidas do CLP</div><div>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(i => led("Y" + i.toString(8), y[i])).join("") + '</div>' +
      '<div class="small" style="margin-top:4px;color:var(--muted)">D' + ISP.cfg.dTemp + ' (temperatura) = ' + (io.D[1111] || 0) + ' · D' + ISP.cfg.dSp + ' (setpoint) = ' + (io.D[200] || 0) + ' · D' + ISP.cfg.dRef + ' (referência) = ' + (io.D[1116] || 0) + '</div>' +
      '<div class="small" style="margin-top:4px">Dica: clique nas boias e no termostato do 3D para forçar o contato.' + (forced.length ? ' <b>Forçados: ' + forced.join(", ") + '</b> <button class="b3" id="ispRel">Soltar</button>' : "") + '</div>';
  }
  ISP.render = function (box) {
    box = box || ISP._box; if (!box) return; ISP._box = box;
    const c = ISP.cfg, on = ISP.active, dis = on ? "disabled" : "", ST = "width:46px;color:#000;background:#fff";
    const oct = i => i.toString(8);
    const sel = (g, k, v) => '<select data-g="' + g + '" data-k="' + k + '" style="color:#000;background:#fff;width:64px"><option value=""' + (v == null ? " selected" : "") + '>—</option>' + Array.from({ length: 16 }, (_, i) => '<option value="' + i + '"' + (v === i ? " selected" : "") + '>' + g.toUpperCase() + oct(i) + '</option>').join("") + '</select>';
    const dupX = {}, dupY = {};
    for (const k in c.x) { const n = c.x[k].n; if (n != null) (dupX[n] = dupX[n] || []).push(k); }
    for (const k in c.y) { const n = c.y[k]; if (n != null) (dupY[n] = dupY[n] || []).push(k); }
    const bad = (g, n, k) => { const l = (g === "x" ? dupX : dupY)[n] || []; const o = l.filter(z => z !== k && !(g === "y" && ((z === "BOMBA" && k === "VY") || (z === "VY" && k === "BOMBA")))); return o.length ? ' <span style="color:#E0503C" title="mesmo endereço de ' + o.join(", ") + '">⚠ também em ' + o.join(", ") + '</span>' : ""; };
    const sym = nf => '<svg viewBox="0 0 36 22" width="34" height="21" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 16h9M25 16h9"/><circle cx="11" cy="16" r="1.8" fill="currentColor"/><circle cx="25" cy="16" r="1.8" fill="currentColor"/>' + (nf ? '<path d="M11 16 25 16M21 16l3-8"/>' : '<path d="M11 16 24 6"/>') + '</g></svg>';
    const rowX = k => '<tr><td>' + LBL[k] + '</td><td>' + sel("x", k, c.x[k].n) + ' <span class="ctsel" role="group" aria-label="Tipo de contato">' +
      '<button type="button" class="' + (c.x[k].nf ? "" : "on") + '" data-ct="NA" data-k="' + k + '" title="Contato aberto (NA): X = 1 quando o dispositivo é acionado">' + sym(false) + '<b>NA</b></button>' +
      '<button type="button" class="' + (c.x[k].nf ? "on" : "") + '" data-ct="NF" data-k="' + k + '" title="Contato fechado (NF): X = 1 em repouso, vai a 0 quando acionado">' + sym(true) + '<b>NF</b></button></span>' + (c.x[k].n == null ? "" : bad("x", c.x[k].n, k)) + '</td></tr>';
    const rowY = k => `<tr><td>${LBL[k]}</td><td>${sel("y", k, c.y[k])}${c.y[k] == null ? "" : bad("y", c.y[k], k)}</td></tr>`;
    box.innerHTML = `<div class="small">Programa no <b>ISPSoft</b> · <span style="color:${on ? (ISP.ok ? "#2EE07A" : "#E0503C") : "inherit"}">${ISP.msg}</span></div>
      <div class="row3"><label class="small">Porta <input type="number" id="ispPort" value="${c.port}" style="${ST};width:70px" ${dis}></label>
      <button class="b3 ${on ? "on" : "pri"}" id="ispBtn">${on ? "Desconectar" : "Conectar ao ISPSoft"}</button></div>
      <details open style="margin-top:4px"><summary class="small" style="cursor:pointer"><b>Mapa de E/S</b>: escolha o endereço de cada sinal (— = a página não usa). Endereços em octal, como no Delta: X0–X7, X10–X17. Em cada entrada escolha o contato ligado ao CLP: <b>NA</b> (X = 1 quando acionado) ou <b>NF</b> (X = 1 em repouso). Boias: acionada = boia levantada. Pode mudar com o CLP conectado.</summary>
      <table class="t3">${Object.keys(DEF.x).map(rowX).join("")}${Object.keys(DEF.y).map(rowY).join("")}
      <tr><td>Setpoint de temperatura (do painel, 10 = 1 °C)</td><td>D<input type="number" id="ispDs" value="${c.dSp == null ? '' : c.dSp}" placeholder="—" style="${ST};width:62px" ${dis}></td></tr>
      <tr><td>Nível (LT-101, 0–10 kPa = 0..2000)</td><td>D<input type="number" id="ispDl" value="${c.dLevel == null ? '' : c.dLevel}" placeholder="—" style="${ST};width:62px" ${dis}></td></tr>
      <tr><td>Temperatura (PT100, 10 = 1 °C)</td><td>D<input type="number" id="ispDt" value="${c.dTemp == null ? '' : c.dTemp}" placeholder="—" style="${ST};width:62px" ${dis}></td></tr>
      <tr><td>Referência de velocidade (0..4000)</td><td>D<input type="number" id="ispDr" value="${c.dRef == null ? '' : c.dRef}" placeholder="—" style="${ST};width:62px" ${dis}></td></tr></table>
      <button class="b3" id="ispRst" title="Preenche o mapa com o padrão do programa da aula (o mesmo que Montar automaticamente)">Preencher com o padrão da aula</button> <button class="b3" id="ispClr">Limpar tudo</button></details>
      ${on ? ioPanel() : ""}`;
    box.querySelectorAll("button[data-x]").forEach(b => b.onclick = () => { const n = +b.dataset.x, current = Object.prototype.hasOwnProperty.call(ISP.manualX, n) ? ISP.manualX[n] : !!(ISP.sentX && ISP.sentX[n]); ISP.manualX[n] = !current; ISP.render(); });
    const rel = box.querySelector("#ispRel"); if (rel) rel.onclick = () => { App3D.releaseForce(); ISP.render(); };
    box.querySelector("#ispBtn").onclick = () => on ? ISP.disconnect() : ISP.connect();
    box.querySelector("#ispRst").onclick = () => ISP.applyDefaults();
    box.querySelector("#ispClr").onclick = () => ISP.clear();
    box.querySelectorAll("select[data-k]").forEach(i => i.onchange = e => { const v = e.target.value === "" ? null : +e.target.value; if (i.dataset.g === "x") c.x[i.dataset.k].n = v; else c.y[i.dataset.k] = v; save(); ISP.render(); });
    box.querySelectorAll("button[data-ct]").forEach(b => b.onclick = () => { c.x[b.dataset.k].nf = b.dataset.ct === "NF"; save(); ISP.render(); });
    if (!on) {
      box.querySelector("#ispPort").onchange = e => { c.port = +e.target.value || DEF.port; save(); };
      box.querySelector("#ispDs").onchange = e => { c.dSp = e.target.value === "" ? null : Math.max(0, Math.floor(+e.target.value) || 0); save(); };
      box.querySelector("#ispDl").onchange = e => { c.dLevel = e.target.value === "" ? null : Math.max(0, Math.floor(+e.target.value) || 0); save(); };
      box.querySelector("#ispDt").onchange = e => { c.dTemp = e.target.value === "" ? null : Math.max(0, Math.floor(+e.target.value) || 0); save(); };
      box.querySelector("#ispDr").onchange = e => { c.dRef = e.target.value === "" ? null : Math.max(0, Math.floor(+e.target.value) || 0); save(); };
    }
  };
  // atualiza só a linha de status/Y lidos a cada ~0,5 s sem refazer os campos
  setInterval(() => { if (ISP.active && ISP._box && ISP._box.isConnected && !ISP._box.contains(document.activeElement)) ISP.render(); }, 600);
})();
