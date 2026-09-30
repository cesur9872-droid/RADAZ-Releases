@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-radaz.ps1"
if errorlevel 1 (
  echo.
  echo Baslatma tamamlanmadi. Yuxaridaki melumati yoxlayin.
  pause
)
