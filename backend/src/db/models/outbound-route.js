import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const OutboundRoute = sequelize.define('OutboundRoute', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  // 拨号规则，JSON 数组，如 ["9.", "NXXNXXXXXX", "1NXXNXXXXXX"]
  dialPatterns: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  // 使用的中继（主）
  sipTrunkId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // 备用中继顺序，JSON 数组 [trunkId1, trunkId2]
  trunkSequence: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  // 是否剥离拨号前缀
  stripDigits: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // 在号码前面加的前缀
  prepend: {
    type: DataTypes.STRING(20),
    defaultValue: '',
  },
  // 覆盖主叫号码
  callerIdOverride: {
    type: DataTypes.STRING(50),
    defaultValue: '',
  },
  // 优先级
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  // 允许使用此路由的分机组（JSON 数组，空=全部允许）
  allowedExtensions: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'outbound_routes',
  timestamps: true,
});

export default OutboundRoute;
