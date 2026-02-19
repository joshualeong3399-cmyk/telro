import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const SmsMessage = sequelize.define('SmsMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  from: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '发送方号码',
  },
  to: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '接收方号码',
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '短信内容',
  },
  direction: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false,
    defaultValue: 'outbound',
  },
  status: {
    type: DataTypes.ENUM('draft', 'sending', 'sent', 'delivered', 'failed', 'received'),
    defaultValue: 'draft',
  },
  sipTrunkId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '使用的SIP线路（用于发送）',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '操作用户',
  },
  campaignId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '关联群发活动',
  },
  externalId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '外部平台消息ID',
  },
  errorMsg: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'sms_messages',
  timestamps: true,
  indexes: [
    { fields: ['direction'] },
    { fields: ['status'] },
    { fields: ['from'] },
    { fields: ['to'] },
    { fields: ['sipTrunkId'] },
    { fields: ['userId'] },
    { fields: ['createdAt'] },
  ],
});

export default SmsMessage;
