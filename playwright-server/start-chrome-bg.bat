@echo off
echo Starting Chrome completely hidden (no taskbar entry)...
wscript.exe "%~dp0start-chrome-hidden.vbs"
echo.
echo Chrome is running invisibly on port 9222.
echo Run:  node server.js
echo.
echo (Use start-chrome.bat if you need to log in again)
pause
