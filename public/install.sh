#!/bin/bash

# =========================================================
# ALABA HOSTING PLATFORM INSTALLER (Alaba Cluster Edition)
# Optimized for: Ubuntu 22.04 / 24.04
# Stack: NGINX + Node.js 20 + MySQL + Bind9 + Postfix
# =========================================================

set -e

clear
echo "======================================================"
echo "         ALABA HOSTING PLATFORM INSTALLER"
echo "      Automated B2B Hosting Company Deployment"
echo "======================================================"

# ----------------------------
# Root Check
# ----------------------------
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run this installer as root."
  exit 1
fi

# ----------------------------
# OS Check
# ----------------------------
if ! command -v lsb_release >/dev/null 2>&1; then
  apt update && apt install -y lsb-release
fi

OS_VERSION=$(lsb_release -rs)

if [[ "$OS_VERSION" != "22.04" && "$OS_VERSION" != "24.04" ]]; then
  echo "ERROR: Ubuntu 22.04 or 24.04 required."
  exit 1
fi

# ----------------------------
# User Input
# ----------------------------
read -p "Enter your ALABA License Key: " LICENSE_KEY
read -p "Primary Domain (e.g alaba.ng): " DOMAIN
read -p "Admin Email (e.g info@$DOMAIN): " ADMIN_EMAIL
read -s -p "Admin Password: " ADMIN_PASS
echo ""
read -p "Install Mail Stack (Postfix/Dovecot/Roundcube)? (y/n): " INSTALL_MAIL

# ----------------------------
# System Update
# ----------------------------
echo "Updating server..."
apt update && apt upgrade -y

# ----------------------------
# Core Packages
# ----------------------------
echo "Installing core packages..."
apt install -y curl wget unzip git software-properties-common ca-certificates gnupg2 \
nginx ufw certbot python3-certbot-nginx zip fail2ban build-essential

# ----------------------------
# Node.js 20.x
# ----------------------------
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# ----------------------------
# PM2
# ----------------------------
npm install -g pm2

# ----------------------------
# MySQL Server
# ----------------------------
echo "Installing MySQL..."
apt install -y mysql-server

# ----------------------------
# PHP-FPM (for phpMyAdmin & Webmail)
# ----------------------------
echo "Installing PHP Stack..."
apt install -y php-fpm php-cli php-mysql php-curl php-xml php-mbstring php-zip phpmyadmin

# ----------------------------
# Bind9
# ----------------------------
echo "Installing Bind9..."
apt install -y bind9 bind9utils bind9-doc dnsutils

# ----------------------------
# Mail Stack
# ----------------------------
if [[ "$INSTALL_MAIL" =~ ^[Yy]$ ]]; then
  echo "Installing Mail Stack..."
  debconf-set-selections <<< "postfix postfix/mailname string $DOMAIN"
  debconf-set-selections <<< "postfix postfix/main_mailer_type string 'Internet Site'"
  apt install -y postfix dovecot-core dovecot-imapd dovecot-pop3d roundcube roundcube-core \
  opendkim opendkim-tools spamassassin
fi

# ----------------------------
# Firewall
# ----------------------------
echo "Configuring firewall..."
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw allow 53
ufw allow 25
ufw allow 465
ufw allow 587
ufw allow 143
ufw allow 993
ufw --force enable

# ----------------------------
# Directory Structure
# ----------------------------
mkdir -p /var/www/alaba
mkdir -p /var/log/alaba

# ----------------------------
# Download Application
# ----------------------------
echo "Downloading ALABA Application..."
cd /var/www
git clone https://github.com/calebadeleye/alaba.git alaba || true # Replace with actual repo

# ----------------------------
# Application Setup
# ----------------------------
echo "Setting up application..."
cd /var/www/alaba
npm install

# ----------------------------
# MySQL DB Setup
# ----------------------------
echo "Configuring MySQL Database..."
DB_NAME="alaba_cluster"
DB_USER="alaba_admin"
DB_PASS=$(openssl rand -base64 16)

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

