#!/bin/bash

set -euo pipefail

# ===============================
# ALABA HOSTING INSTALLER (SAFE)
# ===============================

LOG_FILE="/var/log/alaba-install.log"
mkdir -p /var/log/alaba
exec > >(tee -a "$LOG_FILE") 2>&1

echo "======================================================"
echo "        ALABA HOSTING INSTALLER (SAFE MODE)"
echo "======================================================"

# -------------------------------
# ROOT CHECK
# -------------------------------
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run as root"
  exit 1
fi

# -------------------------------
# APT LOCK RECOVERY
# -------------------------------
echo "[INIT] Cleaning apt locks..."
rm -f /var/lib/dpkg/lock-frontend || true
rm -f /var/lib/dpkg/lock || true
rm -f /var/cache/apt/archives/lock || true
dpkg --configure -a || true
apt --fix-broken install -y || true

# -------------------------------
# USER INPUT
# -------------------------------
read -p "License Key: " LICENSE_KEY
read -p "Domain (e.g alaba.ng): " DOMAIN
read -p "Admin Email: " ADMIN_EMAIL
read -s -p "Admin Password: " ADMIN_PASS
echo ""
read -p "Install Mail Stack? (y/n): " INSTALL_MAIL

# -------------------------------
# HELPERS
# -------------------------------
is_installed() {
  dpkg -s "$1" >/dev/null 2>&1
}

install_package() {
  if is_installed "$1"; then
    echo "[SKIP] $1 already installed"
  else
    echo "[INSTALL] $1"
    apt install -y "$1"
  fi
}

cmd_exists() {
  command -v "$1" >/dev/null 2>&1
}

# -------------------------------
# UPDATE SYSTEM
# -------------------------------
apt update -y
apt upgrade -y

# -------------------------------
# CORE PACKAGES
# -------------------------------
for pkg in curl wget unzip git software-properties-common ca-certificates gnupg2 nginx ufw certbot python3-certbot-nginx zip fail2ban build-essential; do
  install_package "$pkg"
done

# -------------------------------
# NODEJS
# -------------------------------
if ! cmd_exists node || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  echo "[INSTALL] Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  echo "[SKIP] Node.js already OK"
fi

# -------------------------------
# PM2
# -------------------------------
if ! cmd_exists pm2; then
  npm install -g pm2
else
  echo "[SKIP] PM2 exists"
fi

# -------------------------------
# MYSQL
# -------------------------------
install_package mysql-server

# -------------------------------
# PHP STACK
# -------------------------------
for pkg in php-fpm php-cli php-mysql php-curl php-xml php-mbstring php-zip phpmyadmin; do
  install_package "$pkg"
done

# -------------------------------
# BIND9
# -------------------------------
for pkg in bind9 bind9utils bind9-doc dnsutils; do
  install_package "$pkg"
done

# -------------------------------
# MAIL STACK
# -------------------------------
if [[ "$INSTALL_MAIL" =~ ^[Yy]$ ]]; then
  install_package postfix
  install_package dovecot-core
  install_package dovecot-imapd
  install_package dovecot-pop3d
  install_package roundcube
  install_package opendkim-tools
  install_package spamassassin
fi

# -------------------------------
# FIREWALL
# -------------------------------
ufw allow OpenSSH || true
ufw allow 80 || true
ufw allow 443 || true
ufw allow 53 || true
ufw allow 25 || true
ufw allow 465 || true
ufw allow 587 || true
ufw allow 143 || true
ufw allow 993 || true
ufw --force enable || true

# -------------------------------
# APP DOWNLOAD (ZIP INSTALL - NO GIT AUTH ISSUES)
# -------------------------------
echo "[DOWNLOAD] Installing ALABA application..."

mkdir -p /var/www/alaba
mkdir -p /var/log/alaba

cd /var/www

rm -rf alaba alaba.zip

curl -L https://github.com/calebadeleye/alaba/archive/refs/heads/main.zip -o alaba.zip
unzip alaba.zip

mv alaba-main alaba
rm alaba.zip

cd /var/www/alaba

echo "[INSTALL] Installing dependencies..."
npm install

# -------------------------------
# MYSQL SETUP
# -------------------------------
DB_NAME="alaba_cluster"
DB_USER="alaba_admin"
DB_PASS=$(openssl rand -base64 16)

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

# -------------------------------
# SCHEMA IMPORT SAFE
# -------------------------------
TABLE_CHECK=$(mysql -u root -D $DB_NAME -se "SHOW TABLES LIKE 'admins';")

if [ -z "$TABLE_CHECK" ] && [ -f schema.sql ]; then
  mysql -u root $DB_NAME < schema.sql
else
  echo "[SKIP] DB already initialized"
fi

# -------------------------------
# ADMIN INSERT
# -------------------------------
HASHED_PASS=$(node -e "const bcrypt=require('bcryptjs');console.log(bcrypt.hashSync('$ADMIN_PASS',10));")

mysql -u root $DB_NAME -e "
INSERT INTO admins (full_name,email,password_hash,status)
VALUES ('Alaba Admin','$ADMIN_EMAIL','$HASHED_PASS','active')
ON DUPLICATE KEY UPDATE password_hash='$HASHED_PASS';
"

# -------------------------------
# ENV FILE
# -------------------------------
cat > .env <<EOL
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
ADMIN_EMAIL=$ADMIN_EMAIL
APP_DOMAIN=$DOMAIN
EOL

# -------------------------------
# BUILD APP
# -------------------------------
npm run build || true

# -------------------------------
# NGINX CONFIG
# -------------------------------
PHP_SOCKET=$(ls /run/php/ | grep fpm.sock | head -n 1)

cat > /etc/nginx/sites-available/alaba <<EOL
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root /var/www/alaba/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /phpmyadmin {
        root /usr/share/;
        index index.php;

        location ~ ^/phpmyadmin/(.+\.php)$ {
            root /usr/share/;
            fastcgi_pass unix:/run/php/$PHP_SOCKET;
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        }
    }
}
EOL

ln -sf /etc/nginx/sites-available/alaba /etc/nginx/sites-enabled/alaba
rm -f /etc/nginx/sites-enabled/default || true

nginx -t && systemctl restart nginx

# -------------------------------
# SSL
# -------------------------------
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $ADMIN_EMAIL || true
else
  echo "[SKIP] SSL exists"
fi

# -------------------------------
# PM2 START
# -------------------------------
if pm2 list | grep -q alaba; then
  pm2 restart alaba || true
else
  pm2 start server.js --name alaba
fi

pm2 save || true
pm2 startup || true

# -------------------------------
# PERMISSIONS
# -------------------------------
chown -R www-data:www-data /var/www/alaba || true

# -------------------------------
# FINAL OUTPUT
# -------------------------------
echo "======================================================"
echo " INSTALLATION COMPLETE"
echo "======================================================"
echo "URL: https://$DOMAIN"
echo "DB: $DB_NAME"
echo "DB USER: $DB_USER"
echo "DB PASS: $DB_PASS"
echo "======================================================"