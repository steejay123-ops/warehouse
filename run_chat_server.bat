@echo off
chcp 65001 > nul
echo ========================================================
echo   Starting Live Chat History Server and Auto Watcher
echo ========================================================
python update_chat_history.py --server --watch
pause
