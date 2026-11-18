@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "release\win-unpacked\Tom Office.exe" (
  start "" "release\win-unpacked\Tom Office.exe"
  exit /b 0
)
if not exist "dist\index.html" (
  echo 尚未构建应用，请先运行 npm install 和 npm run build。
  pause
  exit /b 1
)
call npm start
