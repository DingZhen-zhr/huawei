@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js 20 或更新版本，再双击本文件。
  echo 下载地址：https://nodejs.org/
  pause
  exit /b 1
)
node scripts/launch-local.mjs
if errorlevel 1 (
  echo 启动未完成。请根据上方说明处理后重试。
  pause
)
