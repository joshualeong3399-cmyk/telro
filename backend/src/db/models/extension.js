import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Extension = sequelize.define('Extension', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  number: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('SIP', 'IAX2', 'DAHDI'),
    defaultValue: 'SIP',
  },
  context: {
    type: DataTypes.STRING(100),
    defaultValue: 'from-internal',
  },
  secret: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  callerid: {
    type: DataTypes.STRING(100),
  },
  host: {
    type: DataTypes.STRING(100),
    defaultValue: 'dynamic',
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'dnd', 'busy'),
    defaultValue: 'offline',
  },
  dnd: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  maxCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  email: {
    type: DataTypes.STRING(255),
  },
  department: {
    type: DataTypes.STRING(100),
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
  tableName: 'extensions',
  timestamps: true,
});

export default Extension;
