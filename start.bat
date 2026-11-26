@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo SIGAM / SIGPM - Inicializacao local
echo ==========================================

set "PYTHON="
if exist ".venv\Scripts\python.exe" set PYTHON="%CD%\.venv\Scripts\python.exe"
if not defined PYTHON if exist "venv\Scripts\python.exe" set PYTHON="%CD%\venv\Scripts\python.exe"

if defined PYTHON (
    echo Usando ambiente virtual: %PYTHON%
) else (
    where py >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON=py -3"
    ) else (
        where python >nul 2>nul
        if not errorlevel 1 (
            set "PYTHON=python"
        ) else (
            echo ERRO: Python 3 nao foi encontrado. Instale Python 3.10 ou superior.
            pause
            exit /b 1
        )
    )
)

echo Inicializando API e banco SQLite local...
echo Acesse: http://127.0.0.1:8001/
echo Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.
echo.
%PYTHON% backend\server.py --host 127.0.0.1 --port 8001
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
    echo.
    echo ERRO: O servidor encerrou com codigo %RESULT%.
    echo Confira se a porta 8001 ja esta sendo usada e se Python iniciou corretamente.
    pause
)
exit /b %RESULT%
