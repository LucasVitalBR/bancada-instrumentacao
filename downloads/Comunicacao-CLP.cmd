@echo off
title Comunicacao - CLP - EducaWEB
set "EDUCAWEB_INSTALADOR=%~f0"
powershell -NoProfile -Command "$t=[IO.File]::ReadAllText($env:EDUCAWEB_INSTALADOR,[Text.Encoding]::UTF8); $a=$t.IndexOf(([char]35)+'PS-INICIO'); $b=$t.IndexOf(([char]35)+'PONTE-INICIO'); Invoke-Expression $t.Substring($a,$b-$a)"
echo.
pause
exit /b
#PS-INICIO
# Instala a ponte so para o usuario atual (sem administrador). Nao configura inicio com o Windows.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  if (-not [Environment]::Is64BitOperatingSystem) { throw 'Este instalador precisa de Windows 64 bits.' }
  $dir = Join-Path $env:LOCALAPPDATA 'EducaWEB\Ponte'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Write-Host "Instalando em $dir"

  # encerra uma ponte antiga (somente node.exe rodando ponte.js ou ocupando a porta 8765)
  foreach ($linha in (netstat -ano | Select-String ':8765\s.*LISTENING')) {
    $id = [int](($linha.ToString().Trim() -split '\s+')[-1])
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq 'node') { Stop-Process -Id $id -Force; Start-Sleep -Seconds 1 }
  }

  # programa da ponte (vem dentro deste instalador)
  $texto = [IO.File]::ReadAllText($env:EDUCAWEB_INSTALADOR, [Text.Encoding]::UTF8)
  $marca = ([char]35) + 'PONTE-INICIO'
  $ponte = $texto.Substring($texto.IndexOf($marca) + $marca.Length).TrimStart()
  [IO.File]::WriteAllText((Join-Path $dir 'ponte.js'), $ponte, (New-Object Text.UTF8Encoding($false)))

  # Node.js: reaproveita o que ja existe; senao baixa do site oficial e confere o SHA-256
  $node = Join-Path $dir 'node.exe'
  if (-not (Test-Path $node)) {
    $instalado = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($instalado) { Copy-Item $instalado.Source $node }
    else {
      Write-Host 'Baixando o Node.js do site oficial (nodejs.org)...'
      [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
      $base = 'https://nodejs.org/dist/latest-v24.x/'
      $somas = (Invoke-WebRequest -UseBasicParsing ($base + 'SHASUMS256.txt')).Content
      $m = [regex]::Match($somas, '(?m)^([0-9a-f]{64})\s+(node-v[0-9.]+-win-x64\.zip)\s*$')
      if (-not $m.Success) { throw 'Nao encontrei o pacote do Node.js na lista oficial.' }
      $zip = Join-Path $env:TEMP $m.Groups[2].Value
      Invoke-WebRequest -UseBasicParsing ($base + $m.Groups[2].Value) -OutFile $zip
      if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $m.Groups[1].Value) { Remove-Item $zip; throw 'O arquivo baixado nao confere (SHA-256).' }
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $z = [IO.Compression.ZipFile]::OpenRead($zip)
      try {
        $item = $z.Entries | Where-Object { $_.FullName -like '*/node.exe' } | Select-Object -First 1
        [IO.Compression.ZipFileExtensions]::ExtractToFile($item, $node, $true)
      } finally { $z.Dispose() }
      Remove-Item $zip
    }
  }

  # iniciador sem janela e parada
  $vbs = @(
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'Set sh = CreateObject("WScript.Shell")',
    'pasta = fso.GetParentFolderName(WScript.ScriptFullName)',
    'sh.CurrentDirectory = pasta',
    'sh.Run """" & pasta & "\node.exe"" ponte.js", 0, False'
  )
  Set-Content -Path (Join-Path $dir 'INICIAR-OCULTO.vbs') -Value $vbs -Encoding ASCII
  $parar = @(
    '@echo off',
    'for /f "tokens=5" %%p in (''netstat -ano ^| findstr /R /C:":8765 .*LISTENING"'') do tasklist /FI "PID eq %%p" | findstr /I "node.exe" >nul && taskkill /F /PID %%p >nul',
    'echo Ponte encerrada.',
    'timeout /t 2 >nul'
  )
  Set-Content -Path (Join-Path $dir 'PARAR-PONTE.bat') -Value $parar -Encoding ASCII

  # atalho nivelponte: usado pelo botao do site
  $chave = 'HKCU:\Software\Classes\nivelponte'
  New-Item -Path "$chave\shell\open\command" -Force | Out-Null
  Set-ItemProperty -Path $chave -Name '(default)' -Value 'URL:Ponte Controle de Nivel'
  Set-ItemProperty -Path $chave -Name 'URL Protocol' -Value ''
  $vbsPath = Join-Path $dir 'INICIAR-OCULTO.vbs'
  Set-ItemProperty -Path "$chave\shell\open\command" -Name '(default)' -Value ('wscript.exe "' + $vbsPath + '"')

  # teste: liga a ponte, confere a resposta e desliga (no uso normal quem liga e o botao do site)
  $teste = Start-Process -FilePath $node -ArgumentList 'ponte.js' -WorkingDirectory $dir -WindowStyle Hidden -PassThru
  $ok = $false
  for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
    Start-Sleep -Milliseconds 500
    try { $ok = (Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8765/api/ping' -TimeoutSec 2).ok } catch { }
  }
  if (-not $teste.HasExited) { Stop-Process -Id $teste.Id -Force }
  if (-not $ok) { throw 'Os arquivos foram copiados, mas a ponte nao respondeu no teste.' }

  Write-Host ''
  Write-Host 'Comunicacao - CLP instalada. Volte ao simulador e clique em Conectar ao ISPSoft.' -ForegroundColor Green
} catch {
  Write-Host ''
  Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'Tire uma foto desta tela e chame o professor.'
}
#PONTE-INICIO
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
