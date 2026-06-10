#!/bin/zsh
cd "$(dirname "$0")"

echo "正在启动手机拍照 OCR 服务..."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js。请先安装 Node.js："
  echo "https://nodejs.org/"
  echo
  echo "安装后重新双击 start-mac.command。"
  read "?按回车退出..."
  exit 1
fi

npm start

echo
read "?服务已停止，按回车退出..."
