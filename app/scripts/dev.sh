#!/usr/bin/env bash
# 一条命令同时起后端(8787)和前端(3000)，Ctrl+C 一起退出
set -e
cd "$(dirname "$0")/.."
node server/index.mjs &
API=$!
npm run dev &
WEB=$!
trap 'kill $API $WEB 2>/dev/null || true' INT TERM
wait
