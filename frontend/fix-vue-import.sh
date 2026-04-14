#!/bin/bash

# Vue 2.6 + Webpack 5 兼容性修复脚本

echo "=== 开始修复 Vue 导入问题 ==="

# 1. 停止所有进程
echo "停止所有 npm 进程..."
pkill -f "npm run dev" || true
pkill -f "webpack-cli" || true
pkill -f "electron" || true
sleep 2

# 2. 清除所有缓存和构建文件
echo "清除缓存和构建文件..."
cd /mnt/d/git/openclaw-electron-vue2/frontend
rm -rf dist
rm -rf node_modules/.cache
rm -rf .cache
rm -rf ../dist/renderer

# 3. 重新构建前端（生产模式）
echo "重新构建前端..."
npm run build

# 4. 重新编译主进程
echo "重新编译主进程..."
cd ..
npm run build

echo "=== 修复完成 ==="
echo ""
echo "请运行以下命令启动应用："
echo "  npm run dev    # 生产模式（推荐）"
echo "  npm run dev:hot  # 开发模式"
