@echo off
chcp 65001 >nul 2>&1
title 提示词收纳箱 - 本地预览
cd /d "%~dp0"

echo.
echo   ============================================
echo      提示词收纳箱 · 启动本地预览
echo   ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   [错误] 未检测到 Node.js。
  echo.
  echo   请先安装 Node.js ^(https://nodejs.org/^)，安装后重新双击本文件。
  echo.
  echo   或者：完全不用 Node.js，直接双击 index.html 也能打开。
  echo.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo   正在构建...
  node scripts\build.mjs
  if errorlevel 1 (
    echo.
    echo   [错误] 构建失败。
    pause
    exit /b 1
  )
  echo.
)

echo   正在启动服务器，浏览器将自动打开...
echo   (关闭本窗口即可停止服务)
echo.

node scripts\serve.mjs -p 8899 -d dist --open

echo.
echo   服务器已停止（或已复用已在运行的实例）。
echo   按任意键关闭窗口。
pause >nul
