#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 droplet. Run as root:
#   bash setup-droplet.sh
set -euo pipefail

# Docker Engine + compose plugin (official convenience script).
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# 2 GB swap: the droplet has 2 GB RAM shared by Postgres, Node and ffmpeg.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

# Firewall: SSH + HTTP/HTTPS only. Postgres is never exposed.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Automatic security updates.
apt-get update
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

mkdir -p /opt/marketingai/backups
echo "Listo. Copia docker-compose.yml, Caddyfile, backup.sh y .env a /opt/marketingai."
