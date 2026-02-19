import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const QueueTask = sequelize.define('QueueTask', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  queueId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  targetNumber: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  contactName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '联系人姓名（来自导入的通讯录）',
  },
  // 通话过程中的 Asterisk Channel ID（用于 AMI Redirect）
  channelId: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  channelUniqueId: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  callRecordId: {
    type: DataTypes.UUID,
  },
  status: {
    type: DataTypes.ENUM('pending', 'calling', 'answered', 'no-answer', 'busy', 'failed', 'cancelled', 'transferred', 'ai-handled', 'waiting-agent'),
    defaultValue: 'pending',
  },
  // 接通后的处理方式
  handledBy: {
    type: DataTypes.ENUM('human', 'ai', 'queue'),
    allowNull: true,
  },
  transferredToExtension: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  // 详细结果：answered|busy|no-answer|congestion|failed|cancel
  callResultDetail: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  maxAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  lastAttemptTime: {
    type: DataTypes.DATE,
  },
  nextRetryTime: {
    type: DataTypes.DATE,
  },
  result: {
    type: DataTypes.STRING(255),
  },
  answeredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '客户接听时间',
  },
  notes: {
    type: DataTypes.TEXT,
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
  tableName: 'queue_tasks',
  timestamps: true,
  indexes: [
    {
      fields: ['queueId', 'status'],
    },
  ],
});

export default QueueTask;
