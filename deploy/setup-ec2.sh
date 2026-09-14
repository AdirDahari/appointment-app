#!/usr/bin/env bash
# First-time setup of a fresh Ubuntu 22.04/24.04 EC2 instance.
#
#   curl -fsSL https://raw.githubusercontent.com/AdirDahari/appointment-app/main/deploy/setup-ec2.sh | bash -s -- tor.example.com
#
# or clone the repo and run:  bash deploy/setup-ec2.sh tor.example.com
#
# What it does: installs Python, Node, Caddy; clones the repo to /opt/appointment-app;
# creates the venv, builds the frontend, installs the systemd service and the
# Caddy config. It does NOT fill in .env — do that afterwards (see README).
set -euo pipefail

DOMAIN="${1:-}"
REPO_URL="${REPO_URL:-https://github.com/AdirDahari/appointment-app.git}"
APP_DIR="/opt/appointment-app"
APP_USER="${APP_USER:-ubuntu}"

if [[ -z "$DOMAIN" ]]; then
  echo "usage: $0 <domain>   e.g. $0 tor.example.com" >&2
  exit 1
fi

echo "==> System packages"
sudo apt-get update -y
sudo apt-get install -y git python3 python3-venv python3-pip curl debian-keyring debian-archive-keyring apt-transport-https ca-certificates

echo "==> Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

echo "==> Code -> $APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
  sudo mkdir -p "$APP_DIR"
  sudo chown "$APP_USER":"$APP_USER" "$APP_DIR"
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> Backend venv"
cd "$APP_DIR/backend"
sudo -u "$APP_USER" python3 -m venv venv
sudo -u "$APP_USER" venv/bin/pip install --upgrade pip
sudo -u "$APP_USER" venv/bin/pip install -r requirements.txt
sudo -u "$APP_USER" mkdir -p "$APP_DIR/secret"
if [[ ! -f .env ]]; then
  sudo -u "$APP_USER" cp .env.example .env
  echo "    created backend/.env from .env.example — FILL IT IN before starting"
fi

echo "==> Frontend build"
cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build

echo "==> systemd service"
sudo cp "$APP_DIR/deploy/appointment-app.service" /etc/systemd/system/appointment-app.service
sudo sed -i "s/^User=.*/User=$APP_USER/" /etc/systemd/system/appointment-app.service
sudo systemctl daemon-reload
sudo systemctl enable appointment-app

echo "==> Caddy config for $DOMAIN"
sudo sed "s/tor.example.com/$DOMAIN/" "$APP_DIR/deploy/Caddyfile" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl enable caddy
sudo systemctl restart caddy

cat <<EOF

Done. Next steps:
  1. Edit $APP_DIR/backend/.env  (at minimum OWNER_USERNAME, OWNER_PASSWORD, SECRET_KEY;
     generate VAPID keys with: cd $APP_DIR/backend && venv/bin/python -m app.scripts.generate_vapid)
  2. Copy the Google service-account JSON to $APP_DIR/secret/service-account.json (when you have it)
  3. sudo systemctl start appointment-app
  4. sudo journalctl -u appointment-app -f      # watch the startup log
  5. Open https://$DOMAIN
EOF
