@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 18 or newer is required for online search.
 echo You can open Mii_Ratsion.html for the built-in catalog.
 pause
 exit /b 1
)
node server.mjs --open
pause
