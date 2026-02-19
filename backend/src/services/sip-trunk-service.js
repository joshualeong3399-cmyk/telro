import SIPTrunk from '../db/models/sip-trunk.js';
import logger from '../utils/logger.js';
import amiClient from '../asterisk/ami-client.js';
import asteriskConfigService from './asterisk-config-service.js';

class SipTrunkService {
  async createTrunk(data) {
    try {
      const trunk = await SIPTrunk.create(data);
      logger.info(`✅ SIP Trunk created: ${trunk.name}`);
      asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
      return trunk;
    } catch (error) {
      logger.error('Failed to create SIP trunk:', error.message);
      throw error;
    }
  }

  async updateTrunk(trunkId, data) {
    const trunk = await SIPTrunk.findByPk(trunkId);
    if (!trunk) throw new Error(`SIP Trunk not found: ${trunkId}`);
    await trunk.update(data);
    logger.info(`✅ SIP Trunk updated: ${trunk.name}`);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return trunk;
  }

  async deleteTrunk(trunkId) {
    const trunk = await SIPTrunk.findByPk(trunkId);
    if (!trunk) throw new Error(`SIP Trunk not found: ${trunkId}`);
    await trunk.destroy();
    logger.info(`🗑️  SIP Trunk deleted: ${trunk.name}`);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return trunk;
  }

  async getTrunks(limit = 100, offset = 0) {
    return SIPTrunk.findAndCountAll({
      limit,
      offset,
      order: [['priority', 'ASC'], ['name', 'ASC']],
    });
  }

  async getTrunkDetail(trunkId) {
    const trunk = await SIPTrunk.findByPk(trunkId);
    if (!trunk) throw new Error(`SIP Trunk not found: ${trunkId}`);
    return trunk;
  }

  async testTrunkConnectivity(trunkId) {
    const trunk = await SIPTrunk.findByPk(trunkId);
    if (!trunk) throw new Error(`SIP Trunk not found: ${trunkId}`);

    try {
      // 通过 AMI 检查 SIP 注册状态
      const result = await amiClient.action({
        Action: 'SIPshowpeer',
        Peer: trunk.name,
      });

      const isOnline = result?.Status?.includes('OK') || result?.Status?.includes('Registered');
      const status = isOnline ? 'active' : 'inactive';

      await trunk.update({ status });
      return { trunkId, status, detail: result };
    } catch (err) {
      await trunk.update({ status: 'error' });
      return { trunkId, status: 'error', error: err.message };
    }
  }

  async setEnabled(trunkId, enabled) {
    const trunk = await SIPTrunk.findByPk(trunkId);
    if (!trunk) throw new Error(`SIP Trunk not found: ${trunkId}`);
    await trunk.update({ enabled, status: enabled ? 'inactive' : 'inactive' });
    return trunk;
  }

  // 获取首个可用的活跃中继
  async getActiveTrunk() {
    const trunk = await SIPTrunk.findOne({
      where: { enabled: true, status: 'active' },
      order: [['priority', 'ASC']],
    });
    return trunk;
  }
}

export default new SipTrunkService();
