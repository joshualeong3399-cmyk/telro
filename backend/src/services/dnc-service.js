import { Op } from 'sequelize';
import DNC from '../db/models/dnc.js';
import logger from '../utils/logger.js';

class DncService {
  async addNumber(data) {
    const existing = await DNC.findOne({ where: { phoneNumber: data.phoneNumber } });
    if (existing) {
      // 已存在则更新
      await existing.update({ ...data, enabled: true });
      return existing;
    }
    const dnc = await DNC.create(data);
    logger.info(`🚫 DNC added: ${dnc.phoneNumber}`);
    return dnc;
  }

  async removeNumber(dncId) {
    const dnc = await DNC.findByPk(dncId);
    if (!dnc) throw new Error(`DNC entry not found: ${dncId}`);
    await dnc.destroy();
    return dnc;
  }

  async getList(filters = {}, limit = 100, offset = 0) {
    const where = {};
    if (filters.reason) where.reason = filters.reason;
    if (filters.enabled !== undefined) where.enabled = filters.enabled;

    return DNC.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * 检查号码是否在黑名单中
   * @returns {boolean}
   */
  async isBlocked(phoneNumber) {
    const entry = await DNC.findOne({
      where: {
        phoneNumber,
        enabled: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
    });
    return !!entry;
  }

  /**
   * 批量导入号码
   */
  async bulkImport(numbers, reason = 'imported', addedByUserId = null) {
    let imported = 0;
    let skipped = 0;
    for (const phoneNumber of numbers) {
      if (!phoneNumber || phoneNumber.trim() === '') continue;
      try {
        const existing = await DNC.findOne({ where: { phoneNumber: phoneNumber.trim() } });
        if (!existing) {
          await DNC.create({ phoneNumber: phoneNumber.trim(), reason, addedByUserId });
          imported++;
        } else {
          skipped++;
        }
      } catch (err) {
        logger.warn(`DNC import error for ${phoneNumber}: ${err.message}`);
      }
    }
    logger.info(`📥 DNC bulk import: ${imported} added, ${skipped} skipped`);
    return { imported, skipped };
  }

  async setEnabled(dncId, enabled) {
    const dnc = await DNC.findByPk(dncId);
    if (!dnc) throw new Error(`DNC entry not found: ${dncId}`);
    await dnc.update({ enabled });
    return dnc;
  }
}

export default new DncService();
