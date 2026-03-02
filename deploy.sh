#!/bin/bash
# =============================================================================
# Diagram App — Production Deployment Script for Clean Ubuntu 22.04/24.04
# Host: 155.212.216.159
#
# Usage:
#   1. Copy entire project to server:  scp -r diagram-app/ root@155.212.216.159:/opt/
#   2. SSH into server:                ssh root@155.212.216.159
#   3. Run this script:                cd /opt/diagram-app && bash deploy.sh
# =============================================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${APP_DIR}/.env"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 1. System update & essential packages
# ─────────────────────────────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

log "Installing prerequisites..."
apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    unattended-upgrades \
    git \
    wget \
    htop \
    nano

# ─────────────────────────────────────────────────────────────────────────────
# 2. Install Docker Engine (official method)
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    log "Installing Docker Engine..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    log "Docker installed: $(docker --version)"
else
    log "Docker already installed: $(docker --version)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Configure UFW Firewall
# ─────────────────────────────────────────────────────────────────────────────
log "Configuring firewall (UFW)..."
ufw --force reset > /dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'
ufw --force enable
log "Firewall configured: SSH(22), HTTP(80), HTTPS(443) open"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Configure fail2ban
# ─────────────────────────────────────────────────────────────────────────────
log "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 3
EOF
systemctl enable fail2ban
systemctl restart fail2ban
log "fail2ban configured"

# ─────────────────────────────────────────────────────────────────────────────
# 5. System tuning
# ─────────────────────────────────────────────────────────────────────────────
log "Applying system tuning..."
cat > /etc/sysctl.d/99-diagram-app.conf <<'EOF'
# Network tuning
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1

# File descriptors
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288

# VM tuning
vm.swappiness = 10
vm.overcommit_memory = 1
EOF
sysctl -p /etc/sysctl.d/99-diagram-app.conf > /dev/null 2>&1 || true

# ─────────────────────────────────────────────────────────────────────────────
# 6. Generate .env file (if not exists)
# ─────────────────────────────────────────────────────────────────────────────
cd "${APP_DIR}"

if [ ! -f "${ENV_FILE}" ]; then
    log "Generating .env with secure random secrets..."

    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n/+=')
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n/+=')
    ENCRYPTION_KEY=$(openssl rand -hex 32)

    cat > "${ENV_FILE}" <<EOF
# Auto-generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Diagram App Production Environment

SERVER_IP=155.212.216.159
DOMAIN=155.212.216.159
ENVIRONMENT=production

POSTGRES_USER=diagram
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=diagram_db

REDIS_PASSWORD=${REDIS_PASSWORD}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=168h

ENCRYPTION_KEY=${ENCRYPTION_KEY}

CORS_ORIGINS=http://155.212.216.159,https://155.212.216.159

GIN_MODE=release
MAX_FILE_SIZE=52428800
LOG_LEVEL=info
EOF

    chmod 600 "${ENV_FILE}"
    log ".env generated with random secrets (chmod 600)"
else
    warn ".env already exists — skipping generation. Review it manually!"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. Create required directories
# ─────────────────────────────────────────────────────────────────────────────
mkdir -p "${APP_DIR}/nginx/ssl"

# ─────────────────────────────────────────────────────────────────────────────
# 8. Build & Start
# ─────────────────────────────────────────────────────────────────────────────
log "Building and starting containers..."
docker compose -f docker-compose.prod.yml --env-file .env down --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.prod.yml --env-file .env build --no-cache
docker compose -f docker-compose.prod.yml --env-file .env up -d

# ─────────────────────────────────────────────────────────────────────────────
# 9. Wait for services to be healthy
# ─────────────────────────────────────────────────────────────────────────────
log "Waiting for services to become healthy..."
TRIES=0
MAX_TRIES=30
while [ $TRIES -lt $MAX_TRIES ]; do
    HEALTHY=$(docker compose -f docker-compose.prod.yml ps --format json 2>/dev/null | grep -c '"healthy"' || echo 0)
    TOTAL=$(docker compose -f docker-compose.prod.yml ps --format json 2>/dev/null | wc -l || echo 0)
    
    if [ "$HEALTHY" -ge 4 ]; then
        break
    fi
    
    TRIES=$((TRIES + 1))
    sleep 5
done

echo ""
log "========================================="
log "  Deployment complete!"
log "========================================="
echo ""
docker compose -f docker-compose.prod.yml ps
echo ""
log "Application: http://155.212.216.159"
log "API Health:  http://155.212.216.159/api/v1/health (via nginx → backend)"
log "Backend:     http://155.212.216.159/health (direct nginx)"
echo ""
warn "NEXT STEPS:"
echo "  1. Verify: curl -s http://155.212.216.159/health"
echo "  2. Verify: curl -s http://155.212.216.159/api/v1/health (should be empty since backend route is /health)"
echo "  3. Test app in browser: http://155.212.216.159"
echo ""
echo "  For SSL (optional):"
echo "    apt install certbot"
echo "    certbot certonly --webroot -w /var/www/certbot -d yourdomain.com"
echo "    # Then update nginx.prod.conf to enable HTTPS block"
echo ""
echo "  Useful commands:"
echo "    docker compose -f docker-compose.prod.yml logs -f          # All logs"
echo "    docker compose -f docker-compose.prod.yml logs -f backend  # Backend only"
echo "    docker compose -f docker-compose.prod.yml restart backend  # Restart service"
echo "    docker compose -f docker-compose.prod.yml down             # Stop all"
echo ""
