@echo off
echo Iniciando servidor SIGAM...
echo.
echo Acesse: http://127.0.0.1:8001/portal.html
echo Para encerrar: pressione Ctrl+C
echo.
cd /d "%~dp0backend"
python server.py --host 127.0.0.1 --port 8001
pause
