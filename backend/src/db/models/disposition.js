import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

// 话后处置码 —— 坐席通话结束后标记通话结果
const Disposition = sequelize.define('Disposition', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  // 显示颜色（Hex 或 Ant Design token）
  color: {
    type: DataTypes.STRING(20),
    defaultValue: '#1677ff',
  },
  // 是否算作"成功"（用于转化率统计）
  isSuccess: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // 是否需要填写跟进备注
  requireNote: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // 是否触发自动回拨计划
  triggerCallback: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // 回拨间隔（分钟），仅 triggerCallback=true 时有效
  callbackMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'dispositions',
  timestamps: true,
});

export default Disposition;
