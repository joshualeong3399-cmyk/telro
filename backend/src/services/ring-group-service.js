import RingGroup from '../db/models/ring-group.js';
import logger from '../utils/logger.js';
import asteriskConfigService from './asterisk-config-service.js';

class RingGroupService {
  async createRingGroup(data) {
    const existing = await RingGroup.findOne({ where: { number: data.number } });
    if (existing) throw new Error(`Ring group number ${data.number} already exists`);
    const rg = await RingGroup.create(data);
    logger.info(`✅ Ring Group created: ${rg.name} (${rg.number})`);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return rg;
  }

  async updateRingGroup(id, data) {
    const rg = await RingGroup.findByPk(id);
    if (!rg) throw new Error(`Ring Group not found: ${id}`);
    await rg.update(data);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return rg;
  }

  async deleteRingGroup(id) {
    const rg = await RingGroup.findByPk(id);
    if (!rg) throw new Error(`Ring Group not found: ${id}`);
    await rg.destroy();
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return rg;
  }

  async getRingGroups(limit = 100, offset = 0) {
    return RingGroup.findAndCountAll({ limit, offset, order: [['number', 'ASC']] });
  }

  async getRingGroupDetail(id) {
    const rg = await RingGroup.findByPk(id);
    if (!rg) throw new Error(`Ring Group not found: ${id}`);
    return rg;
  }

  async setEnabled(id, enabled) {
    const rg = await RingGroup.findByPk(id);
    if (!rg) throw new Error(`Ring Group not found: ${id}`);
    await rg.update({ enabled });
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return rg;
  }
}

export default new RingGroupService();
