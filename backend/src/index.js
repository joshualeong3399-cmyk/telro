import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIO } from 'socket.io';
import { sequelize } from './db/index.js';
import logger from './utils/logger.js';
import amiClient from './asterisk/ami-client.js';
import EventHandlers from './asterisk/event-handler.js';
import asteriskConfigService from './services/asterisk-config-service.js';
import queueService from './services/queue-service.js';

// 导入路由
import authRoutes from './routes/auth.js';
import extensionRoutes from './routes/extension.js';
import callRoutes from './routes/call.js';
import billingRoutes from './routes/billing.js';
import recordingRoutes from './routes/recording.js';
import queueRoutes from './routes/queue.js';
import agentRoutes from './routes/agent.js';
import customerRoutes from './routes/customer.js';
import sipTrunkRoutes from './routes/sip-trunk.js';
import inboundRouteRoutes from './routes/inbound-route.js';
import outboundRouteRoutes from './routes/outbound-route.js';
import ivrRoutes from './routes/ivr.js';
import timeConditionRoutes from './routes/time-condition.js';
import dncRoutes from './routes/dnc.js';
import dispositionRoutes from './routes/disposition.js';
import asteriskRoutes from './routes/asterisk.js';
import ringGroupRoutes from './routes/ring-group.js';
import voicemailRoutes from './routes/voicemail.js';
import conferenceRoutes from './routes/conference.js';
import aiFlowRoutes from './routes/ai-flow.js';
import campaignRoutes from './routes/campaign.js';
import smsRoutes from './routes/sms.js';
import usersRoutes from './routes/users.js';
import audioFilesRoutes from './routes/audio-files.js';

// 创建Express应用
const app = express();
const server = http.createServer(app);

// Socket.io 实时推送
const io = new SocketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  logger.info(`🔌 WebSocket connected: ${socket.id}`);
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  // 简单鉴权：生产环境应验证 JWT
  socket.on('authenticate', (data) => {
    if (data?.userId) {
      socket.join(`user:${data.userId}`);
      logger.info(`WS authenticated: user=${data.userId} socket=${socket.id}`);
    }
  });
  socket.on('disconnect', () => {
    logger.info(`🔌 WebSocket disconnected: ${socket.id}`);
  });
});

