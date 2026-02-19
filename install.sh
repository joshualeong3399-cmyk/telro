#!/usr/bin/env bash
# =============================================================================
#  Telro — 全栈一键安装脚本
#  在 Ubuntu 22.04 / 24.04 LTS 服务器上全自动完成:
#    1. 安装系统依赖 & Docker
#    2. 编译安装 Asterisk 20 LTS（含 AMI 配置）
#    3. 生成并写入 .env 环境变量
#    4. 用 Docker Compose 构建并启动 Telro 前后端
#    5. 配置防火墙、systemd 开机自启
#
#  使用方法:
#    git clone <repo> /opt/telro && cd /opt/telro
#    chmod +x install.sh
#    sudo ./install.sh
#
#  可选环境变量（覆盖默认值）:
#    TELRO_DIR        项目根目录,     默认脚本所在目录
#    AST_VERSION      Asterisk 版本,  默认 20.11.1
#    AMI_USER         AMI 用户名,     默认 telro
#    AMI_SECRET       AMI 密码,       默认随机生成
#    JWT_SECRET       JWT 密钥,       默认随机生成
#    WEB_PORT         前端 HTTP 端口, 默认 80
#    SKIP_ASTERISK    跳过 Asterisk 安装 (=1), 默认 0
#    SKIP_DOCKER      跳过 Docker 安装 (=1),   默认 0
# =============================================================================

set -euo pipefail

# ─── Colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}   $*"; }
success() { echo -e "${GREEN}[OK]${NC}     $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}   $*"; }
error()   { echo -e "${RED}[ERROR]${NC}  $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}════════════════════════════════════════════${NC}"; \
            echo -e "${BOLD}${BLUE}  $*${NC}"; \
            echo -e "${BOLD}${BLUE}════════════════════════════════════════════${NC}"; }

# ─── Paths & config ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TELRO_DIR="${TELRO_DIR:-$SCRIPT_DIR}"
COMPOSE_FILE="$TELRO_DIR/docker-compose.yml"
ENV_FILE="$TELRO_DIR/.env"
ASTERISK_SCRIPT="$TELRO_DIR/scripts/install-asterisk.sh"
INSTALL_LOG="/var/log/telro-install.log"
DOCKER_BRIDGE="172.17.0.0"      # Docker default bridge network
DOCKER_BRIDGE_MASK="255.255.0.0"

# Asterisk install params
AST_VERSION="${AST_VERSION:-20.11.1}"
AMI_USER="${AMI_USER:-telro}"
AMI_SECRET="${AMI_SECRET:-$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 24)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 48)}"
WEB_PORT="${WEB_PORT:-80}"
SKIP_ASTERISK="${SKIP_ASTERISK:-0}"
SKIP_DOCKER="${SKIP_DOCKER:-0}"

# ─── Pre-flight checks ───────────────────────────────────────────────────────
step "前置检查"

[[ $EUID -ne 0 ]] && error "请使用 sudo 或 root 用户运行此脚本"
[[ ! -f "$COMPOSE_FILE" ]] && error "未找到 docker-compose.yml，请在 Telro 项目根目录运行此脚本"

. /etc/os-release
if [[ "$ID" != "ubuntu" ]]; then
    error "此脚本仅支持 Ubuntu，当前: $ID $VERSION_ID"
fi
if [[ "$VERSION_ID" != "22.04" && "$VERSION_ID" != "24.04" ]]; then
    warn "建议使用 Ubuntu 22.04 或 24.04，当前: $VERSION_ID，继续..."
fi

# Internet check
if ! curl -sf --max-time 5 https://google.com -o /dev/null; then
    error "无法访问外网，请检查网络连接"
fi

# Disk space check (need at least 4 GB free)
FREE_GB=$(df / --output=avail -BG | tail -1 | tr -dc '0-9')
(( FREE_GB < 4 )) && error "根分区剩余空间不足 4 GB (当前: ${FREE_GB}GB)，请扩容后重试"

info "操作系统:    Ubuntu $VERSION_ID"
info "项目目录:    $TELRO_DIR"
info "Asterisk:    $AST_VERSION"
info "AMI 用户:    $AMI_USER"
info "AMI 密码:    $AMI_SECRET"
info "Web 端口:    $WEB_PORT"
info "安装日志:    $INSTALL_LOG"
echo ""
echo -e "${YELLOW}10 秒后开始安装，按 Ctrl+C 取消...${NC}"
sleep 10

# 追加到日志文件
exec > >(tee -a "$INSTALL_LOG") 2>&1
info "安装开始时间: $(date)"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. DOCKER
# ═══════════════════════════════════════════════════════════════════════════════
step "安装 Docker"

if [[ "$SKIP_DOCKER" == "1" ]]; then
    warn "SKIP_DOCKER=1，跳过 Docker 安装"
elif command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    success "Docker 已安装: $(docker --version)"
    success "Docker Compose: $(docker compose version | head -1)"
