@echo off
chcp 65001 > nul
echo ========================================================
echo   اجرای سرور تعاملی و پایش زنده تاریخچه چت‌های انبار (Live Server & Auto Watch)
echo ========================================================
python update_chat_history.py --server --watch
pause
