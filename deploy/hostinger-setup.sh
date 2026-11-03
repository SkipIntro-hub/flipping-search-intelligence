#!/usr/bin/env bash
# =============================================================================
# Flipping Search Intelligence — Script de Provisión para VPS Hostinger (Ubuntu/Debian)
# Uso en el VPS:
#   curl -sSL https://raw.githubusercontent.com/SkipIntro-hub/flipping-search-intelligence/main/deploy/hostinger-setup.sh | bash
#   o bien dentro del repositorio clonado:
#   bash deploy/hostinger-setup.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/flipping-search-intelligence"
REPO_URL="${REPO_URL:-https://github.com/SkipIntro-hub/flipping-search-intelligence.git}"

echo "==> [1/5] Verificando Docker y Docker Compose en el VPS Hostinger..."
if ! command -v docker >/dev/null 2>&1; then
  echo "Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

echo "==> [2/5] Preparando directorio de aplicación en ${APP_DIR}..."
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  cd "${APP_DIR}"
  git pull origin main
fi

cd "${APP_DIR}"

echo "==> [3/5] Configurando archivo .env de producción..."
if [ ! -f .env ]; then
  RANDOM_PASS=$(openssl rand -hex 16)
  cat > .env <<EOF
PORT=3000
APP_PORT=3000
POSTGRES_USER=flipping
POSTGRES_PASSWORD=${RANDOM_PASS}
POSTGRES_DB=flipping_search
USIG_NORMALIZER_ENABLED=true
EOF
  echo "Archivo .env generado con contraseña segura para PostGIS."
fi

echo "==> [4/5] Construyendo y levantando contenedores (App + PostGIS)..."
docker compose -f docker-compose.prod.yml up -d --build

echo "==> [5/5] Verificando estado de salud (/api/health)..."
sleep 5
curl -fsS http://localhost:3000/api/health || true

echo ""
echo "======================================================================"
echo "✓ Flipping Search Intelligence desplegado exitosamente en el VPS!"
echo "  URL Directa: http://$(hostname -I | awk '{print $1}'):3000"
echo "======================================================================"
