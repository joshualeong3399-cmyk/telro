import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING(255),
  },
  extensionId: {
    type: DataTypes.UUID,
  },
  role: {
    // admin=超级管理员, operator=运营商, merchant=商家管理员, employee=商家员工/分机用户
    type: DataTypes.ENUM('admin', 'operator', 'merchant', 'employee'),
    defaultValue: 'employee',
  },
  merchantId: {
    // 商家/运营商归属（operator 管 merchant，merchant 管 employee）
    type: DataTypes.UUID,
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING(100),
  },
  avatar: {
    type: DataTypes.STRING(500),
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastLogin: {
    type: DataTypes.DATE,
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lockedUntil: {
    type: DataTypes.DATE,
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
  tableName: 'users',
  timestamps: true,
});

export default User;
