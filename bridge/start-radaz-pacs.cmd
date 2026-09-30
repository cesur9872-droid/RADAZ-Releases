@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON_CMD=py -3"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 tapilmadi. https://www.python.org/downloads/ unvanindan qurasdirin.
    pause
    exit /b 1
  )
  set "PYTHON_CMD=python"
)
%PYTHON_CMD% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
if errorlevel 1 (
  echo Python 3.10 ve ya daha yeni versiya lazimdir.
  pause
  exit /b 1
)
%PYTHON_CMD% -I -S radaz_pacs_bridge.py
if errorlevel 1 (
  echo RADAZ PACS korpusu baslamadi. ZIP-in butun fayllarini acdiginizi yoxlayin.
)
pause
