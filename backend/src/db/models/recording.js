import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Recording = sequelize.define('Recording', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  callRecordId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  format: {
    type: DataTypes.STRING(20),
    defaultValue: 'wav',
  },
  duration: {
    type: DataTypes.INTEGER, // seconds
    defaultValue: 0,
  },
  size: {
    type: DataTypes.BIGINT, // bytes
    defaultValue: 0,
  },
  mimeType: {
    type: DataTypes.STRING(50),
    defaultValue: 'audio/wav',
  },
  sampleRate: {
    type: DataTypes.INTEGER,
    defaultValue: 8000,
  },
  channels: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  quality: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
  },
  status: {
    type: DataTypes.ENUM('recording', 'completed', 'processing', 'failed'),
    defaultValue: 'recording',
  },
  transcription: {
    type: DataTypes.TEXT,
  },
  archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  tableName: 'recordings',
  timestamps: true,
});

export default Recording;