else
    info "安装 Docker CE 官方版本..."

    # Remove old distro packages
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

    # Install prereqs
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release

    # Add Docker's official GPG key & repo
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor --batch --yes -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker
    systemctl start docker

    success "Docker 安装完成: $(docker --version)"
    success "Compose: $(docker compose version | head -1)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 2. ASTERISK
# ═══════════════════════════════════════════════════════════════════════════════
step "安装 Asterisk $AST_VERSION"

if [[ "$SKIP_ASTERISK" == "1" ]]; then
    warn "SKIP_ASTERISK=1，跳过 Asterisk 安装"
elif systemctl is-active --quiet asterisk 2>/dev/null; then
    success "Asterisk 已在运行，跳过安装"
    # Extract existing AMI secret from manager.conf if possible
    if [[ -f /etc/asterisk/manager.conf ]]; then
        EXISTING_SECRET=$(grep -E "^secret\s*=" /etc/asterisk/manager.conf | head -1 | awk -F= '{gsub(/ /,"",$2); print $2}')
        [[ -n "$EXISTING_SECRET" ]] && AMI_SECRET="$EXISTING_SECRET" && \
            info "已读取现有 AMI 密码: $AMI_SECRET"
    fi
else
    if [[ ! -f "$ASTERISK_SCRIPT" ]]; then
        error "未找到 Asterisk 安装脚本: $ASTERISK_SCRIPT"
    fi

    # When running in Docker-compose mode:
    # - AMI must bind on 0.0.0.0 so Docker containers can reach it
    # - Permit connections from Docker default bridge (172.17.x.x)
    # - Also permit from localhost
    info "配置 AMI 允许 Docker 容器连接 (bind=0.0.0.0, permit=$DOCKER_BRIDGE/$DOCKER_BRIDGE_MASK)..."

    chmod +x "$ASTERISK_SCRIPT"

    # Run the Asterisk install script with Docker-aware settings
    AMI_BIND="0.0.0.0" \
    TELRO_HOST="$DOCKER_BRIDGE" \
    AMI_USER="$AMI_USER" \
    AMI_SECRET="$AMI_SECRET" \
    AST_VERSION="$AST_VERSION" \
        bash "$ASTERISK_SCRIPT"

    success "Asterisk 安装完成"
fi

# Verify AMI is reachable
sleep 2
if timeout 4 bash -c "echo '' > /dev/tcp/127.0.0.1/5038" 2>/dev/null; then
    success "AMI 端口 5038 已就绪"
else
    warn "AMI 端口 5038 未响应，Asterisk 可能还在启动中，继续部署..."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 3. GENERATE .env
# ═══════════════════════════════════════════════════════════════════════════════
step "生成 .env 配置文件"

if [[ -f "$ENV_FILE" ]]; then
    warn ".env 已存在，备份到 .env.bak.$(date +%Y%m%d%H%M%S)"
    cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
fi

# Detect host's primary IP (used for the summary banner)
HOST_IP=$(hostname -I | awk '{print $1}')

cat > "$ENV_FILE" << EOF
# =============================================================================
#  Telro — Environment Configuration
#  Auto-generated by install.sh on $(date)
# =============================================================================

# ── App ───────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ── Security ──────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRE=7d

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_PATH=./data/telro.db

# ── Asterisk AMI ──────────────────────────────────────────────────────────────
# host.docker.internal resolves to the host machine from inside Docker.
ASTERISK_HOST=host.docker.internal
ASTERISK_PORT=5038
ASTERISK_USER=${AMI_USER}
ASTERISK_SECRET=${AMI_SECRET}

# ── Asterisk Paths (bind-mounted in docker-compose.yml) ───────────────────────
ASTERISK_CONF_PATH=/etc/asterisk
ASTERISK_SOUNDS_PATH=/app/sounds
AUDIO_UPLOAD_PATH=./uploads/audio
RECORDING_PATH=./recordings
RECORDING_FORMAT=wav

# ── SIP ───────────────────────────────────────────────────────────────────────
SIP_CONTEXT=from-internal
DEFAULT_EXTENSION_CONTEXT=from-internal

# ── Billing ───────────────────────────────────────────────────────────────────
DEFAULT_RATE_PER_MINUTE=0.1
SIP_TRUNK_RATE_PER_MINUTE=0.05
EOF

chmod 600 "$ENV_FILE"
success ".env 已写入: $ENV_FILE"

# ═══════════════════════════════════════════════════════════════════════════════
# 4. FIREWALL
# ═══════════════════════════════════════════════════════════════════════════════
step "配置防火墙 (UFW)"

apt-get install -y ufw 2>/dev/null || true
ufw --force enable || true

# Web & SSH
ufw allow OpenSSH             comment "SSH"
ufw allow "$WEB_PORT/tcp"     comment "Telro Web"
ufw allow 443/tcp             comment "HTTPS"

# SIP & RTP (for Asterisk on host)
ufw allow 5060/udp            comment "Asterisk SIP"
ufw allow 5060/tcp            comment "Asterisk SIP TCP"
ufw allow 10000:20000/udp     comment "Asterisk RTP"

