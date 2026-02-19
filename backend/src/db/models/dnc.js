import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// DNC = Do Not Call 黑名单
const DNC = sequelize.define('DNC', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phoneNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  // 加入原因
  reason: {
    type: DataTypes.ENUM('customer_request', 'regulatory', 'invalid_number', 'manual', 'imported'),
    defaultValue: 'manual',
  },
  notes: {
    type: DataTypes.TEXT,
  },
  // 过期时间，NULL 表示永久
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // 加入来源用户 ID
  addedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'dnc_list',
  timestamps: true,
});

export default DNC;
