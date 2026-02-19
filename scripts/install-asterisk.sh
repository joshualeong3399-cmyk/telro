#!/usr/bin/env bash
# =============================================================================
#  Telro — Asterisk 一键安装脚本
#  支持 Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
#  安装 Asterisk 20 LTS，并完成 Telro 所需的基础配置
#
#  使用方法:
#    chmod +x install-asterisk.sh
#    sudo ./install-asterisk.sh
#
#  可选环境变量（覆盖默认值）:
#    AST_VERSION      Asterisk 版本，默认 20.11.1
#    AMI_USER         AMI 用户名，默认 telro
#    AMI_SECRET       AMI 密码，默认随机生成
#    AMI_BIND         AMI 绑定地址，默认 127.0.0.1
#    TELRO_HOST       Node.js 后端 IP，默认 127.0.0.1（AMI 允许连接的地址）
#    SIP_PORT         SIP 端口，默认 5060
#    HTTP_PORT        ARI HTTP 端口，默认 8088
# =============================================================================

set -euo pipefail

# ── 颜色输出 ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}"; }

# ── 参数 ──────────────────────────────────────────────────────────────────────
AST_VERSION="${AST_VERSION:-20.11.1}"
AMI_USER="${AMI_USER:-telro}"
AMI_SECRET="${AMI_SECRET:-$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)}"
AMI_BIND="${AMI_BIND:-127.0.0.1}"
TELRO_HOST="${TELRO_HOST:-127.0.0.1}"
SIP_PORT="${SIP_PORT:-5060}"
HTTP_PORT="${HTTP_PORT:-8088}"
INSTALL_DIR="/usr/src/asterisk-${AST_VERSION}"
CONF_DIR="/etc/asterisk"
LOG_FILE="/var/log/telro-asterisk-install.log"

# ── 前置检查 ──────────────────────────────────────────────────────────────────
step "前置检查"

[[ $EUID -ne 0 ]] && error "请使用 sudo 或 root 运行此脚本"

# 检查 Ubuntu 版本
. /etc/os-release
UBUNTU_VER="${VERSION_ID}"
if [[ "$ID" != "ubuntu" ]]; then
    error "此脚本仅支持 Ubuntu，当前系统: $ID"
fi
if [[ "$UBUNTU_VER" != "22.04" && "$UBUNTU_VER" != "24.04" ]]; then
    warn "此脚本针对 Ubuntu 22.04 / 24.04 优化，当前版本: $UBUNTU_VER，继续执行..."
fi

info "操作系统:    Ubuntu $UBUNTU_VER"
info "Asterisk:    $AST_VERSION"
info "AMI 用户:    $AMI_USER"
info "AMI 密码:    $AMI_SECRET  ← 请记录此密码"
info "AMI 绑定:    $AMI_BIND"
info "允许连接:    $TELRO_HOST"
info "SIP 端口:    $SIP_PORT"
info "ARI 端口:    $HTTP_PORT"
echo ""
echo -e "${YELLOW}5 秒后开始安装，按 Ctrl+C 取消...${NC}"
sleep 5

# 记录安装日志
exec > >(tee -a "$LOG_FILE") 2>&1

# ── 1. 系统更新与基础依赖 ─────────────────────────────────────────────────────
step "更新系统并安装依赖"

apt-get update -y
apt-get install -y \
    build-essential wget curl git \
    libedit-dev libssl-dev libncurses5-dev \
    uuid-dev libxml2-dev libsqlite3-dev \
    libjansson-dev liburiparser-dev \
    libsrtp2-dev libspandsp-dev libgsm1-dev \
    libogg-dev libvorbis-dev libopus-dev libopusfile-dev \
    libcurl4-openssl-dev libiksemel-dev \
    unixodbc-dev libpq-dev freetds-dev \
    dahdi-linux dahdi-tools libpri-dev \
    mpg123 sox libsox-fmt-mp3 \
    snmp libsnmp-dev \
    openssl ca-certificates \
    ufw fail2ban \
    2>/dev/null || true

success "依赖安装完成"

# ── 2. 下载并解压 Asterisk 源码 ───────────────────────────────────────────────
step "下载 Asterisk $AST_VERSION 源码"

cd /usr/src

if [[ ! -f "asterisk-${AST_VERSION}.tar.gz" ]]; then
    info "下载中..."
    wget -q --show-progress \
        "https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-${AST_VERSION}.tar.gz" \
        -O "asterisk-${AST_VERSION}.tar.gz" \
        || wget -q --show-progress \
           "https://downloads.asterisk.org/pub/telephony/asterisk/old-releases/asterisk-${AST_VERSION}.tar.gz" \
           -O "asterisk-${AST_VERSION}.tar.gz"
