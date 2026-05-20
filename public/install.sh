#!/bin/bash

set -euo pipefail

# ===============================
# ALABA HOSTING INSTALLER (DOCKER-BASED)
# ===============================

echo "======================================================"
echo "        ALABA HOSTING INSTALLER (DOCKER MODE)"
echo "======================================================"

# -------------------------------
# ROOT CHECK
# -------------------------------
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run as root"
  exit 1
fi

# -------------------------------
# SYSTEM UPDATE
# -------------------------------
echo "[1/6] Updating system..."
apt update -y && apt upgrade -y

# -------------------------------
# INSTALL DEPENDENCIES
# -------------------------------
echo "[2/6] Installing base dependencies..."

apt install -y \
  curl \
  git \
  ca-certificates \
  gnupg \
  lsb-release \
  unzip

# -------------------------------
# INSTALL DOCKER
# -------------------------------
echo "[3/6] Installing Docker..."

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | bash
fi

systemctl enable docker
systemctl start docker

# Install docker compose plugin
if ! docker compose version >/dev/null 2>&1; then
  apt install -y docker-compose-plugin
fi

# -------------------------------
# CLEAN INSTALL DIRECTORY
# -------------------------------
echo "[4/6] Preparing application directory..."

APP_DIR="/var/www/alaba"

cd /var/www

rm -rf alaba alaba-main alaba.zip

echo "[5/6] Downloading application source..."

curl -L https://github.com/calebadeleye/alaba/archive/refs/heads/main.zip -o alaba.zip

unzip -o alaba.zip

mv alaba-main alaba

rm -f alaba.zip

cd $APP_DIR

# -------------------------------
# ENV PLACEHOLDER (NO SECRETS HERE)
# -------------------------------
echo "[6/6] Creating base environment file..."

cat > .env <<EOL
NODE_ENV=production
PORT=3000

# DB will be configured via /setup wizard
DB_HOST=db
DB_PORT=3306
DB_NAME=
DB_USER=
DB_PASSWORD=

SETUP_MODE=true
EOL

# -------------------------------
# START SYSTEM
# -------------------------------
echo "[START] Launching Docker stack..."

if [ ! -f docker-compose.yml ]; then
  echo "ERROR: docker-compose.yml not found in repo"
  exit 1
fi

docker compose up -d --build

# -------------------------------
# GET SERVER IP
# -------------------------------

SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || hostname -I | awk '{print $1}')

# -------------------------------
# FINAL OUTPUT
# -------------------------------
echo "======================================================"
echo " INSTALLATION COMPLETE"
echo "======================================================"
echo ""
echo "👉 Open your browser and complete setup:"
echo ""
echo "   http://$SERVER_IP"
echo ""
echo "👉 Setup page:"
echo ""
echo "   http://$SERVER_IP/setup"
echo ""
echo "======================================================"
echo " ALABA IS READY"
echo "======================================================"