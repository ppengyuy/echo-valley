@echo off
setlocal
cd /d "%~dp0"

rem If the dev server is already running, just open the browser.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5178/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:5178/'; exit 0 } } catch { }; exit 1"
if not errorlevel 1 exit /b

echo.
echo Starting Echo Valley...
echo Keep this window open while you use the app.
echo.

call npm run dev -- --open

echo.
echo Server stopped. Press any key to close.
pause >nul