// 将 io 挂到 app 以便路由内使用
app.set('io', io);
// 将 io 传给 queueService 以便 campaign 实时推送
queueService.setIo(io);

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(
      `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/extensions', extensionRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sip-trunks', sipTrunkRoutes);
app.use('/api/inbound-routes', inboundRouteRoutes);
app.use('/api/outbound-routes', outboundRouteRoutes);
app.use('/api/ivr', ivrRoutes);
app.use('/api/time-conditions', timeConditionRoutes);
app.use('/api/dnc', dncRoutes);
app.use('/api/dispositions', dispositionRoutes);
app.use('/api/asterisk', asteriskRoutes);
app.use('/api/ring-groups', ringGroupRoutes);
app.use('/api/voicemail', voicemailRoutes);
app.use('/api/conference', conferenceRoutes);
app.use('/api/ai', aiFlowRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audio-files', audioFilesRoutes);

// 健康检查 — 始终返回 200，Asterisk 断开不影响健康状态
app.get('/health', (req, res) => {
  res.status( 200 ).json( {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    asterisk: amiClient.isConnected ? 'connected' : 'disconnected',
  });
});

// API文档
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Telro Telemarketing System',
    version: '1.0.0',
    description: 'Professional Telemarketing System for Asterisk',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        refresh: 'POST /api/auth/refresh',
      },
      extensions: {
        list: 'GET /api/extensions',
        create: 'POST /api/extensions',
        detail: 'GET /api/extensions/:id',
        update: 'PUT /api/extensions/:id',
        delete: 'DELETE /api/extensions/:id',
        status: 'GET /api/extensions/:id/status',
        allStatus: 'GET /api/extensions/status/all',
        setEnabled: 'PATCH /api/extensions/:id/enabled',
        setDND: 'PATCH /api/extensions/:id/dnd',
        resetSecret: 'POST /api/extensions/:id/reset-secret',
      },
      calls: {
        dial: 'POST /api/calls/dial',
        list: 'GET /api/calls',
        active: 'GET /api/calls/active/list',
        transfer: 'POST /api/calls/:callId/transfer',
        hangup: 'POST /api/calls/:callId/hangup',
        monitor: 'POST /api/calls/:callId/monitor',
        monthlyStats: 'GET /api/calls/stats/monthly',
        extensionHistory: 'GET /api/calls/extension/:extensionId',
      },
      billing: {
        monthly: 'GET /api/billing/monthly',
        monthlySummary: 'GET /api/billing/monthly/summary',
        range: 'GET /api/billing/range',
        generateInvoice: 'POST /api/billing/invoice/generate',
        topUsers: 'GET /api/billing/top-users',
        trend: 'GET /api/billing/trend/:extensionId',
        byType: 'GET /api/billing/by-type',
        pending: 'GET /api/billing/pending',
        updateStatus: 'PATCH /api/billing/status/update',
      },
      recordings: {
        list: 'GET /api/recordings',
        detail: 'GET /api/recordings/:id',
        download: 'GET /api/recordings/:id/download',
        delete: 'DELETE /api/recordings/:id',
        archive: 'PATCH /api/recordings/:id/archive',
        extension: 'GET /api/recordings/extension/:extensionNumber',
        stats: 'GET /api/recordings/stats/summary',
      },
      queue: {
        create: 'POST /api/queue',
        list: 'GET /api/queue',
        delete: 'DELETE /api/queue/:id',
        addTasks: 'POST /api/queue/:queueId/tasks',
        getTasks: 'GET /api/queue/:queueId/tasks',
        start: 'POST /api/queue/:queueId/start',
        pause: 'POST /api/queue/:queueId/pause',
        stop: 'POST /api/queue/:queueId/stop',
        stats: 'GET /api/queue/:queueId/stats',
        retryFailed: 'POST /api/queue/:queueId/retry-failed',
        report: 'GET /api/queue/:queueId/report',
      },
    },
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: `Not Found: ${req.method} ${req.path}`,
    hint: 'See /api/docs for available endpoints',
  });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 初始化数据库和Asterisk连接
async function initialize() {
  try {
    logger.info('🚀 Initializing Telro System...');

    // 连接数据库
    logger.info('📊 Connecting to database...');
    await sequelize.authenticate();
    logger.info('✅ Database connected');

    // 先启动服务器，Asterisk 在后台异步连接（连接失败不影响启动）
    const PORT = process.env.PORT || 3000;
    server.listen( PORT, () => {
      logger.info( `✅ Server running on http://localhost:${ PORT }` );
      logger.info( `🔌 WebSocket ready on ws://localhost:${ PORT }` );
      logger.info( `📚 API Documentation: http://localhost:${ PORT }/api/docs` );
      logger.info( `❤️  Health Check: http://localhost:${ PORT }/health` );
    } );

    // 初始化事件处理器（注入 Socket.io）
    new EventHandlers(io);
    logger.info('✅ Event handlers initialized');

    // 连接 Asterisk（异步，失败只警告，后台持续重连）
    logger.info( '☎️  Connecting to Asterisk (non-blocking)...' );
    amiClient.connect()
      .then( async () => {
        logger.info( '✅ Asterisk connected' );
        await asteriskConfigService.setupIncludes().catch( e =>
          logger.warn( '⚠️  setupIncludes 失败:', e.message )
        );
        asteriskConfigService.syncAll()
          .then( () => logger.info( '✅ 初始 Asterisk 配置同步完成' ) )
          .catch( e => logger.warn( '⚠️  初始 Asterisk 配置同步失败:', e.message ) );
      } )
      .catch( e => {
        logger.warn( `⚠️  Asterisk 暂时不可用 (${ e.message })，系统已启动，将在后台持续重连...` );
      } );

  } catch (error) {
    logger.error('❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

// 处理退出信号
process.on('SIGTERM', async () => {
  logger.info('📛 SIGTERM signal received: closing HTTP server');
  amiClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('📛 SIGINT signal received: closing HTTP server');
  amiClient.disconnect();
  process.exit(0);
});

// 启动应用
initialize().catch((error) => {
  logger.error('Failed to start application:', error.message);
  process.exit(1);
});

export default app;
