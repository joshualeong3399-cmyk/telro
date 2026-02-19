import Disposition from '../db/models/disposition.js';
import logger from '../utils/logger.js';

class DispositionService {
  async createDisposition(data) {
    const d = await Disposition.create(data);
    logger.info(`✅ Disposition created: ${d.name}`);
    return d;
  }

  async updateDisposition(id, data) {
    const d = await Disposition.findByPk(id);
    if (!d) throw new Error(`Disposition not found: ${id}`);
    await d.update(data);
    return d;
  }

  async deleteDisposition(id) {
    const d = await Disposition.findByPk(id);
    if (!d) throw new Error(`Disposition not found: ${id}`);
    await d.destroy();
    return d;
  }

  async getDispositions(enabledOnly = false) {
    const where = enabledOnly ? { enabled: true } : {};
    return Disposition.findAll({ where, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
  }

  async seedDefaults() {
    const defaults = [
      { code: 'INTERESTED', name: '有意向', color: '#52c41a', isSuccess: true, sortOrder: 1 },
      { code: 'CALLBACK', name: '回拨', color: '#1677ff', triggerCallback: true, callbackMinutes: 60, sortOrder: 2 },
      { code: 'NOT_INTERESTED', name: '无意向', color: '#8c8c8c', sortOrder: 3 },
      { code: 'NO_ANSWER', name: '无人接听', color: '#faad14', sortOrder: 4 },
      { code: 'BUSY', name: '忙线', color: '#ff7a45', sortOrder: 5 },
      { code: 'INVALID', name: '无效号码', color: '#ff4d4f', sortOrder: 6 },
      { code: 'DNC', name: '要求加黑名单', color: '#722ed1', sortOrder: 7 },
      { code: 'CONVERTED', name: '已成交', color: '#13c2c2', isSuccess: true, requireNote: true, sortOrder: 8 },
    ];

    for (const item of defaults) {
      const existing = await Disposition.findOne({ where: { code: item.code } });
      if (!existing) await Disposition.create(item);
    }
    logger.info('✅ Default dispositions seeded');
  }
}

export default new DispositionService();
