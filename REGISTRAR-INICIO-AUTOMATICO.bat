@echo off
cd /d "%~dp0"
echo.
echo  Configurando a ponte em segundo plano (nao precisa de administrador)...
rem 1) atalho nivelponte: -> o botao "ISPSoft + inversor" da pagina inicia a ponte sozinho
reg add "HKCU\Software\Classes\nivelponte" /ve /d "URL:Ponte Controle de Nivel" /f >nul
reg add "HKCU\Software\Classes\nivelponte" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\nivelponte\shell\open\command" /ve /d "wscript.exe \"%~dp0INICIAR-OCULTO.vbs\"" /f >nul
rem 2) opcional: iniciar junto com o Windows
choice /C SN /M "Iniciar a ponte tambem sempre que ligar o Windows"
if errorlevel 2 goto fim
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Ponte Nivel.lnk'); $s.TargetPath='wscript.exe'; $s.Arguments='\"%~dp0INICIAR-OCULTO.vbs\"'; $s.WorkingDirectory='%~dp0'; $s.Save()"
echo  Inicio com o Windows ativado.
:fim
echo.
echo  Pronto. Agora basta abrir a pagina e clicar em "ISPSoft + inversor".
echo  Para encerrar a ponte: PARAR-PONTE.bat
pause
