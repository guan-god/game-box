#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm 未安装，请先安装 Node.js (含 npm)。"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[INFO] 正在安装依赖..."
  npm install
else
  echo "[INFO] 检测到 node_modules，跳过安装。"
fi

echo "[INFO] 启动开发服务器..."
npm run dev -- --host 0.0.0.0 --open
