# Telro Frontend

前端电销系统 Web GUI

## 功能模块

- ✅ 用户认证 (登录/登出)
- ✅ 仪表板 (数据概览、图表)
- ✅ 分机管理 (CRUD操作、状态监控)
- ✅ 群呼管理 (队列管理、号码导入、实时统计)
- ✅ 通话记录 (检索、详情查看、导出)
- ✅ 录音管理 (列表、下载、删除)
- ✅ 计费管理 (月度账单、趋势分析、报表导出)

## 技术栈

- React 18
- TypeScript
- Ant Design 5
- Zustand (状态管理)
- Axios (HTTP请求)
- Recharts (数据可视化)
- Vite (构建工具)

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 环境配置

创建 `.env.local` 文件：

```
VITE_API_BASE_URL=http://localhost:3000/api
```

## 项目结构

```
src/
├── main.tsx              # 应用入口
├── App.tsx               # 主应用组件
├── index.css             # 全局样式
├── pages/                # 页面组件
│   ├── Login.tsx         # 登录页
│   ├── Dashboard.tsx     # 仪表板
│   ├── ExtensionManagement.tsx
│   ├── BillingManagement.tsx
│   ├── RecordingManagement.tsx
│   ├── QueueManagement.tsx
│   └── CallHistory.tsx
├── layouts/              # 布局组件
│   └── Layout.tsx        # 主布局
├── components/           # 通用组件
│   └── ProtectedRoute.tsx
├── services/             # API服务
│   ├── api.ts            # Axios实例
│   ├── auth.ts
│   ├── extension.ts
│   ├── call.ts
│   ├── billing.ts
│   ├── recording.ts
│   └── queue.ts
├── store/                # 状态管理
│   ├── authStore.ts
│   ├── callStore.ts
│   └── extensionStore.ts
└── utils/                # 工具函数
```

## 默认账户

- 用户名: admin
- 密码: admin123

## API集成

前端通过Axios与后端API通信。所有API请求都在 `src/services/` 中定义。

## 状态管理

使用Zustand管理全局状态，包括：
- 用户认证信息
- 活跃通话
- 分机列表

## 页面说明

### 登录页
- 用户认证
- 支持记住登录状态

### 仪表板
- 实时统计卡片
- 近30天通话趋势
- 收入统计
- 活跃通话列表

### 分机管理
- 分机列表
- 新建/编辑/删除分机
- 状态监控（在线/离线/忙碌/请勿打扰）

### 群呼管理
- 队列列表
- 队列启动/暂停/停止
- 号码批量导入
- 实时进度统计

### 通话记录
- 完整通话历史
- 状态过滤
- 详情查看
- 费用统计

### 录音管理
- 录音列表
- 下载录音
- 删除录音
- 文件搜索

### 计费管理
- 月度账单
- 费用统计
- 消费排行
- 报表导出

## 部署

```bash
# 构建生产版本
npm run build

# 输出到 dist 目录
# 部署到 Nginx 或其他Web服务器
```

Nginx配置示例：

```nginx
server {
    listen 80;
    server_name telro.example.com;

    location / {
        root /var/www/telro-frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
    }
}
```

## 常见问题

**Q: 如何修改API地址？**
A: 修改 `.env.local` 中的 `VITE_API_BASE_URL`

**Q: 如何添加新页面？**
A: 
1. 创建页面组件在 `src/pages/`
2. 在 `src/App.tsx` 中添加路由
3. 在 `src/layouts/Layout.tsx` 的菜单中添加链接

**Q: 如何与WebSocket集成？**
A: 在 `src/services/` 中创建WebSocket服务，与Zustand store集成

## 开发规范

- 使用TypeScript编写
- 遵循PascalCase命名（组件）和camelCase命名（变量）
- 使用Hooks进行组件开发
- API调用集中在services层
- 状态管理使用Zustand

## 贡献指南

1. 创建功能分支
2. 提交更改
3. 发起Pull Request

## 许可证

MIT
