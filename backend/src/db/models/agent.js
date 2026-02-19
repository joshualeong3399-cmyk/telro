import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Agent = sequelize.define('Agent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  extensionId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  loginTime: {
    type: DataTypes.DATE,
    defaultValue: null,
  },
  logoutTime: {
    type: DataTypes.DATE,
    defaultValue: null,
  },
  status: {
    type: DataTypes.ENUM('logged_in', 'logged_out', 'on_break', 'on_call'),
    defaultValue: 'logged_out',
  },
  totalWorkDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // 秒
  },
  currentDayDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // 秒
  },
  skillTags: {
    type: DataTypes.JSON,
    defaultValue: [], // ['sales', 'support', 'technical']
  },
  performanceRating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  department: {
    type: DataTypes.STRING(100),
  },
  managerId: {
    type: DataTypes.UUID,
  },
  notes: {
    type: DataTypes.TEXT,
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
  tableName: 'agents',
  timestamps: true,
});

export default Agent;
