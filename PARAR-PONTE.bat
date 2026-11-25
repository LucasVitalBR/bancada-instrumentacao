@echo off
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":8765 .*LISTENING"') do taskkill /F /PID %%p >nul 2>&1
echo Ponte encerrada.
timeout /t 2 >nul
