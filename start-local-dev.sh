#!/bin/bash

# 本地开发服务器启动脚本

echo "启动水泥花格地图本地开发服务器..."

# 检查是否安装了Node.js
if ! command -v node &> /dev/null; then
    echo "错误：未安装Node.js，请先安装Node.js"
    exit 1
fi

# 进入server目录
cd server

# 安装依赖
echo "安装服务器依赖..."
npm install

# 启动服务器
echo "启动后端API服务器（端口3000）..."
node src/index.js &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 检查服务器是否成功启动
if curl -s http://localhost:3000/api/works > /dev/null; then
    echo "✅ 后端API服务器启动成功！"
else
    echo "❌ 后端API服务器启动失败"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 回到根目录
cd ..

# 启动前端静态文件服务器
echo "启动前端静态文件服务器（端口8080）..."
cd website

# 使用Python或Node.js启动静态文件服务器
if command -v python3 &> /dev/null; then
    echo "使用Python3启动静态文件服务器..."
    python3 -m http.server 8080 &
    WEB_PID=$!
elif command -v python &> /dev/null; then
    echo "使用Python2启动静态文件服务器..."
    python -m SimpleHTTPServer 8080 &
    WEB_PID=$!
else
    echo "使用Node.js启动静态文件服务器..."
    npx http-server -p 8080 &
    WEB_PID=$!
fi

echo ""
echo "==================================="
echo "🎉 本地开发服务器已启动！"
echo ""
echo "前端页面： http://localhost:8080"
echo "上传页面： http://localhost:8080/upload.html"
echo "后端API： http://localhost:3000/api/works"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo "==================================="

# 等待用户中断
trap "kill $SERVER_PID $WEB_PID 2>/dev/null; exit" INT
wait