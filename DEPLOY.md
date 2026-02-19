# Telro — VPS / GCP VM 部署教程

## 架构概览

```
Internet
   │
   ▼
Nginx (80/443)
   ├── /api/*  → Node.js Backend :3000
   ├── /socket.io/* → Node.js Backend :3001
   └── /*      → React 静态文件 (dist/)

Node.js Backend :3000/:3001
   ├── SQLite (./data/telro.db)
   └── AMI TCP → Asterisk :5038

Asterisk PBX
   ├── SIP UDP :5060
   ├── RTP UDP :10000-20000
   └── AMI TCP :5038
```

---

## 一、服务器要求

| 项目 | 最低 | 推荐 |
|------|------|------|
| CPU | 2 核 | 4 核 |
| RAM | 2 GB | 4 GB |
| 磁盘 | 20 GB SSD | 50 GB SSD |
| 系统 | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| 开放端口 | 22, 80, 443, 5060(UDP), 10000-20000(UDP) | + 3000(可选内网) |

---

## 二、VPS / GCP VM 初始化

### GCP VM 创建（命令行）
```bash
gcloud compute instances create telro-server \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --zone=asia-east1-b \
  --boot-disk-size=50GB \
  --tags=telro-server

# 防火墙规则
gcloud compute firewall-rules create telro-sip \
  --target-tags=telro-server \
  --allow=udp:5060,udp:10000-20000,tcp:80,tcp:443
```

### 登录服务器
```bash
ssh ubuntu@<VM_EXTERNAL_IP>
```

---

## 三、系统依赖安装

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 工具
sudo apt install -y git nginx certbot python3-certbot-nginx ufw

# Asterisk
sudo apt install -y asterisk asterisk-config

node -v   # v20.x
npm -v    # 10.x
```

---

## 四、部署代码

```bash
# 创建应用用户
sudo useradd -m -s /bin/bash telro
sudo su - telro

# 克隆代码（或 scp 上传）
git clone https://github.com/your-org/telro.git /home/telro/telro
# 或使用 scp:
# scp -r /Users/herbertlim/Downloads/telro ubuntu@<IP>:/home/telro/

cd /home/telro/telro
```

### 后端
```bash
cd /home/telro/telro/backend
npm install --production

# 创建数据目录
mkdir -p data uploads/audio

# 创建生产环境配置
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
SOCKET_PORT=3001
JWT_SECRET=<随机生成的64位字符串>
DATABASE_PATH=./data/telro.db
ASTERISK_HOST=127.0.0.1
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USER=telro
ASTERISK_AMI_SECRET=<AMI密码>
ASTERISK_CONF_PATH=/etc/asterisk
ASTERISK_SOUNDS_PATH=/var/lib/asterisk/sounds/custom
AUDIO_UPLOAD_PATH=./uploads/audio
EOF

# 生成 JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 前端构建
```bash
cd /home/telro/telro/frontend

cat > .env.production << 'EOF'
VITE_API_URL=https://your-domain.com/api
VITE_WS_URL=https://your-domain.com
VITE_ASTERISK_HOST=your-domain.com
EOF

npm install
npm run build
# 产物在 dist/
```

---

## 五、PM2 进程管理

```bash
sudo npm install -g pm2

cd /home/telro/telro/backend
pm2 start src/index.js --name telro-backend --interpreter node

# 开机自启
pm2 save
pm2 startup systemd -u telro --hp /home/telro
# 按提示执行输出的 sudo 命令

# 查看状态
pm2 status
pm2 logs telro-backend
```

---

## 六、Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/telro
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /home/telro/telro/frontend/dist;
    index index.html;

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }

    # Socket.io 代理
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 录音文件直接访问（可选）
    location /recordings/ {
        alias /var/spool/asterisk/monitor/;
        add_header Content-Disposition 'attachment';
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/telro /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 七、HTTPS 证书（Let's Encrypt）

```bash
# 需要域名已解析到服务器 IP
sudo certbot --nginx -d your-domain.com

# 自动续期（已由 certbot timer 处理，验证：）
sudo systemctl status certbot.timer
```

---

## 八、Asterisk AMI 配置

```bash
sudo nano /etc/asterisk/manager.conf
```

```ini
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[telro]
secret = <AMI密码>
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.0
read = all
write = all
writetimeout = 5000
```

```bash
# SIP 配置示例 (pjsip.conf 或 sip.conf)
sudo cp /etc/asterisk/sip.conf /etc/asterisk/sip.conf.bak
sudo systemctl restart asterisk
# 从 Telro 管理界面 → Asterisk 同步 → 点击「同步配置」自动生成所有 conf 文件
```

---

## 九、防火墙

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5060/udp        # SIP
sudo ufw allow 10000:20000/udp  # RTP 媒体流
sudo ufw enable
sudo ufw status
```

---

## 十、首次登录

1. 浏览器访问 `https://your-domain.com`
2. 默认管理员账号：`admin` / `admin123`（登录后立即修改密码）
3. 进入 **系统管理 → 用户管理** 创建其他用户
4. 进入 **Asterisk 同步** 页面点击「同步全部配置」生成 Asterisk 配置文件

---

## 十一、更新部署

```bash
cd /home/telro/telro
git pull

# 后端
cd backend && npm install --production
pm2 restart telro-backend

# 前端
cd ../frontend && npm install && npm run build
# Nginx 自动提供新的 dist/ 文件，无需重启
```

---

## 十二、常见问题

| 问题 | 排查命令 |
|------|---------|
| 后端无法启动 | `pm2 logs telro-backend` |
| Asterisk AMI 连接失败 | `sudo asterisk -rvvv` 检查 manager.conf |
| Socket.io 断连 | 检查 Nginx `Upgrade` 头是否正确 |
| 录音文件权限 | `sudo chown -R asterisk:telro /var/spool/asterisk/monitor` |
| 数据库损坏 | `sqlite3 data/telro.db ".tables"` 检查完整性 |
| SIP 注册失败 | `sudo ufw status` 确认 5060/udp 开放 |

---

## 十三、GCP 专项配置

```bash
# GCP 实例元数据获取外部 IP
EXTERNAL_IP=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/externalIp" -H "Metadata-Flavor: Google")
echo "服务器外部IP: $EXTERNAL_IP"

# GCP Cloud NAT（如果 SIP 穿透有问题，设置 externip）
# 在 /etc/asterisk/sip.conf 添加：
# externip=<EXTERNAL_IP>
# localnet=10.0.0.0/8
```
