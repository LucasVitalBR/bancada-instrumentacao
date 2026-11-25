@echo off
cd /d "%~dp0"
title Ponte ISPSoft
if not defined PORTA set PORTA=8765
echo.
echo  Ponte ISPSoft - pasta: %~dp0
echo  Liberando a porta %PORTA% (fecha uma ponte antiga, se houver)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORTA% .*LISTENING"') do (
  tasklist /FI "PID eq %%p" 2>nul | findstr /I "node.exe" >nul && taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo  Abrindo http://localhost:%PORTA% (sempre a versao desta pasta)...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORTA%/?v=%RANDOM%"
if exist "%~dp0node.exe" (
  "%~dp0node.exe" ponte.js
) else (
  node ponte.js
)
pause
