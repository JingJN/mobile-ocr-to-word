@echo off
setlocal
title Mobile OCR to Word
cd /d "%~dp0"

echo Starting Mobile OCR to Word service...
echo.

if not exist "server.js" (
  echo server.js was not found.
  echo.
  echo Please unzip the package first, then run start-windows.bat
  echo inside the extracted mobile-ocr-to-word folder.
  echo Do not run this file directly from the ZIP preview window.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Please install Node.js first:
  echo https://nodejs.org/
  echo.
  echo During installation, make sure "Add to PATH" is enabled.
  echo After installation, close this window and run start-windows.bat again.
  pause
  exit /b 1
)

echo Node version:
node --version
echo.

node server.js

echo.
echo Service stopped. Exit code: %ERRORLEVEL%
echo If you did not stop it manually, check whether port 3000 is already in use.
echo.
pause
