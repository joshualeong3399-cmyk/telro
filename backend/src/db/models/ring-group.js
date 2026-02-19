import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RingGroup = sequelize.define('RingGroup', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  number: { type: DataTypes.STRING(20), unique: true, allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  // JSON array of extension numbers or SIP peers: ["1001","1002","SIP/provider/8001"]
  members: { type: DataTypes.JSON, defaultValue: [] },
  strategy: {
    type: DataTypes.ENUM('ringall', 'hunt', 'memoryhunt', 'firstavailable', 'firstnotonphone'),
    defaultValue: 'ringall',
  },
  ringTime: { type: DataTypes.INTEGER, defaultValue: 20 }, // seconds each member rings
  callConfirmation: { type: DataTypes.BOOLEAN, defaultValue: false }, // confirm before bridging
  // Failover: where to send if no one answers
  failoverType: {
    type: DataTypes.ENUM('extension', 'ivr', 'queue', 'voicemail', 'hangup'),
    defaultValue: 'hangup',
  },
  failoverId: { type: DataTypes.UUID, allowNull: true },
  prefix: { type: DataTypes.STRING(20), defaultValue: '' }, // prepend to callerid
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'ring_groups', timestamps: true });

export default RingGroup;
