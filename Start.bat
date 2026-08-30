
@echo off
chcp 65001 >nul
title UltraPokechill

echo.
echo ==========================================================================
echo                       UltraPokechill 本地服务器
echo ==========================================================================
echo.

REM 检测 node 是否可用
where node >nul 2>&1
if %errorlevel%==0 (
  echo  [信息] 检测到 Node.js，正在启动服务器...
  start /B node "%~dp0server.js"
  start http://127.0.0.1:8000/
  pause >nul
  taskkill /F /IM node.exe >nul 2>&1
  echo  [信息] 服务器已关闭。
  timeout /t 1 /nobreak >nul
) else (
  echo  [错误] 未检测到 Node.js，无法启动服务器。
  echo  [提示] 请先安装 Node.js，安装完成后重新运行本脚本。
  echo.
  pause
)
