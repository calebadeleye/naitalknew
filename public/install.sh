#!/bin/bash

set -e

echo "=== ALABA TRAEFIK AUTO INSTALLER (IP MODE) ==="

if [ "$EUID" -ne 0 ]; then
  echo "Run as root"
  exit 1
fi

apt update -y
apt install -y curl git unzip jq

# -------------------------------
# INSTALL DOCKER
# -------------------------------
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | bash
fi

systemctl enable docker
systemctl start docker

if ! docker compose version >/dev/null 2>&1; then
  apt install -y docker-compose-plugin
fi

# -------------------------------
# CLEAN APP INSTALL
# -------------------------------
cd /var/www
rm -rf alaba
curl -L https://github.com/calebadeleye/alaba/archive/refs/heads/main.zip -o alaba.zip
unzip -o alaba.zip
mv alaba-main alaba
rm alaba.zip

cd /var/www/alaba

# -------------------------------
# ENV (NO DOMAIN REQUIRED)
# -------------------------------
cat > .env <<EOF
NODE_ENV=production
PORT=3000
APP_URL=http://localhost
EOF

# -------------------------------
# LETSENCRYPT STORAGE
# -------------------------------
mkdir -p letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json

# -------------------------------
# TRAEFIK AUTO INSTALL
# -------------------------------
docker network create web || true

docker run -d \
  --name traefik \
  --restart always \
  -p 80:80 \
  -p 443:443 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $(pwd)/letsencrypt:/letsencrypt \
  --network web \
  traefik:v3.0 \
  --providers.docker=true \
  --providers.docker.exposedbydefault=false \
  --entrypoints.web.address=:80 \
  --entrypoints.websecure.address=:443 \
  --certificatesresolvers.le.acme.tlschallenge=true \
  --certificatesresolvers.le.acme.storage=/letsencrypt/acme.json

# -------------------------------
# START APP (NO DOMAIN YET)
# -------------------------------
docker compose down || true
docker compose up -d --build

# -------------------------------
# GET SERVER IP
# -------------------------------
IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "====================================="
echo " ALABA INSTALLED (IP MODE + TRAEFIK)"
echo "====================================="
echo ""
echo "👉 Open your server:"
echo "   http://$IP"
echo ""
echo "👉 SSL + domain setup will be done inside app"
echo ""
echo "====================================="