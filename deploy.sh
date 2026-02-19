#!/usr/bin/env bash
# =============================================================================
#  Telro — One-Click Docker Deployment Script
#  Usage:
#    chmod +x deploy.sh
#    ./deploy.sh              # First-time deploy
#    ./deploy.sh update       # Pull code & redeploy (keep volumes)
#    ./deploy.sh logs         # Stream logs from all containers
#    ./deploy.sh down         # Stop and remove containers
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"

# ── Sub-command dispatch ──────────────────────────────────────────────────────
case "${1:-deploy}" in
  update)
    info "Pulling latest code…"
    git -C "$PROJECT_DIR" pull --ff-only 2>/dev/null || warn "git pull skipped (not a git repo or already up-to-date)"
    info "Rebuilding and restarting containers (volumes preserved)…"
    docker compose -f "$COMPOSE_FILE" up --build -d
    success "Update complete."
    exit 0
    ;;
  logs)
    exec docker compose -f "$COMPOSE_FILE" logs -f --tail=100
    ;;
  down)
    warn "Stopping Telro containers…"
    docker compose -f "$COMPOSE_FILE" down
    success "Containers stopped."
    exit 0
    ;;
  deploy)
    : # fall through to main deploy logic below
    ;;
  *)
    echo "Usage: $0 [deploy|update|logs|down]"
    exit 1
    ;;
esac

# =============================================================================
#  DEPLOY
# =============================================================================

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   Telro — Docker 一键部署             ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Check Docker ───────────────────────────────────────────────────────────
info "检查 Docker 环境…"
command -v docker &>/dev/null  || error "Docker 未安装。请先安装 Docker: https://docs.docker.com/get-docker/"
docker info &>/dev/null        || error "Docker daemon 未运行，请先启动 Docker。"

# Check docker compose (v2 plugin preferred, fall back to v1)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  warn "使用 docker-compose v1，建议升级到 Docker Compose v2。"
else
  error "未找到 docker compose。请安装 Docker Desktop 或 Docker Compose 插件。"
fi

success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
success "$($COMPOSE_CMD version | head -1)"

# ── 2. Check .env ─────────────────────────────────────────────────────────────
info "检查 .env 配置文件…"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    warn ".env 不存在，已从 .env.example 复制。"
    warn "请编辑 $ENV_FILE，填写真实的配置值（JWT_SECRET、ASTERISK_SECRET 等），然后重新运行此脚本。"
    echo ""
    echo -e "${YELLOW}需要修改的关键配置：${RESET}"
    echo "  JWT_SECRET       — 使用 \`openssl rand -hex 64\` 生成"
    echo "  ASTERISK_HOST    — Asterisk 服务器 IP（默认 host.docker.internal）"
    echo "  ASTERISK_USER    — AMI 用户名"
    echo "  ASTERISK_SECRET  — AMI 密码"
    echo ""
    exit 1
  else
    error ".env 文件不存在，也找不到 .env.example。请手动创建 .env 后重试。"
  fi
fi

# Warn on default secrets
if grep -q "CHANGE_ME" "$ENV_FILE"; then
  warn ".env 中仍有 CHANGE_ME 占位符。生产环境请务必修改！"
fi

success ".env 文件已就绪"

# ── 3. Build images ───────────────────────────────────────────────────────────
info "构建 Docker 镜像（首次构建可能需要 3–10 分钟）…"
$COMPOSE_CMD -f "$COMPOSE_FILE" build --progress=plain

# ── 4. Start services ─────────────────────────────────────────────────────────
info "启动容器…"
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d

# ── 5. Wait for health ────────────────────────────────────────────────────────
info "等待服务就绪…"
MAX_WAIT=90
WAIT=0
while [[ $WAIT -lt $MAX_WAIT ]]; do
  STATUS=$($COMPOSE_CMD -f "$COMPOSE_FILE" ps --format json 2>/dev/null \
    | python3 -c "
import sys, json
lines = sys.stdin.read().strip().split('\n')
statuses = []
for line in lines:
    if line.strip():
        try:
            obj = json.loads(line)
            statuses.append(obj.get('Health', obj.get('State', '')))
        except:
            pass
all_healthy = all(s in ('healthy', 'running') for s in statuses)
print('ok' if all_healthy and statuses else 'wait')
" 2>/dev/null || echo "wait")

  if [[ "$STATUS" == "ok" ]]; then
    break
  fi
  sleep 3
  WAIT=$((WAIT + 3))
  printf "."
done
echo ""

if [[ $WAIT -ge $MAX_WAIT ]]; then
  warn "等待超时，服务可能仍在启动中，请用 './deploy.sh logs' 查看详情。"
else
  success "所有容器已就绪！"
fi

# ── 6. Print status & access info ────────────────────────────────────────────
echo ""
$COMPOSE_CMD -f "$COMPOSE_FILE" ps

# Detect public IP
PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║        Telro 部署完成 🎉                      ║${RESET}"
echo -e "${BOLD}╠══════════════════════════════════════════════╣${RESET}"
echo -e "║  前端界面: ${GREEN}http://${PUBLIC_IP}${RESET}               "
echo -e "║  API  地址: ${GREEN}http://${PUBLIC_IP}/api${RESET}           "
echo -e "║  默认账号:  admin / admin123                "
echo -e "${BOLD}╠══════════════════════════════════════════════╣${RESET}"
echo -e "║  查看日志:  ${CYAN}./deploy.sh logs${RESET}                 "
echo -e "║  停止服务:  ${CYAN}./deploy.sh down${RESET}                 "
echo -e "║  更新部署:  ${CYAN}./deploy.sh update${RESET}               "
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""
