@echo off
echo =========================================
echo    Starting Warehouse Management System
echo =========================================

echo.
echo [1/2] Starting Django Backend (Port 8000)...
cd /d "%~dp0warehouse-backend"
start "Warehouse Backend" cmd /k ".\venv\Scripts\python.exe manage.py runserver 8000 --noreload"

echo [2/2] Starting Angular Frontend (Port 4200)...
cd /d "%~dp0warehouse-front"
start "Warehouse Frontend" cmd /k "npm run start"

echo.
echo Servers are starting in separate windows!
echo It might take 10-15 seconds for Angular to compile.
echo.
echo Please open http://localhost:4200 in your browser.
echo =========================================
pause
