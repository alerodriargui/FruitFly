@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" demo.py %*
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "%~dp0results\informe.html"
