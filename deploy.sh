#!/bin/bash

echo "🚀 Starting deployment..."

git pull origin main

echo "📦 Installing dependencies..."
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

echo "🏗️ Building frontend..."
npm run build

# -----------------------------
# ✅ Check build exists
# -----------------------------
if [ ! -d "dist" ]; then
    echo "❌ Build failed: dist folder not found"
    exit 1
fi

# -----------------------------
# ✅ Serve static build with PM2
# -----------------------------
pm2 delete naitalk 2>/dev/null || true

pm2 serve dist 3000 --name naitalk --spa

pm2 save
pm2 status

echo "✅ Deployment complete!"