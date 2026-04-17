#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting deployment..."

# Pull latest changes from git
git pull origin main

echo "📦 Installing dependencies..."
# It's better to use npm ci for production, but we'll stick to their request with clean
rm -rf node_modules package-lock.json
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
# ✅ Start the Production Server with PM2
# -----------------------------
# CRITICAL: We start the server.js file, NOT just serve the dist folder.
# server.js handles both the API and serving the dist folder.
echo "🔄 Restarting application with PM2..."
pm2 delete naitalk 2>/dev/null || true

# We run 'npm start' which sets NODE_ENV=production and runs server.js
pm2 start npm --name naitalk -- start

pm2 save
pm2 status

echo ""
echo "✅ Deployment complete!"
echo "📡 Your server is running. Make sure your .env file is in the same folder as server.js"
