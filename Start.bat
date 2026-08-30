@echo off
chcp 936 >nul
title UltraPokechill

echo.
echo ========================================
echo        UltraPokechill 本地服务器
echo ========================================
echo.
echo [信息] 使用 Node 启动服务器（含存档保险库备份接口）...
echo [地址] 访问地址: http://127.0.0.1:8000/
echo [提示] 按任意键关闭服务器并退出...
echo.
echo ========================================
echo.

REM 启动 Node 服务器：同时托管游戏静态文件与 /v1 备份接口
if exist "D:\nodejs\node.exe" (
  start /B "UltraPokechill Server" "D:\nodejs\node.exe" "%~dp0mods\saveVault\server\server.js"
) else (
  start /B "UltraPokechill Server" node "%~dp0mods\saveVault\server\server.js"
)

REM 打开浏览器
start http://127.0.0.1:8000/

pause >nul

REM 关闭 Node 进程
taskkill /F /IM node.exe >nul 2>&1

echo 服务器已关闭。
timeout /t 1 /nobreak >nul
