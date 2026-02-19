import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ConferenceRoom = sequelize.define('ConferenceRoom', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  number: { type: DataTypes.STRING(20), unique: true, allowNull: false }, // e.g. "8000"
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  pinRequired: { type: DataTypes.BOOLEAN, defaultValue: false },
  pin: { type: DataTypes.STRING(20) },
  adminPin: { type: DataTypes.STRING(20) }, // admin pin to kick/mute members
  maxMembers: { type: DataTypes.INTEGER, defaultValue: 50 },
  recordEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  muteOnEntry: { type: DataTypes.BOOLEAN, defaultValue: false },
  musicOnHold: { type: DataTypes.BOOLEAN, defaultValue: true }, // play MOH while waiting for other participants
  announceCount: { type: DataTypes.BOOLEAN, defaultValue: true }, // announce participant count
  waitForHost: { type: DataTypes.BOOLEAN, defaultValue: false }, // wait for admin pin user before starting
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'conference_rooms', timestamps: true });

export default ConferenceRoom;
