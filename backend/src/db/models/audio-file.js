import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const AudioFile = sequelize.define('AudioFile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  filename: { type: DataTypes.STRING(500), allowNull: false },
  filePath: { type: DataTypes.STRING(1000), allowNull: false },
  // path relative to Asterisk sounds directory (for Playback app)
  asteriskPath: { type: DataTypes.STRING(500) }, // e.g. "custom/my-greeting"
  duration: { type: DataTypes.INTEGER }, // seconds
  size: { type: DataTypes.INTEGER },    // bytes
  mimeType: { type: DataTypes.STRING(100), defaultValue: 'audio/wav' },
  category: {
    type: DataTypes.ENUM('ivr', 'moh', 'voicemail', 'campaign', 'flow', 'other'),
    defaultValue: 'other',
  },
  uploadedBy: { type: DataTypes.UUID }, // userId
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'audio_files', timestamps: true });

export default AudioFile;