# AMI/ARI — only accessible from localhost & Docker bridge; do NOT open to world
# (already handled by manager.conf permit= directive)

success "防火墙规则配置完成"
ufw status numbered

# ═══════════════════════════════════════════════════════════════════════════════
# 5. BUILD & START CONTAINERS
# ═══════════════════════════════════════════════════════════════════════════════
step "构建并启动 Telro 容器"

cd "$TELRO_DIR"

# Patch docker-compose.yml web port if WEB_PORT != 80
if [[ "$WEB_PORT" != "80" ]]; then
    sed -i "s|\"80:80\"|\"${WEB_PORT}:80\"|g" "$COMPOSE_FILE"
    info "前端端口已更新为 $WEB_PORT"
fi

info "构建镜像（首次约需 5–15 分钟）..."
docker compose -f "$COMPOSE_FILE" build --progress=plain

info "启动容器..."
docker compose -f "$COMPOSE_FILE" up -d

# ═══════════════════════════════════════════════════════════════════════════════
# 6. WAIT FOR HEALTH
# ═══════════════════════════════════════════════════════════════════════════════
step "等待服务健康检查"

info "等待 backend 容器就绪（最多 90 秒）..."
MAX=90; ELAPSED=0
until docker compose -f "$COMPOSE_FILE" exec -T backend \
      node -e "require('http').get('http://localhost:3000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" \
      2>/dev/null; do
    sleep 3; ELAPSED=$((ELAPSED+3)); printf "."
    (( ELAPSED >= MAX )) && { echo ""; warn "等待超时，后端可能仍在启动..."; break; }
done
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 7. SYSTEMD AUTO-START FOR DOCKER COMPOSE
# ═══════════════════════════════════════════════════════════════════════════════
step "配置开机自启 (systemd)"

cat > /etc/systemd/system/telro.service << EOF
[Unit]
Description=Telro PBX Management Platform
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${TELRO_DIR}
ExecStart=/usr/bin/docker compose -f ${COMPOSE_FILE} up -d
ExecStop=/usr/bin/docker compose -f ${COMPOSE_FILE} down
TimeoutStartSec=180
TimeoutStopSec=30
Restart=no

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable telro.service
success "telro.service 已注册，开机将自动启动"

# ═══════════════════════════════════════════════════════════════════════════════
# 8. FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              🎉  Telro 全栈安装完成！                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Container status
docker compose -f "$COMPOSE_FILE" ps
echo ""

echo -e "${BOLD}── 访问地址 ──────────────────────────────────────────────────${NC}"
echo "  前端界面:  http://${HOST_IP}:${WEB_PORT}"
echo "  API  地址: http://${HOST_IP}:${WEB_PORT}/api"
echo ""
echo -e "${BOLD}── 默认登录账号 ───────────────────────────────────────────────${NC}"
echo "  用户名: admin"
echo "  密  码: admin123"
echo -e "  ${RED}⚠  请登录后立即修改默认密码！${NC}"
echo ""
echo -e "${BOLD}── Asterisk AMI 信息 ─────────────────────────────────────────${NC}"
echo "  ASTERISK_HOST   = host.docker.internal"
echo "  ASTERISK_PORT   = 5038"
echo "  ASTERISK_USER   = ${AMI_USER}"
echo -e "  ASTERISK_SECRET = ${RED}${AMI_SECRET}${NC}"
echo ""
echo -e "${BOLD}── 开放端口 ───────────────────────────────────────────────────${NC}"
echo "  ${WEB_PORT}/tcp    — Telro 前端"
echo "  5060/udp   — SIP 注册（话机）"
echo "  5060/tcp   — SIP TCP"
echo "  10000-20000/udp — RTP 媒体流"
echo ""
echo -e "${BOLD}── 常用管理命令 ───────────────────────────────────────────────${NC}"
echo "  查看容器状态:  docker compose -f $COMPOSE_FILE ps"
echo "  查看实时日志:  docker compose -f $COMPOSE_FILE logs -f"
echo "  重启容器:      docker compose -f $COMPOSE_FILE restart"
echo "  停止容器:      docker compose -f $COMPOSE_FILE down"
echo "  更新部署:      cd $TELRO_DIR && git pull && ./deploy.sh update"
echo ""
echo "  Asterisk 控制台:  asterisk -rvvv"
echo "  Asterisk 状态:    systemctl status asterisk"
echo "  Telro 服务:       systemctl status telro"
echo ""
echo -e "${BOLD}── 下一步 ─────────────────────────────────────────────────────${NC}"
echo "  1. 登录 Telro 管理界面 → 系统管理 → 同步 Asterisk"
echo "  2. 添加 SIP 分机，话机使用以下设置注册:"
echo "     SIP 服务器: ${HOST_IP}"
echo "     端口: 5060"
echo "     用户名/密码: 在分机管理页面查看"
echo ""
echo "  安装日志: $INSTALL_LOG"
echo "  配置文件: $ENV_FILE"
echo ""
