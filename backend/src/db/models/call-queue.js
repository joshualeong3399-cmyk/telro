import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const CallQueue = sequelize.define('CallQueue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  extensionId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  strategy: {
    type: DataTypes.ENUM('ringall', 'roundrobin', 'leastrecent', 'fewestcalls', 'random', 'rrmemory'),
    defaultValue: 'ringall',
  },
  maxWaitTime: {
    type: DataTypes.INTEGER, // seconds
    defaultValue: 300,
  },
  retryInterval: {
    type: DataTypes.INTEGER, // seconds
    defaultValue: 300,
  },
  wrapupTime: {
    type: DataTypes.INTEGER, // seconds
    defaultValue: 0,
  },
  joinempty: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  leavewhenempty: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  autofill: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // ── Campaign 专属字段 ─────────────────────────────────────────────────────────
  sipTrunkId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '拨出使用的 SIP 中继，null 则由 Outbound Route 决定',
  },
  callerIdOverride: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '覆盖主叫号码显示',
  },
  scheduledStartTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '计划开始时间，null 则立即手动启动',
  },
  timezone: {
    type: DataTypes.STRING(100),
    defaultValue: 'Asia/Shanghai',
  },
  maxConcurrentCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    comment: '最大并发通话数',
  },
  defaultHandling: {
    type: DataTypes.ENUM('human', 'ai', 'ask'),
    defaultValue: 'ask',
    comment: '接通后默认处理方式：ask=让操作员选择',
  },
  aiFlowId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '接通后执行的 AI 流程',
  },
  // 双计费字段
  costPerMinute: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0,
    comment: '拨出腿每分钟费率（呼出到客户）',
  },
  agentCostPerMinute: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0,
    comment: '坐席接入腿每分钟费率（话务员接听）',
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'CNY',
  },
  // ── DTMF 按键接转 ──────────────────────────────────────────────────────────
  merchantId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '所属商家 ID，商家用户只能查看自己名下的活动队列',
  },
  dtmfConnectKey: {
    type: DataTypes.STRING(5),
    allowNull: true,
    comment: '触发接转的按键 (0-9,*,#)，null=不启用 DTMF',
  },
  dtmfConnectType: {
    type: DataTypes.ENUM('extension', 'ivr', 'queue'),
    allowNull: true,
    comment: '按键后转接目标类型',
  },
  dtmfConnectId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '按键后转接目标的 ID（分机/IVR/队列）',
  },
  dtmfAudioFileId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '播报语音文件 ID，null=静音等待按键',
  },
  dtmfTimeout: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: '每次等待按键的秒数',
  },
  dtmfMaxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    comment: '无按键时最多重播次数，超过后挂机',
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'inactive', 'scheduled', 'completed'),
    defaultValue: 'inactive',
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'call_queues',
  timestamps: true,
});

export default CallQueue;
