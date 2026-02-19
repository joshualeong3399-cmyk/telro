import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const TimeCondition = sequelize.define('TimeCondition', {
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
  // 时间规则，JSON 数组
  // [{ days: [1,2,3,4,5], startTime: "09:00", endTime: "18:00" }]
  // days: 0=周日, 1=周一 ... 6=周六
  timeRanges: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  // 符合时间时的路由目标
  matchDestinationType: {
    type: DataTypes.ENUM('extension', 'ivr', 'queue', 'hangup'),
    defaultValue: 'ivr',
  },
  matchDestinationId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // 不符合时间时的路由目标（如下班、节假日）
  noMatchDestinationType: {
    type: DataTypes.ENUM('extension', 'ivr', 'queue', 'voicemail', 'hangup'),
    defaultValue: 'hangup',
  },
  noMatchDestinationId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // 手动强制覆盖：override_match | override_no_match | auto
  forceMode: {
    type: DataTypes.ENUM('auto', 'force_open', 'force_closed'),
    defaultValue: 'auto',
  },
  // 节假日列表，JSON 数组 ["2026-01-01", "2026-02-04"]
  holidays: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'time_conditions',
  timestamps: true,
});

export default TimeCondition;
