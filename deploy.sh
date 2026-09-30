#!/bin/bash

# Exit on any error
set -e

# Always run from the repo root, regardless of where this script is invoked from
cd "$(dirname "$0")"

echo "🚀 Starting deployment..."

# This account (naitalk2naitalk) shares its UID with another account on this
# shared box (web9). Every UID-based lookup -- OpenSSH's own ~/.ssh/*
# resolution, `whoami`, `id -un`, `getent passwd $(whoami)` -- resolves
# ambiguously between the two and was returning web9's entry instead of
# this account's own, so plain `git pull` could never find this account's
# real known_hosts or deploy key. The one thing that *isn't* ambiguous is
# the literal username string (only one passwd entry is named exactly
# "naitalk2naitalk"), so the path below is intentionally hardcoded rather
# than derived from any OS identity lookup, all of which are unreliable
# for this specific account on this box.
NAITALK2NAITALK_HOME="/var/www/clients/client4/web9/home/naitalk2naitalk"
export GIT_SSH_COMMAND="ssh -i ${NAITALK2NAITALK_HOME}/.ssh/deploykey -o IdentitiesOnly=yes -o UserKnownHostsFile=${NAITALK2NAITALK_HOME}/.ssh/known_hosts -o StrictHostKeyChecking=accept-new"

# Pull latest changes from git
git pull origin main

echo "📦 Installing frontend dependencies..."
# It's better to use npm ci for production, but we'll stick to their request with clean
rm -rf node_modules package-lock.json
# --legacy-peer-deps: a clean install with no lockfile was hitting a known npm
# arborist bug ("Cannot read properties of null (reading 'edgesOut')") while
# resolving vitest's browser-mode peer tree (@vitest/browser-playwright ->
# nested vitest/jsdom/canvas) -- confirmed in production's own npm debug log.
# The crash happens during peer *resolution* itself, so --omit=dev alone
# doesn't avoid it (confirmed by testing); --legacy-peer-deps skips npm 7+'s
# strict automatic peer-conflict resolution entirely, which is the actual
# code path that crashes.
npm install --legacy-peer-deps

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

echo "🛣️  Caching routes..."
# A stale routes-v7.php from a one-off manual `route:cache` (2026-07-16) sat
# untouched by every deploy since -- this step never ran here before, so any
# route added after that date silently 404'd in production no matter how
# clean the deploy looked. route:cache always overwrites the old file with
# the current routes/*.php, so this is safe to run on every deploy.
php artisan route:cache

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
