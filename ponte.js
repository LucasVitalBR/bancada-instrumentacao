/* Ponte ISPSoft ⇄ simulador web.
   Uso: node ponte.js   (ou dois cliques em INICIAR-PONTE.bat) e abra http://localhost:8765
   Fala Modbus ASCII sobre TCP com o simulador do ISPSoft/COMMGR (DVPSimulator, porta do driver "Simulator", padrão 10004)
   e serve esta pasta. Endpoints: POST /api/connect {port} · POST /api/xchg {x:{n:bool}, d:{n:valor}, ry:8, rd:[n]} · POST /api/disconnect */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), net = require("net");
const PORT = +process.env.PORTA || 8765, ROOT = __dirname, UNIT = 1;
const MIME = { ".html": "text/html;charset=utf-8", ".js": "text/javascript;charset=utf-8", ".svg": "image/svg+xml", ".css": "text/css", ".json": "application/json" };

// ---- Modbus ASCII
const lrc = b => { let s = 0; for (const x of b) s = (s + x) & 255; return (256 - s) & 255; };
const frame = a => { const b = Buffer.from(a); return Buffer.from(":" + Buffer.concat([b, Buffer.from([lrc(b)])]).toString("hex").toUpperCase() + "\r\n"); };
const parse = s => { const t = s.trim(); if (t[0] !== ":") throw new Error("resposta inválida"); const b = Buffer.from(t.slice(1), "hex"); if (b.length < 3) throw new Error("resposta curta"); if (b[1] & 0x80) throw new Error("exceção Modbus " + b[2] + " (endereço não aceito?)"); return b.slice(1, b.length - 1); };

let sock = null, buf = "", waiter = null, chain = Promise.resolve(), cur = { port: 0, connected: false };
const cache = { x: {}, d: {} };
function tx(a) { // envia um quadro e espera a resposta
  return new Promise((res, rej) => {
    if (!sock) return rej(new Error("não conectado"));
    const t = setTimeout(() => { waiter = null; rej(new Error("o simulador não respondeu (RUN ligado no ISPSoft?)")); }, 1500);
    waiter = line => { clearTimeout(t); try { res(parse(line)); } catch (e) { rej(e); } };
    sock.write(frame(a));
  });
}
const q = fn => (chain = chain.then(fn, fn));
function connect(port) {
  return new Promise((res, rej) => {
    disconnect();
    const s = net.connect(port, "127.0.0.1");
    s.setNoDelay(true);
    s.once("connect", () => { sock = s; cur = { port, connected: true }; cache.x = {}; cache.d = {}; res(); });
    s.on("data", d => { buf += d.toString(); let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (waiter) { const w = waiter; waiter = null; w(line); } } });
    s.once("error", e => { if (sock === s) { sock = null; cur.connected = false; } rej(new Error("não foi possível abrir a porta " + port + ": " + e.message + " (simulador em RUN no ISPSoft?)")); });
    s.on("close", () => { if (sock === s) { sock = null; cur.connected = false; } });
  });
}
function disconnect() { if (sock) { try { sock.destroy(); } catch (e) { } sock = null; } cur.connected = false; buf = ""; waiter = null; }
const addr = (base, n) => [(base + n) >> 8, (base + n) & 255];
async function xchg(b) {
  const out = { ok: true, y: [], d: {} };
  // escreve só o que mudou: X (FC05) e D (FC06)
  for (const k in (b.x || {})) { const v = !!b.x[k]; if (cache.x[k] !== v) { await tx([UNIT, 5, ...addr(0x0400, +k), v ? 0xFF : 0, 0]); cache.x[k] = v; } }
  for (const k in (b.d || {})) { const v = b.d[k] & 0xFFFF; if (cache.d[k] !== v) { await tx([UNIT, 6, ...addr(0x1000, +k), v >> 8, v & 255]); cache.d[k] = v; } }
  const n = b.ry || 8, r = await tx([UNIT, 1, ...addr(0x0500, 0), 0, n]);   // saídas Y
  for (let i = 0; i < n; i++) out.y.push(!!((r[2 + (i >> 3)] >> (i & 7)) & 1));
  for (const k of (b.rd || [])) { const r2 = await tx([UNIT, 3, ...addr(0x1000, +k), 0, 1]); out.d[k] = (r2[2] << 8) | r2[3]; }
  return out;
}

// ---- quem pode usar a ponte: os sites do projeto, a propria ponte e os enderecos listados em origens.txt (um por linha)
const ORIGENS = new Set(["https://bancada-instrumentacao.vercel.app", "https://educaweb.online", "https://www.educaweb.online", "http://localhost:" + PORT, "http://127.0.0.1:" + PORT]);
try { for (const l of fs.readFileSync(path.join(ROOT, "origens.txt"), "utf8").split(/\r?\n/)) { const o = l.trim().replace(/\/+$/, ""); if (/^https:\/\/[a-z0-9.-]+$/i.test(o)) ORIGENS.add(o.toLowerCase()); } } catch (e) { }
const HOSTS = new Set(["localhost:" + PORT, "127.0.0.1:" + PORT]);

const srv = http.createServer((req, res) => {
  const origem = req.headers.origin;
  // recusa antes de executar qualquer comando (o CORS sozinho nao impede a execucao); o Host barra DNS rebinding
  if (!HOSTS.has(String(req.headers.host || "").toLowerCase()) || (origem !== undefined && !ORIGENS.has(origem))) { res.writeHead(403); return res.end("origem não autorizada"); }
  const cors = origem ? { "Access-Control-Allow-Origin": origem, "Vary": "Origin" } : {};
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json", ...cors }); res.end(JSON.stringify(obj)); };
  if (req.method === "OPTIONS") { res.writeHead(204, { ...cors, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Private-Network": "true" }); return res.end(); }
  if (req.url.startsWith("/api/")) {
    let body = ""; req.on("data", d => body += d); req.on("end", () => {
      let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) { }
      const u = req.url.split("?")[0];
      if (u === "/api/ping") return send(200, { ok: true, ponte: true, connected: cur.connected, port: cur.port });
      if (u === "/api/connect") return q(() => connect(+b.port || 10004)).then(() => send(200, { ok: true, port: cur.port }), e => send(200, { ok: false, error: e.message }));
      if (u === "/api/disconnect") { disconnect(); return send(200, { ok: true }); }
      if (u === "/api/xchg") return q(() => xchg(b)).then(r => send(200, r), e => send(200, { ok: false, error: e.message }));
      send(404, { ok: false });
    });
    return;
  }
  let p; try { p = decodeURIComponent(req.url.split("?")[0]); } catch (e) { res.writeHead(400); return res.end("endereço inválido"); }
  if (p.includes("\0")) { res.writeHead(400); return res.end("endereço inválido"); }
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/])+/, ""));
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end("não encontrado"); } res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(d); });
});
srv.on("error", e => { if (e.code === "EADDRINUSE") console.error("\nERRO: a porta " + PORT + " já está em uso por outra ponte (de outra pasta?). Feche a janela da ponte antiga ou use o INICIAR-PONTE.bat, que a fecha sozinho."); else console.error("\nERRO:", e.message); process.exit(1); });
srv.listen(PORT, "127.0.0.1", () => {
  let b = "?"; try { b = (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/const BUILD = "([^"]*)"/) || [])[1] || "?"; } catch (e) { }
  console.log("Ponte ISPSoft pronta.\n  Pasta : " + ROOT + "\n  Versão: build " + b + "\n  Abra  : http://localhost:" + PORT + "\n(Deixe esta janela aberta. Ctrl+C para sair.)");
});
