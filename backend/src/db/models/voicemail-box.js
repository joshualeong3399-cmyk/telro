import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const VoicemailBox = sequelize.define('VoicemailBox', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  extensionId: { type: DataTypes.UUID, allowNull: false },
  mailbox: { type: DataTypes.STRING(50), unique: true, allowNull: false }, // e.g. "1001@default"
  password: { type: DataTypes.STRING(20), defaultValue: '1234' },
  email: { type: DataTypes.STRING(255) },
  emailAttach: { type: DataTypes.BOOLEAN, defaultValue: true },   // send recording as attachment
  deleteAfterEmail: { type: DataTypes.BOOLEAN, defaultValue: false },
  timezone: { type: DataTypes.STRING(50), defaultValue: 'cn_CN_UTF-8|Asia/Shanghai' },
  // Greeting: type file = uploaded, type default = system default
  greetingType: { type: DataTypes.ENUM('default', 'busy', 'unavail'), defaultValue: 'unavail' },
  greetingFile: { type: DataTypes.STRING(255) },
  maxMessages: { type: DataTypes.INTEGER, defaultValue: 100 },
  maxMessageLength: { type: DataTypes.INTEGER, defaultValue: 180 }, // seconds
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'voicemail_boxes', timestamps: true });

export default VoicemailBox;
