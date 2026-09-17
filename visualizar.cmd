@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" build_viewer.py
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "%~dp0web\index.html"
