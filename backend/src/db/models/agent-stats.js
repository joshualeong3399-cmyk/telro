import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgentStats = sequelize.define('AgentStats', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  agentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  totalCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  answeredCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  missedCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  avgTalkTime: {
    type: DataTypes.INTEGER, // 秒
    defaultValue: 0,
  },
  totalTalkTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  conversionRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0, // 百分比
  },
  quality: {
    type: DataTypes.FLOAT,
    defaultValue: 0, // 0-100
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
  tableName: 'agent_stats',
  timestamps: true,
});

export default AgentStats;
