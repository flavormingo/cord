#!/bin/bash

# cord deployment script for ubuntu vps

set -e

echo "setting up cord..."

# install node.js if not present
if ! command -v node &> /dev/null; then
    echo "installing node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# install build essentials for native modules
sudo apt-get install -y build-essential python3

# create app directory
sudo mkdir -p /var/www/cord
sudo chown -R $USER:$USER /var/www/cord

# copy files (run from project root)
echo "copying files..."
cp -r ./* /var/www/cord/
cp .env /var/www/cord/

# install dependencies
cd /var/www/cord
npm install --production

# setup systemd service
echo "setting up systemd service..."
sudo cp deploy/cord.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cord
sudo systemctl start cord

# setup nginx
echo "setting up nginx..."
sudo apt-get install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/cord
sudo ln -sf /etc/nginx/sites-available/cord /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# get ssl certificate
echo "getting ssl certificate..."
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cord.zany.digital --non-interactive --agree-tos --email admin@zany.digital

# restart services
sudo systemctl restart nginx
sudo systemctl restart cord

echo "cord is now running at https://cord.zany.digital"
echo ""
echo "configure your slack app:"
echo "  - event subscriptions url: https://cord.zany.digital/slack/events"
echo "  - subscribe to: message.channels, message.groups"
echo "  - oauth redirect url: https://cord.zany.digital/auth/slack/callback"
echo ""
echo "configure your discord app:"
echo "  - oauth2 redirect url: https://cord.zany.digital/auth/discord/callback"
