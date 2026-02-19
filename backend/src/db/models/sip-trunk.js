import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const SIPTrunk = sequelize.define('SIPTrunk', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
  },
  provider: {
    type: DataTypes.STRING(100),
  },
  host: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  port: {
    type: DataTypes.INTEGER,
    defaultValue: 5060,
  },
  protocol: {
    type: DataTypes.ENUM('SIP', 'UDP', 'TCP', 'TLS'),
    defaultValue: 'SIP',
  },
  context: {
    type: DataTypes.STRING(100),
    defaultValue: 'from-trunk',
  },
  username: {
    type: DataTypes.STRING(100),
  },
  secret: {
    type: DataTypes.STRING(255),
  },
  authid: {
    type: DataTypes.STRING(100),
  },
  fromuser: {
    type: DataTypes.STRING(100),
  },
  fromdomain: {
    type: DataTypes.STRING(255),
  },
  rtpengine: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  canreinvite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  insecure: {
    type: DataTypes.STRING(100),
    defaultValue: 'invite,port',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'error'),
    defaultValue: 'inactive',
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  ratePerMinute: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.05,
  },
  costPer1000: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.1,
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  supportsSms: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this trunk supports outbound SMS',
  },
  smsApiUrl: {
    type: DataTypes.STRING(500),
    comment: 'HTTP endpoint for SMS gateway (e.g. Twilio, Alibaba Cloud)',
  },
  smsApiKey: {
    type: DataTypes.STRING(255),
    comment: 'API key / Account SID for SMS gateway',
  },
  smsApiSecret: {
    type: DataTypes.STRING(255),
    comment: 'API secret / Auth token for SMS gateway',
  },
  lastStatusCheck: {
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
  tableName: 'sip_trunks',
  timestamps: true,
});

export default SIPTrunk;
