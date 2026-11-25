/* Gaveta "CLP" da Bancada 3D: imagem do DVP20SX2 (estreita e alta) com botões nos terminais de entrada (forçam X0–X7)
   e lâmpadas nos terminais de saída (Y0–Y5). O estado de cada entrada vem do mapa de E/S da aba CLP (NA/NF respeitado):
   uma entrada NF com o dispositivo em repouso já aparece acionada. Usa ISP.calcX e ISP.manualX (modo-ispsoft.js). */
(function () {
  "use strict";
  const css = `
#clpGav{position:absolute;left:10px;bottom:0;z-index:7;transform:translateY(100%);transition:transform .35s cubic-bezier(.2,.8,.2,1);pointer-events:none}
#clpGav.open{transform:translateY(0)}
#clpGav .gtab{pointer-events:auto;position:absolute;left:0;bottom:100%;display:flex;align-items:center;gap:6px;white-space:nowrap;background:#0F2236;color:#F5F6F8;border:1px solid #EE7A10;border-bottom:0;border-radius:10px 10px 0 0;padding:4px 16px;font:700 12px "IBM Plex Sans",system-ui,sans-serif;cursor:pointer;letter-spacing:.04em}
#clpGav .gtab i{font-style:normal;color:#EE7A10;display:inline-block;transition:transform .3s}
#clpGav.open .gtab i{transform:rotate(180deg)}
#clpGav .gbody{pointer-events:auto;background:#0F2236;border:1px solid #EE7A10;border-bottom:0;border-radius:12px 12px 0 0;padding:8px 12px 0;color:#F5F6F8;font-family:"IBM Plex Sans",system-ui,sans-serif;box-shadow:0 -6px 24px rgba(0,0,0,.35)}
#clpGav .gst{font-size:11px;line-height:1.3;margin:0 0 6px;color:#C9D3DF;display:flex;gap:8px;align-items:center;justify-content:space-between;width:312px}
#clpGav .gst b{color:#fff}
#clpGav .gst button{flex:none;background:transparent;color:#F5F6F8;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:2px 8px;font-weight:600;font-size:10.5px;font-family:inherit;cursor:pointer}
#clpGav .gst button:hover{background:#EE7A10;border-color:#EE7A10}
#clpGav .plc{width:312px;box-sizing:border-box;display:flex;background:linear-gradient(#F5F6F8,#DDE2E8);border-radius:10px 10px 0 0;border:2px solid #fff;border-bottom:0;color:#0F2236;padding:8px;box-shadow:0 0 0 3px rgba(238,122,16,.3)}
#clpGav .pl{flex:0 0 128px;display:flex;flex-direction:column;padding-right:6px}
#clpGav .pn{background:#fff;border-radius:5px;padding:3px 7px;font:800 14px "IBM Plex Mono","Courier New",monospace;margin-bottom:7px}
#clpGav .st{display:grid;grid-template-columns:1fr;gap:3px;font:700 12px "IBM Plex Sans",system-ui,sans-serif;margin-bottom:12px}
#clpGav .dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#444B54;margin-right:4px;vertical-align:-1px}
#clpGav .dot.on{background:#3DDC6A;box-shadow:0 0 6px #3DDC6A}
#clpGav .dot.red{background:#E04040;box-shadow:0 0 6px #E04040}
#clpGav .io{display:grid;grid-template-columns:1fr 1fr;gap:0 4px;margin-top:2px}
#clpGav .lh{font:800 12px "IBM Plex Sans",system-ui,sans-serif;margin:0 0 3px}
#clpGav .ln{font:700 12px/21px "IBM Plex Sans",system-ui,sans-serif;white-space:nowrap}
#clpGav .ln .dot{width:10px;height:10px;margin-right:6px;vertical-align:-1px}
#clpGav .sw{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;padding-top:6px}
#clpGav .usb{width:42px;height:22px;border-radius:5px;background:#2B3038}
#clpGav .tg{width:18px;height:34px;border-radius:9px;background:#14181D;position:relative}
#clpGav .tg:after{content:"";position:absolute;left:3px;top:3px;width:12px;height:12px;border-radius:50%;background:#E9EDF1}
#clpGav .cols{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px}
#clpGav .blk{background:#4FA95B;border:2px solid #3B8A47;border-radius:7px;padding:4px 4px;display:flex;flex-direction:column;gap:3px;justify-content:space-between}
#clpGav .tr{display:flex;align-items:center;gap:4px;height:21px}
#clpGav .sc{width:13px;height:13px;border-radius:2px;background:#2B5A33;flex:none}
#clpGav .xb,#clpGav .yl,#clpGav .dead{flex:1;min-width:0;height:19px;border-radius:10px;border:1.5px solid #2E6E39;background:#7FD28B;color:#0F2236;font:800 9.5px "IBM Plex Mono",monospace;padding:0;display:flex;align-items:center;justify-content:center}
#clpGav .dead{background:#6BBE77;opacity:.55}
#clpGav .xb{cursor:pointer;transition:transform .08s}
#clpGav .xb:hover{filter:brightness(1.12)}
#clpGav .xb:active{transform:scale(.93)}
#clpGav .xb.on{background:#EFFFF2;box-shadow:0 0 8px #FFFFFF,inset 0 0 0 1px #3DDC6A}
#clpGav .xb.frc{outline:2px solid #EE7A10;outline-offset:1px}
#clpGav .yl{background:#5FB36B}
#clpGav .yl.on{background:#FFC857;box-shadow:0 0 8px #FFC857;border-color:#EE7A10}
#clpGav .bt{font:800 8px "IBM Plex Mono",monospace;color:#0F2236;letter-spacing:.06em;text-align:center}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const XN = [0, 1, 2, 3, 4, 5, 6, 7], YN = [0, 1, 2, 3, 4, 5];
  function build(wrap) {
    if (document.getElementById("clpGav")) return;
    const g = document.createElement("div"); g.id = "clpGav";
    const row = (inner) => '<div class="tr"><i class="sc"></i>' + inner + '</div>';
    g.innerHTML = '<button class="gtab" type="button" title="Mostrar o CLP e forçar as entradas"><i>▲</i> CLP · DVP20SX2</button>' +
      '<div class="gbody"><div class="gst"><span id="gSt"></span><button type="button" id="gRel">Soltar</button></div>' +
      '<div class="plc"><div class="pl"><div class="pn">DVP20SX2</div>' +
      '<div class="st"><span><i class="dot" id="gPw"></i>POWER</span><span><i class="dot" id="gRun"></i>RUN</span><span><i class="dot" id="gEr"></i>ERROR</span><span><i class="dot"></i>USB</span></div>' +
      '<div class="io"><div><div class="lh">IN</div>' + XN.map(i => '<div class="ln"><i class="dot" data-lx="' + i + '"></i>' + i + '</div>').join("") + '</div>' +
      '<div><div class="lh">OUT</div>' + YN.map(i => '<div class="ln"><i class="dot" data-ly="' + i + '"></i>' + i + '</div>').join("") + '</div></div>' +
      '<div class="sw"><div class="usb"></div><div class="tg"></div></div></div>' +
      '<div class="cols">' +
      '<div class="blk">' + XN.map(i => row('<button type="button" class="xb" data-x="' + i + '">X' + i + '</button>')).join("") + '</div>' +
      '<div class="blk">' + XN.map(i => row(i < YN.length ? '<div class="yl" data-y="' + i + '">Y' + i + '</div>' : '<div class="dead"></div>')).join("") + '</div>' +
      '<div class="blk">' + XN.map(() => row('<div class="dead"></div>')).join("") + '</div>' +
      '<div class="blk">' + XN.map(() => row('<div class="dead"></div>')).join("") + '</div>' +
      '</div></div></div>';
    wrap.appendChild(g);
    const q = s => g.querySelector(s), qa = s => g.querySelectorAll(s), plc = q(".plc");
    // fica ao lado do menu (à direita dele), colado embaixo. Em telas pequenas (celular) vai para a esquerda da tela e ENCOLHE: nunca passa da largura da janela
    // e ocupa no máximo metade da altura, para não esconder a bancada. No computador mantém o tamanho cheio (só encolhe se a janela for muito baixa).
    const mobile = () => Math.min(wrap.clientWidth, window.innerWidth) <= 760 || (!!window.matchMedia && matchMedia('(pointer:coarse)').matches && window.innerWidth <= 900);
    const place = () => {
      const mn = document.getElementById('v3d-views'), wr = wrap.getBoundingClientRect(), mr = mn && mn.offsetWidth ? mn.getBoundingClientRect().right - wr.left : 0;
      const left = mobile() ? 8 : Math.max(8, mr + 12), z = parseFloat(g.style.zoom) || 1;
      g.dataset.left = left; g.style.left = (left / z).toFixed(1) + 'px';                 // com zoom, o 'left' também é multiplicado: divide para cair no lugar certo
    };
    const fit = () => {
      g.style.zoom = ''; place();
      const H = wrap.clientHeight, W = wrap.clientWidth, needH = plc.offsetHeight + 60, needW = g.offsetWidth, left = +g.dataset.left || 8;
      let z = Math.min(1, H / needH, (W - left - 6) / needW);
      if (mobile()) z = Math.min(z, (0.5 * H) / needH);
      z = Math.max(0.35, z); g.style.zoom = z < 0.999 ? z.toFixed(3) : ''; place();
    };
    q(".gtab").onclick = () => { g.classList.toggle("open"); fit(); upd(); };
    window.addEventListener("resize", () => { if (g.classList.contains("open")) fit(); }); window.addEventListener("orientationchange", () => setTimeout(() => { if (g.classList.contains("open")) fit(); }, 250));
    q("#gRel").onclick = () => { if (window.ISP) ISP.manualX = {}; if (window.App3D && App3D.releaseForce) App3D.releaseForce(); upd(); };
    const has = (o, n) => Object.prototype.hasOwnProperty.call(o, n);
    const natural = () => { const I = window.ISP; try { return I.calcX(window.PLC && PLC.io) || {}; } catch (e) { return I.sentX || {}; } };
    // qual sinal do mapa está neste endereço X
    const sigAt = n => { const c = (window.ISP && ISP.cfg && ISP.cfg.x) || {}; for (const k in c) if (c[k] && c[k].n === n) return { k, nf: !!c[k].nf }; return null; };
    const FRC = { LSL: 1, LSH: 1, TSH: 1 };
    const isForced = n => { const I = window.ISP; if (I && has(I.manualX, n)) return true; const sg = sigAt(n); return !!(sg && FRC[sg.k] && window.App3D && App3D.force[sg.k] != null); };
    let note = "", noteT = 0;
    const say = t => { note = t; noteT = Date.now() + 3500; upd(); };
    qa(".xb").forEach(b => b.onclick = () => {
      const I = window.ISP; if (!I) return;
      const n = +b.dataset.x, nat = natural();
      if (I.active) {                                          // ISPSoft conectado: força o endereço enviado ao CLP (o programa do aluno decide o que fazer)
        const cur = has(I.manualX, n) ? I.manualX[n] : !!nat[n];
        I.manualX[n] = !cur;
        if (I.manualX[n] === !!nat[n]) delete I.manualX[n];
        upd(); if (I.render) { try { I.render(); } catch (e) { } }
        return;
      }
      // sem ISPSoft: o clique age como o dispositivo ligado a esse endereço (igual ao quadro elétrico / boias do 3D)
      const sg = sigAt(n), A = window.App3D;
      if (!sg || !A) { say("X" + n + " sem sinal no mapa: monte o mapa na aba CLP (Montar automaticamente)."); return; }
      const io = window.PLC && PLC.io;
      if (sg.k === "LIGA") A._click("LIGA");
      else if (sg.k === "DESL") A._click("DESLIGA");
      else if (sg.k === "EMERG") A._click("EMERGENCIA");
      else if (sg.k === "SELRES") A._click("SELRES");
      else if (sg.k === "AUTO") { if (window.MD) { MD.auto = !MD.auto; try { localStorage.setItem("nivel-md-auto", MD.auto ? "1" : "0"); } catch (e) { } } if (io) io.btn.X4 = !!(window.MD && MD.auto); }
      else if (FRC[sg.k]) { const lvl = !!nat[n], dev = sg.nf ? !lvl : lvl; A.force[sg.k] = !dev; }
      else { say(sg.k + " não é uma entrada que possa ser forçada aqui."); return; }
      upd();
    });
    // saída: com o ISPSoft conectado vem do CLP; sem ele (modo demonstração / comando direto) vem da simulação, pelo sinal mapeado
    const outOn = (i, name) => {
      const I = window.ISP;
      if (I && I.active && I.ok) return !!(I.lastY || [])[i];
      const o = (window.App3D && App3D.outs) || {};
      return name === "BOMBA" ? !!o.pump : name === "VY" ? !!o.vy : name === "RES" ? !!o.res : false;
    };
    function upd() {
      place();                                 // sempre ao lado do menu, mesmo antes da primeira abertura
      if (!g.classList.contains("open")) return;
      const I = window.ISP; if (!I) return;
      const man = I.manualX || {}, nat = natural(), cfg = I.cfg || { x: {}, y: {} };
      const xn = {}, yn = {};
      for (const k in cfg.x) { const m = cfg.x[k]; if (m && m.n != null) xn[m.n] = k + (m.nf ? " NF" : " NA"); }
      for (const k in cfg.y) { if (cfg.y[k] != null) yn[cfg.y[k]] = k; }
      XN.forEach(i => {
        const f = isForced(i), v = has(man, i) ? man[i] : !!nat[i], b = q('.xb[data-x="' + i + '"]');
        b.classList.toggle("on", v); b.classList.toggle("frc", f);
        b.title = "X" + i + (xn[i] ? " · " + xn[i] : " · sem sinal no mapa") + " · clique para forçar " + (v ? "desligado" : "ligado");
        q('[data-lx="' + i + '"]').classList.toggle("on", v);
      });
      YN.forEach(i => {
        const on = outOn(i, yn[i]); q('[data-ly="' + i + '"]').classList.toggle("on", on); const yl = q('.yl[data-y="' + i + '"]'); yl.classList.toggle("on", on); yl.title = "Y" + i + (yn[i] ? " · " + yn[i] : " · sem sinal no mapa");
      });
      const ok = I.active && I.ok, nf = XN.filter(isForced).length;
      q("#gPw").classList.add("on"); q("#gRun").classList.toggle("on", !!ok); q("#gEr").classList.toggle("red", !!(I.active && !I.ok));
      q("#gSt").innerHTML = ok ? "<b>Comunicando</b>" + (nf ? " · <b>" + nf + " forçada(s)</b>" : "") : (I.active ? "<b>Sem resposta</b> do CLP" : "<b>Modo simulação.</b> Os botões acionam a bancada" + (nf ? " · <b>" + nf + " forçada(s)</b>" : ""));
      if (Date.now() < noteT) q("#gSt").innerHTML = note;
      q("#gRel").style.display = nf ? "" : "none";
    }
    place(); setInterval(upd, 150); window.addEventListener("resize", place);
  }
  function tryBuild() { const w = document.getElementById("w3d"); if (w) build(w); else setTimeout(tryBuild, 300); }
  tryBuild();
})();
