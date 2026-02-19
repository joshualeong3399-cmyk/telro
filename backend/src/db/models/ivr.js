import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const IVR = sequelize.define('IVR', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
  },
  // 问候语音文件路径或 TTS 文本
  greeting: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  greetingType: {
    type: DataTypes.ENUM('file', 'tts'),
    defaultValue: 'tts',
  },
  // 等待按键超时（秒）
  timeout: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  // 按键选项，JSON 数组：
  // [{ digit: "1", label: "销售", destinationType: "extension", destinationId: "..." }]
  options: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  // 无效输入时的提示语
  invalidMessage: {
    type: DataTypes.TEXT,
    defaultValue: '您的输入无效，请重试',
  },
  // 最大重试次数
  maxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  // 超时后默认目标
  timeoutDestinationType: {
    type: DataTypes.ENUM('extension', 'ivr', 'queue', 'hangup'),
    defaultValue: 'hangup',
  },
  timeoutDestinationId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // 允许直拨分机
  directDial: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'ivrs',
  timestamps: true,
});

export default IVR;
