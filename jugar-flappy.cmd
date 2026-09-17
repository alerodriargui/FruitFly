@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" "flappy_server.py"
if errorlevel 1 pause
