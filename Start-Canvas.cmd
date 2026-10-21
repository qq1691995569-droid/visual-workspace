@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:5173/"
call npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
pause
