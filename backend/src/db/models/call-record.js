import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const CallRecord = sequelize.define('CallRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  callId: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
  },
  uniqueId: {
    type: DataTypes.STRING(255),
  },
  from: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  fromExtensionId: {
    type: DataTypes.UUID,
  },
  to: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  toExtensionId: {
    type: DataTypes.UUID,
  },
  type: {
    type: DataTypes.ENUM('inbound', 'outbound', 'internal', 'transfer'),
    allowNull: false,
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  connectTime: {
    type: DataTypes.DATE,
  },
  endTime: {
    type: DataTypes.DATE,
  },
  duration: {
    type: DataTypes.INTEGER, // seconds
    defaultValue: 0,
  },
  talkTime: {
    type: DataTypes.INTEGER, // seconds
    defaultValue: 0,
  },
  ringTime: {
    type: DataTypes.INTEGER, // seconds
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('answered', 'no-answer', 'busy', 'failed', 'cancelled'),
    defaultValue: 'failed',
  },
  hangupCause: {
    type: DataTypes.STRING(100),
  },
  hasRecording: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  recordingId: {
    type: DataTypes.UUID,
  },
  sipTrunkId: {
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
  tableName: 'call_records',
  timestamps: true,
  indexes: [
    {
      fields: ['from', 'startTime'],
    },
    {
      fields: ['to', 'startTime'],
    },
    {
      fields: ['startTime'],
    },
  ],
});

export default CallRecord;
