import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const InboundRoute = sequelize.define('InboundRoute', {
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
  // 匹配的 DID 号码，支持正则，空表示匹配所有
  did: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  // 来电方号码匹配（CallerID）
  callerIdMatch: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  // 目标类型
  destinationType: {
    type: DataTypes.ENUM('extension', 'ivr', 'queue', 'voicemail', 'hangup', 'time_condition'),
    allowNull: false,
    defaultValue: 'extension',
  },
  // 目标 ID（对应 Extension/IVR/Queue 的 UUID）
  destinationId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // 时间条件 ID（可选），满足时间条件才应用此路由
  timeConditionId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // 优先级，数字越小越优先
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  // 覆盖来电显示名称
  callerIdName: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'inbound_routes',
  timestamps: true,
});

export default InboundRoute;
