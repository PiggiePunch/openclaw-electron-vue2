#!/bin/bash

echo "🧹 清理 Webpack 缓存..."

# 停止所有相关进程
echo "停止进程..."
killall -9 node webpack electron 2>/dev/null || true
sleep 2

# 清理缓存目录
echo "清理缓存目录..."
cd /mnt/d/git/openclaw-electron-vue2
rm -rf frontend/node_modules/.cache
rm -rf frontend/.cache
rm -rf frontend/dist
rm -rf dist

# 清理可能的临时文件
find frontend -name "*.log" -type f -delete 2>/dev/null || true

echo "✅ 清理完成！"
echo ""
echo "现在可以运行: npm run dev:hot"
