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
    $padrao = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (-not $instalado -and (Test-Path $padrao)) { $instalado = Get-Item $padrao | Select-Object @{n='Source';e={$_.FullName}} }
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
  Write-Host 'Se o erro foi no download do Node.js: use o botao Baixar Node.js no site, instale e abra este arquivo de novo.'
  Write-Host 'Se continuar, tire uma foto desta tela e chame o professor.'
}
#PONTE-INICIO