else
    info "源码包已存在，跳过下载"
fi

tar xzf "asterisk-${AST_VERSION}.tar.gz"
cd "$INSTALL_DIR"
success "源码解压完成: $INSTALL_DIR"

# ── 3. 安装 Asterisk 额外依赖（官方脚本）───────────────────────────────────────
step "安装编译依赖"

if [[ -f contrib/scripts/install_prereq ]]; then
    bash contrib/scripts/install_prereq install 2>&1 | tail -5
fi

# MP3 支持
if [[ -f contrib/scripts/get_mp3_source.sh ]]; then
    bash contrib/scripts/get_mp3_source.sh 2>/dev/null || true
fi

success "编译依赖就绪"

# ── 4. 编译配置 ───────────────────────────────────────────────────────────────
step "configure"

./configure \
    --with-jansson-bundled \
    --with-pjproject-bundled \
    --enable-dev-mode=no \
    2>&1 | tail -10

success "configure 完成"

# ── 5. 选择模块（menuselect） ─────────────────────────────────────────────────
step "选择编译模块"

# 使用 menuselect CLI 选择必要模块
make menuselect.makeopts

# 启用关键模块
menuselect/menuselect \
    --enable chan_sip \
    --enable chan_dahdi \
    --enable app_dial \
    --enable app_queue \
    --enable app_voicemail \
    --enable app_playback \
    --enable app_record \
    --enable app_mixmonitor \
    --enable app_chanspy \
    --enable app_transfer \
    --enable app_read \
    --enable app_waitexten \
    --enable app_directory \
    --enable app_disa \
    --enable pbx_config \
    --enable pbx_ael \
    --enable res_http_websocket \
    --enable res_ari \
    --enable res_ari_channels \
    --enable res_ari_endpoints \
    --enable res_ari_bridges \
    --enable res_ari_recordings \
    --enable res_ari_events \
    --enable res_ari_asterisk \
    --enable res_ari_playbacks \
    --enable res_ari_sounds \
    --enable res_ari_device_states \
    --enable res_srtp \
    --enable res_monitor \
    --enable res_musiconhold \
    --enable res_parking \
    --enable res_pjsip \
    --enable codec_ulaw \
    --enable codec_alaw \
    --enable codec_gsm \
    --enable codec_opus \
    --enable format_wav \
    --enable format_mp3 \
    --enable format_gsm \
    --enable format_ogg_vorbis \
    --enable cdr_csv \
    --enable cdr_manager \
    --enable cel_manager \
    menuselect.makeopts 2>/dev/null || true

success "模块配置完成"

# ── 6. 编译与安装 ─────────────────────────────────────────────────────────────
step "编译 Asterisk（可能需要 10-20 分钟）"

CORES=$(nproc)
info "使用 $CORES 核心并行编译..."
make -j"$CORES" 2>&1 | grep -E "^(Making|Compiling|Linking|ERROR|error)" || true

step "安装 Asterisk"
make install
make samples        # 安装示例配置文件（作为参考）
make config         # 安装 systemd service
make install-logrotate 2>/dev/null || true
ldconfig

success "Asterisk 安装完成"

# ── 7. 创建 asterisk 系统用户 ─────────────────────────────────────────────────
step "配置系统用户"

if ! id asterisk &>/dev/null; then
    useradd -r -d /var/lib/asterisk -s /sbin/nologin asterisk
    success "创建用户 asterisk"
fi

# 权限设置
chown -R asterisk:asterisk \
    /etc/asterisk \
    /var/lib/asterisk \
    /var/log/asterisk \
    /var/run/asterisk \
    /var/spool/asterisk \
    /usr/lib/asterisk

# 让 Asterisk 以 asterisk 用户运行（在 /etc/asterisk/asterisk.conf 中）
sed -i 's/;runuser = asterisk/runuser = asterisk/' /etc/asterisk/asterisk.conf 2>/dev/null || true
sed -i 's/;rungroup = asterisk/rungroup = asterisk/' /etc/asterisk/asterisk.conf 2>/dev/null || true

success "用户权限设置完成"

# ── 8. 配置 AMI (manager.conf) ────────────────────────────────────────────────
step "配置 Asterisk AMI"

cat > "$CONF_DIR/manager.conf" << EOF
; =============================================================================
; Asterisk Manager Interface (AMI) 配置
; 由 Telro 安装脚本生成 — $(date)
; =============================================================================

