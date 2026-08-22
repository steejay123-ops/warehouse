@echo off
chcp 65001 >nul
if not "%~1"=="RESTARTED" (
    cmd /c ""%~f0" RESTARTED"
    exit /b
)

echo ========================================================
echo   Updating Warehouse Project Chat History
echo ========================================================
python update_chat_history.py
echo.
echo Opening dashboard in browser...
start "" "%~dp0chat_history_dashboard.html"
pause