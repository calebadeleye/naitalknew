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
if [ ! -f "$STAGE_DIR/dist/server.js" ]; then
    echo "❌ Backend build failed: server.js not found"
    ls -la "$STAGE_DIR/dist"
    exit 1
fi

pm2 delete naitalk 2>/dev/null || true

pm2 start "$STAGE_DIR/dist/server.js" \
  --name naitalk \
  --cwd "$STAGE_DIR" \
  --env production

pm2 save
pm2 status

echo "✅ Deployment complete!"