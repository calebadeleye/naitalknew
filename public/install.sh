#!/bin/bash

set -e

echo "=== ALABA TRAEFIK INSTALLER ==="

if [ "$EUID" -ne 0 ]; then
  echo "Run as root"
  exit 1
fi

read -p "Enter domain (e.g hosting.naitalk.com): " DOMAIN

apt update -y
apt install -y curl git unzip

# Install Docker
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | bash
fi

systemctl enable docker
systemctl start docker

if ! docker compose version >/dev/null 2>&1; then
  apt install -y docker-compose-plugin
fi

# App install
cd /var/www
rm -rf alaba
curl -L https://github.com/calebadeleye/alaba/archive/refs/heads/main.zip -o alaba.zip
unzip -o alaba.zip
mv alaba-main alaba
rm alaba.zip

cd /var/www/alaba

# ENV
cat > .env <<EOF
NODE_ENV=production
PORT=3000
APP_URL=https://$DOMAIN
EOF

# Create letsencrypt folder
mkdir -p letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json

# Start stack
docker compose down || true
docker compose up -d --build

echo ""
echo "====================================="
echo " ALABA IS LIVE (TRAEFIK MODE)"
echo "====================================="
echo "https://$DOMAIN"
echo "====================================="