@echo off
echo Starting Chrome with remote debugging...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%~dp0chrome-debug-profile" ^
  --no-first-run ^
  --no-default-browser-check
echo.
echo Chrome is open on port 9222.
echo Login to ChatGPT, Claude and Gemini in this Chrome window.
echo Then run:  node server.js
echo.
pause
