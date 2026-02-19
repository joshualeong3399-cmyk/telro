import TimeCondition from '../db/models/time-condition.js';
import logger from '../utils/logger.js';

class TimeConditionService {
  async createCondition(data) {
    const tc = await TimeCondition.create(data);
    logger.info(`✅ Time condition created: ${tc.name}`);
    return tc;
  }

  async updateCondition(tcId, data) {
    const tc = await TimeCondition.findByPk(tcId);
    if (!tc) throw new Error(`Time condition not found: ${tcId}`);
    await tc.update(data);
    return tc;
  }

  async deleteCondition(tcId) {
    const tc = await TimeCondition.findByPk(tcId);
    if (!tc) throw new Error(`Time condition not found: ${tcId}`);
    await tc.destroy();
    return tc;
  }

  async getConditions(limit = 100, offset = 0) {
    return TimeCondition.findAndCountAll({ limit, offset, order: [['name', 'ASC']] });
  }

  async getConditionDetail(tcId) {
    const tc = await TimeCondition.findByPk(tcId);
    if (!tc) throw new Error(`Time condition not found: ${tcId}`);
    return tc;
  }

  async setForceMode(tcId, forceMode) {
    const tc = await TimeCondition.findByPk(tcId);
    if (!tc) throw new Error(`Time condition not found: ${tcId}`);
    await tc.update({ forceMode });
    return tc;
  }

  /**
   * 判断当前时间是否在时间条件范围内
   * @returns {boolean}
   */
  isCurrentlyInTime(tc, now = new Date()) {
    if (tc.forceMode === 'force_open') return true;
    if (tc.forceMode === 'force_closed') return false;

    const dayOfWeek = now.getDay(); // 0=周日
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 检查是否节假日
    const dateStr = now.toISOString().slice(0, 10);
    if ((tc.holidays || []).includes(dateStr)) return false;

    // 检查时间范围
    for (const range of tc.timeRanges || []) {
      if ((range.days || []).includes(dayOfWeek)) {
        if (currentTime >= range.startTime && currentTime <= range.endTime) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 根据时间条件返回当前应该路由到的目标
   */
  resolveDestination(tc, now = new Date()) {
    const inTime = this.isCurrentlyInTime(tc, now);
    return {
      inTime,
      destinationType: inTime ? tc.matchDestinationType : tc.noMatchDestinationType,
      destinationId: inTime ? tc.matchDestinationId : tc.noMatchDestinationId,
    };
  }
}

export default new TimeConditionService();
