import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(255),
  },
  email: {
    type: DataTypes.STRING(255),
  },
  company: {
    type: DataTypes.STRING(255),
  },
  industry: {
    type: DataTypes.STRING(100),
  },
  region: {
    type: DataTypes.STRING(100),
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [], // ['vip', 'hot_lead', 'follow_up']
  },
  source: {
    type: DataTypes.STRING(50), // 'ads', 'referral', 'cold_call', 'import'
  },
  status: {
    type: DataTypes.ENUM('new', 'contacted', 'qualified', 'lost', 'converted'),
    defaultValue: 'new',
  },
  notes: {
    type: DataTypes.TEXT,
  },
  lastContactAt: {
    type: DataTypes.DATE,
  },
  nextFollowupAt: {
    type: DataTypes.DATE,
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
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
  tableName: 'customers',
  timestamps: true,
});

export default Customer;
