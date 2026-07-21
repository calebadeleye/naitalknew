#!/bin/bash

# Exit on any error
set -e

# Always run from the repo root, regardless of where this script is invoked from
cd "$(dirname "$0")"

echo "🚀 Starting deployment..."

# Pull latest changes from git
git pull origin main

echo "📦 Installing frontend dependencies..."
# It's better to use npm ci for production, but we'll stick to their request with clean
rm -rf node_modules package-lock.json
npm install

echo "🖼️  Optimizing images (WebP conversion + upload de-dupe)..."
# storage/site-content.json and public/uploads/admin/* are gitignored
# (server-local state), so a git pull never touches them -- this backfill has
# to run here, on the server, every deploy. It's idempotent: already-optimized
# files are skipped unless --force is passed, so re-running costs nothing.
node scripts/optimize-images.mjs

echo "🏗️ Building frontend..."
npm run build

# -----------------------------
# ✅ Check build exists
# -----------------------------
if [ ! -d "dist" ]; then
    echo "❌ Build failed: dist folder not found"
    exit 1
fi

echo "📄 Prerendering public pages (SEO snapshots)..."
# Snapshots every public route (plus every published blog/KB article, fetched
# live from the still-running old backend below) into dist/prerendered/ for
# server.js to serve in place of the bare SPA shell. Non-fatal by design --
# see scripts/prerender.mjs: a route that fails or times out is just skipped,
# never blocks the deploy.
node scripts/prerender.mjs || echo "⚠️  Prerendering had issues -- continuing deploy, affected routes fall back to client-side rendering."

# -----------------------------
# ✅ Deploy the Laravel backend
# -----------------------------
echo "🐘 Installing backend dependencies..."
cd backend

composer install --no-dev --optimize-autoloader --no-interaction

echo "🗄️ Running database migrations..."
php artisan migrate --force

echo "⚙️ Caching backend config..."
php artisan config:cache

echo "🔁 Restarting queue workers..."
# Signals the supervisor-managed queue:work processes to restart so they
# pick up the new code. Supervisor's autorestart=true brings them back up.
php artisan queue:restart

cd ..

# -----------------------------
# ✅ Start the Production Server with PM2
# -----------------------------
# CRITICAL: We start the server.js file, NOT just serve the dist folder.
# server.js handles both the API and serving the dist folder.
#
# The live process is named "naitalk-react" (started directly as
# `server.js`, listening on the port the Apache vhost proxies to). An
# earlier version of this script instead managed a process named
# "naitalk-api" started via `npm start` -- since package.json has no
# "start" script, npm's implicit default (`node server.js`) meant that
# process also ran server.js, but on the SAME port naitalk-react already
# held. Every deploy since then restarted/recreated naitalk-api, which
# instantly crashed with EADDRINUSE and got auto-restarted by PM2 forever,
# while naitalk-react -- the process actually serving traffic -- was never
# restarted, so new code never went live. Fixed to manage naitalk-react
# directly, and to clean up the crash-looping naitalk-api process.
echo "🔄 Restarting application with PM2..."
pm2 delete naitalk-api 2>/dev/null || true

if pm2 describe naitalk-react > /dev/null 2>&1; then
    pm2 restart naitalk-react --update-env
else
    pm2 start server.js --name naitalk-react
fi

pm2 save
pm2 status

echo ""
echo "✅ Deployment complete!"
echo "📡 Your server is running. Make sure your .env file is in the same folder as server.js"
