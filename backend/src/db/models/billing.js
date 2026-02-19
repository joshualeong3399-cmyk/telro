import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Billing = sequelize.define('Billing', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  extensionId: {
    type: DataTypes.UUID,
  },
  merchantId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '所属商家 ID，商家用户只能查看自己名下的账单',
  },
  callRecordId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  billingType: {
    // campaign-outbound: the outbound leg (dialing customer)
    // campaign-inbound: the inbound agent leg (agent answers queue)
    type: DataTypes.ENUM('extension', 'trunk', 'internal', 'campaign-outbound', 'campaign-inbound'),
    allowNull: false,
  },
  queueTaskId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: '关联群呼任务（双计费时使用）',
  },
  leg: {
    type: DataTypes.ENUM('outbound', 'inbound'),
    allowNull: true,
    comment: '通话腿：outbound=呼出到客户, inbound=坐席接入',
  },
  from: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  to: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER, // seconds
    allowNull: false,
  },
  ratePerMinute: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
  },
  ratePerSecond: {
    type: DataTypes.DECIMAL(10, 6),
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
  },
  billingDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  month: {
    type: DataTypes.INTEGER,
  },
  year: {
    type: DataTypes.INTEGER,
  },
  status: {
    type: DataTypes.ENUM('pending', 'invoiced', 'paid'),
    defaultValue: 'pending',
  },
  invoiceId: {
    type: DataTypes.UUID,
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
  tableName: 'billing',
  timestamps: true,
  indexes: [
    {
      fields: ['extensionId', 'billingDate'],
    },
    {
      fields: ['year', 'month'],
    },
  ],
});

export default Billing;