[general]
enabled = yes
port = 5038
bindaddr = ${AMI_BIND}
displayconnects = yes
timestampevents = yes

; ── Telro 后端账户 ────────────────────────────────────────────────────────────
[${AMI_USER}]
secret = ${AMI_SECRET}
deny = 0.0.0.0/0.0.0.0
permit = ${TELRO_HOST}/255.255.255.255
permit = 127.0.0.1/255.255.255.255
read = all
write = all
writetimeout = 5000
EOF

success "manager.conf 已配置"

# ── 9. 配置 ARI (ari.conf + http.conf) ───────────────────────────────────────
step "配置 ARI (REST Interface)"

cat > "$CONF_DIR/http.conf" << EOF
; =============================================================================
; HTTP 服务配置（ARI 依赖）
; =============================================================================
[general]
enabled = yes
bindaddr = 127.0.0.1
bindport = ${HTTP_PORT}
prefix = 
tlsenable = no
EOF

cat > "$CONF_DIR/ari.conf" << EOF
; =============================================================================
; ARI (Asterisk REST Interface) 配置
; =============================================================================
[general]
enabled = yes
pretty = no
allowed_origins = *

[${AMI_USER}]
type = user
read_only = no
password = ${AMI_SECRET}
password_format = plain
EOF

success "ARI 配置完成"

# ── 10. 配置 sip.conf 基础段 ──────────────────────────────────────────────────
step "配置 sip.conf"

# 备份示例文件
cp "$CONF_DIR/sip.conf" "$CONF_DIR/sip.conf.sample" 2>/dev/null || true

cat > "$CONF_DIR/sip.conf" << EOF
; =============================================================================
; SIP 基础配置 — 由 Telro 安装脚本生成
; 分机和中继配置由 Telro 自动写入 telro-sip.conf
; =============================================================================

[general]
context = from-internal
allowoverlap = no
udpbindaddr = 0.0.0.0:${SIP_PORT}
tcpenable = yes
tcpbindaddr = 0.0.0.0:${SIP_PORT}
srvlookup = yes
nat = force_rport,comedia
qualify = yes
qualifyfreq = 60
dtmfmode = rfc2833
disallow = all
allow = ulaw,alaw,g729,g722
alwaysauthreject = yes
registertimeout = 20
registerattempts = 0
videosupport = no
maxexpiry = 3600
minexpiry = 60
defaultexpiry = 120
t1min = 100

; ── Telro 自动生成的分机和中继配置 ───────────────────────────────────────────
#include "telro-sip.conf"
EOF

# 创建空的 telro-sip.conf（Telro 启动时会填充）
touch "$CONF_DIR/telro-sip.conf"
chown asterisk:asterisk "$CONF_DIR/telro-sip.conf"

success "sip.conf 配置完成"

# ── 11. 配置 extensions.conf ──────────────────────────────────────────────────
step "配置 extensions.conf"

cp "$CONF_DIR/extensions.conf" "$CONF_DIR/extensions.conf.sample" 2>/dev/null || true

cat > "$CONF_DIR/extensions.conf" << EOF
; =============================================================================
; Dialplan 配置 — 由 Telro 安装脚本生成
; 路由规则由 Telro 自动写入 telro-extensions.conf
; =============================================================================

[general]
static = yes
writeprotect = no
clearglobalvars = no
priorityjumping = no

[globals]
ATTENDED_TRANSFER_COMPLETE_SOUND = beep
TRANSFER_CONTEXT = from-internal

; ── 特殊功能码 ────────────────────────────────────────────────────────────────
[default]
; 语音信箱
exten => *97,1,VoiceMailMain(@default)
exten => *98,1,VoiceMailMain(\${CALLERID(num)}@default)

; 通话录音开关
exten => *1,1,MixMonitor(\${UNIQUEID}.wav,b)
exten => *1,n,Playback(beep)
exten => *1,n,Return()

; 呼叫等待
exten => *70,1,Set(CALLWAITING=\${IF(\$[\${CALLWAITING} = on]?off:on)})
exten => *70,n,Playback(beep)

; ── Telro 自动生成的路由规则 ─────────────────────────────────────────────────
#include "telro-extensions.conf"
EOF

touch "$CONF_DIR/telro-extensions.conf"
chown asterisk:asterisk "$CONF_DIR/telro-extensions.conf"

success "extensions.conf 配置完成"

# ── 12. 配置 queues.conf ──────────────────────────────────────────────────────
step "配置 queues.conf"