# Import Schema
if [ -f schema.sql ]; then
  mysql -u root $DB_NAME < schema.sql
fi

# Insert Admin User
echo "Creating Admin Account..."
HASHED_PASS=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$ADMIN_PASS', 10));")
mysql -u root $DB_NAME -e "INSERT INTO admins (full_name, email, password_hash, status) VALUES ('Alaba Admin', '$ADMIN_EMAIL', '$HASHED_PASS', 'active') ON DUPLICATE KEY UPDATE password_hash='$HASHED_PASS';"

# ----------------------------
# Environment Config
# ----------------------------
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
SMTP_FROM_NAME="Alaba Cluster Notifications"
EOL

# ----------------------------
# Build Application
# ----------------------------
echo "Building React Frontend..."
npm run build

# ----------------------------
# NGINX Configuration
# ----------------------------
echo "Configuring NGINX..."
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
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /phpmyadmin {
        root /usr/share/;
        index index.php index.html index.htm;

        location ~ ^/phpmyadmin/(.+\.php)$ {
            root /usr/share/;
            fastcgi_pass unix:/run/php/php8.1-fpm.sock; # Adjust based on installed version
            fastcgi_index index.php;
            include /etc/nginx/fastcgi_params;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        }
    }
}
EOL

ln -sf /etc/nginx/sites-available/alaba /etc/nginx/sites-enabled/alaba
rm -f /etc/nginx/sites-enabled/default

# ----------------------------
# DNS Configuration (Bind9)
# ----------------------------
echo "Configuring Bind9 DNS..."
NS1="ns1.$DOMAIN"
NS2="ns2.$DOMAIN"
SERVER_IP=$(curl -4 -s ifconfig.me || echo "127.0.0.1")

cat > /etc/bind/db.$DOMAIN <<EOL
\$TTL 86400
@   IN  SOA $NS1. admin.$DOMAIN. (
        $(date +%Y%m%d%H)
        3600
        1800
        604800
        86400 )

@       IN NS    $NS1.
@       IN NS    $NS2.

@       IN A     $SERVER_IP
www     IN A     $SERVER_IP
ns1     IN A     $SERVER_IP
ns2     IN A     $SERVER_IP
mail    IN A     $SERVER_IP
webmail IN A     $SERVER_IP

@       IN MX 10 mail.$DOMAIN.
@       IN TXT "v=spf1 a mx ip4:$SERVER_IP ~all"
_dmarc  IN TXT "v=DMARC1; p=none;"
EOL

if ! grep -q "zone \"$DOMAIN\"" /etc/bind/named.conf.local; then
  cat >> /etc/bind/named.conf.local <<EOL
zone "$DOMAIN" {
    type master;
    file "/etc/bind/db.$DOMAIN";
};
EOL
fi

# ----------------------------
# SSL Installation
# ----------------------------
echo "Setting up SSL with Certbot..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $ADMIN_EMAIL || true

# ----------------------------
# PM2 Startup
# ----------------------------
echo "Starting ALABA Backend..."
pm2 start server.js --name "alaba"
pm2 save
pm2 startup | tail -n 1 | bash

# ----------------------------
# Permissions
# ----------------------------
chown -R www-data:www-data /var/www/alaba

# ----------------------------
# Final Output
# ----------------------------
echo ""
echo "======================================================"
echo "        ALABA INSTALLATION COMPLETED SUCCESSFULLY"
echo "======================================================"
echo "Platform URL:    https://$DOMAIN"
echo "MySQL Database:  $DB_NAME"
echo "MySQL User:      $DB_USER"
echo "MySQL Password:  $DB_PASS"
echo "Admin Email:     $ADMIN_EMAIL"
echo "======================================================"
echo "IMPORTANT: Open https://$DOMAIN/register to set up your primary admin account."
echo "======================================================"
