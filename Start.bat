@echo off
chcp 936 >nul
title UltraPokechill

echo.
echo ========================================
echo        UltraPokechill 本地服务器
echo ========================================
echo.
echo [信息] 使用 Python 启动服务器...
echo [地址] 访问地址: http://127.0.0.1:8000/
echo [提示] 按任意键关闭服务器并退出...
echo.
echo ========================================
echo.

REM 启动Python HTTP服务器
start /B python -m http.server 8000 >nul 2>&1

REM 打开浏览器
start http://127.0.0.1:8000/

pause >nul

REM 关闭Python进程
taskkill /F /IM python.exe >nul 2>&1

echo 服务器已关闭。
timeout /t 1 /nobreak >nul