cp "$CONF_DIR/queues.conf" "$CONF_DIR/queues.conf.sample" 2>/dev/null || true

cat > "$CONF_DIR/queues.conf" << EOF
; =============================================================================
; 队列配置 — 由 Telro 安装脚本生成
; 队列详情由 Telro 自动写入 telro-queues.conf
; =============================================================================

[general]
persistentmembers = yes
autofill = yes
monitor-type = MixMonitor
updatecdr = yes
shared_lastcall = yes
log_membername_as_agent = yes

; ── Telro 自动生成的队列 ─────────────────────────────────────────────────────
#include "telro-queues.conf"
EOF

touch "$CONF_DIR/telro-queues.conf"
chown asterisk:asterisk "$CONF_DIR/telro-queues.conf"

success "queues.conf 配置完成"

# ── 13. 配置语音信箱 ──────────────────────────────────────────────────────────
step "配置 voicemail.conf"

cat > "$CONF_DIR/voicemail.conf" << EOF
[general]
format = wav49|gsm|wav
serveremail = asterisk@localhost
attach = yes
maxmessage = 180
minmessage = 3
maxsilence = 10
silencethreshold = 128
maxlogins = 3
emaildateformat = %A, %B %d, %Y at %r
pagerdateformat = %A, %B %d, %Y at %r
sendvoicemail = yes

[zonemessages]
eastern = America/New_York|'vm-received' Q 'digits/at' IMp
central = America/Chicago|'vm-received' Q 'digits/at' IMp
mountain = America/Denver|'vm-received' Q 'digits/at' IMp
pacific = America/Los_Angeles|'vm-received' Q 'digits/at' IMp
china = Asia/Shanghai|'vm-received' Q 'digits/at' IMp

[default]
; 默认语音信箱账户（格式: number => password,Name,email）
; 分机注册后会自动使用 number@default 作为语音信箱
EOF

success "voicemail.conf 配置完成"

# ── 14. 配置录音目录 ──────────────────────────────────────────────────────────
step "配置录音目录"

RECORDING_DIR="/var/spool/asterisk/monitor"
mkdir -p "$RECORDING_DIR"
chown -R asterisk:asterisk "$RECORDING_DIR"
chmod 755 "$RECORDING_DIR"

success "录音目录: $RECORDING_DIR"

# ── 15. 配置 musiconhold.conf ────────────────────────────────────────────────
cat > "$CONF_DIR/musiconhold.conf" << EOF
[general]
[default]
mode = files
directory = /var/lib/asterisk/moh
random = yes
EOF

# 创建示例等待音乐目录
mkdir -p /var/lib/asterisk/moh
chown -R asterisk:asterisk /var/lib/asterisk/moh

# ── 16. 配置 rtp.conf ─────────────────────────────────────────────────────────
cat > "$CONF_DIR/rtp.conf" << EOF
[general]
; RTP 端口范围（确保防火墙开放此范围 UDP）
rtpstart = 10000
rtpend   = 20000
strictrtp = yes
probation = 4
EOF

success "RTP 端口范围配置完成 (10000-20000 UDP)"

# ── 17. 配置 logger.conf ─────────────────────────────────────────────────────
cat > "$CONF_DIR/logger.conf" << EOF
[general]
dateformat = %F %T

[logfiles]
/var/log/asterisk/full = notice,warning,error,debug,verbose
/var/log/asterisk/messages = notice,warning,error
/var/log/asterisk/security = security
console = notice,warning,error
EOF

# ── 18. systemd 服务配置 ──────────────────────────────────────────────────────
step "配置 systemd 服务"

# 使用 make config 已创建的服务文件，或手动创建
if [[ ! -f /etc/systemd/system/asterisk.service && ! -f /lib/systemd/system/asterisk.service ]]; then
cat > /etc/systemd/system/asterisk.service << EOF
[Unit]
Description=Asterisk PBX and telephony daemon
After=network.target

[Service]
Type=simple
User=asterisk
Group=asterisk
Environment=HOME=/var/lib/asterisk
ExecStart=/usr/sbin/asterisk -f -C /etc/asterisk/asterisk.conf
ExecReload=/usr/sbin/asterisk -rx "core reload"
PIDFile=/var/run/asterisk/asterisk.pid
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
fi

systemctl daemon-reload
systemctl enable asterisk
success "systemd 服务已启用"

# ── 19. 防火墙配置 ────────────────────────────────────────────────────────────
step "配置防火墙 (UFW)"

ufw --force enable 2>/dev/null || true

