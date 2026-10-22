@echo off
setlocal
cd /d "%~dp0"
if not exist "artifacts\perf-images.json" (
  echo Missing fixtures: artifacts\perf-images.json
  echo Generate the 300-image fixture set before running this test.
  pause
  exit /b 1
)
rem Use the Playwright-managed browser, not the workstation's Edge profile.
set "PLAYWRIGHT_CHANNEL=chromium"
set "CANVAS_PERF=1"
set "PERF_ROUNDS=1"
call npx playwright test tests/canvas-performance.spec.ts --workers=1 --reporter=line
set "TEST_EXIT=%ERRORLEVEL%"
if "%TEST_EXIT%"=="0" (
  echo Report: artifacts\performance-300.json
) else (
  echo Test failed. Keep this output for diagnosis.
)
pause
exit /b %TEST_EXIT%
