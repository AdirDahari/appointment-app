#!/usr/bin/env bash
# Deploy the latest main: pull, install, rebuild the frontend, restart.
#   bash /opt/appointment-app/deploy/update.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/appointment-app}"

cd "$APP_DIR"
git pull --ff-only

cd "$APP_DIR/backend"
venv/bin/pip install -r requirements.txt --quiet

cd "$APP_DIR/frontend"
npm ci --silent
npm run build

sudo systemctl restart appointment-app
sleep 2
sudo systemctl --no-pager status appointment-app | head -5
curl -fsS http://127.0.0.1:8000/health && echo