# SIP
ufw allow "$SIP_PORT/udp" comment "Asterisk SIP"
ufw allow "$SIP_PORT/tcp" comment "Asterisk SIP TCP"

# RTP 媒体流
ufw allow 10000:20000/udp comment "Asterisk RTP Media"

# SSH（保持开启，防止锁定）
ufw allow OpenSSH

# AMI 和 ARI 只允许本机访问（不对外开放）
# 如果 Telro 后端在其他机器，需额外配置:
# ufw allow from <TELRO_HOST> to any port 5038
# ufw allow from <TELRO_HOST> to any port 8088

success "防火墙规则配置完成"

# ── 20. 启动 Asterisk ────────────────────────────────────────────────────────
step "启动 Asterisk"

systemctl start asterisk || warn "Asterisk 启动失败，请检查日志: journalctl -u asterisk"

sleep 3

if systemctl is-active --quiet asterisk; then
    success "Asterisk 运行中"
    # 验证 AMI 可连接
    if timeout 3 bash -c "echo '' > /dev/tcp/127.0.0.1/5038" 2>/dev/null; then
        success "AMI 端口 5038 已就绪"
    fi
else
    warn "Asterisk 未能启动，请运行: journalctl -u asterisk -n 50"
fi

# ── 21. 生成 Telro .env 配置片段 ─────────────────────────────────────────────
step "生成 Telro 环境变量配置"

ENV_SNIPPET="/root/telro-asterisk.env"
cat > "$ENV_SNIPPET" << EOF
# =============================================================================
# 将以下内容复制到 Telro 后端的 .env 文件中
# Generated: $(date)
# =============================================================================

ASTERISK_HOST=127.0.0.1
ASTERISK_PORT=5038
ASTERISK_USER=${AMI_USER}
ASTERISK_SECRET=${AMI_SECRET}
ASTERISK_CONF_PATH=/etc/asterisk

# ARI 配置（如需使用 ARI 功能）
# ARI_BASE_URL=http://127.0.0.1:${HTTP_PORT}/ari
# ARI_USER=${AMI_USER}
# ARI_SECRET=${AMI_SECRET}
EOF

success "Telro 配置片段已保存到: $ENV_SNIPPET"

# ── 22. 安装摘要 ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              🎉 Asterisk 安装完成！                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BOLD}安装摘要:${NC}"
echo "  Asterisk 版本:  $AST_VERSION"
echo "  安装路径:        /usr/sbin/asterisk"
echo "  配置目录:        /etc/asterisk/"
echo "  日志目录:        /var/log/asterisk/"
echo "  录音目录:        /var/spool/asterisk/monitor/"
echo ""
echo -e "${BOLD}AMI 连接信息（填入 Telro .env）:${NC}"
echo "  ASTERISK_HOST   = 127.0.0.1"
echo "  ASTERISK_PORT   = 5038"
echo "  ASTERISK_USER   = ${AMI_USER}"
echo -e "  ASTERISK_SECRET = ${RED}${AMI_SECRET}${NC}  ← 请妥善保存！"
echo "  ASTERISK_CONF_PATH = /etc/asterisk"
echo ""
echo -e "${BOLD}开放的端口:${NC}"
echo "  5060/UDP  — SIP（话机注册）"
echo "  5060/TCP  — SIP TCP"
echo "  10000-20000/UDP — RTP 媒体流"
echo "  5038      — AMI（仅本机）"
echo "  8088      — ARI（仅本机）"
echo ""
echo -e "${BOLD}常用命令:${NC}"
echo "  systemctl status asterisk         # 查看运行状态"
echo "  asterisk -rvvv                    # 进入 Asterisk 控制台"
echo "  asterisk -rx 'core show version'  # 查看版本"
echo "  asterisk -rx 'sip show peers'     # 查看已注册分机"
echo "  asterisk -rx 'core reload'        # 重载所有配置"
echo "  journalctl -u asterisk -f         # 实时查看日志"
echo ""
echo -e "${BOLD}下一步:${NC}"
echo "  1. 将 ${ENV_SNIPPET} 的内容复制到 Telro 后端 .env"
echo "  2. 启动 Telro 后端: cd /path/to/telro/backend && npm start"
echo "  3. 登录 Telro 管理界面 → PBX管理 → Asterisk同步 → 点击「写入 #include 指令」"
echo "  4. 点击「立即同步并重载 Asterisk」"
echo "  5. 在分机管理中添加分机，话机使用 SIP 注册"
echo ""
echo "  安装日志: $LOG_FILE"
echo ""
