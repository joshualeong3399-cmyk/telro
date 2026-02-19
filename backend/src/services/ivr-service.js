import IVR from '../db/models/ivr.js';
import logger from '../utils/logger.js';
import amiClient from '../asterisk/ami-client.js';
import asteriskConfigService from './asterisk-config-service.js';

class IvrService {
  async createIvr(data) {
    const ivr = await IVR.create(data);
    logger.info(`✅ IVR created: ${ivr.name}`);
    await this._syncToAsterisk(ivr);
    return ivr;
  }

  async updateIvr(ivrId, data) {
    const ivr = await IVR.findByPk(ivrId);
    if (!ivr) throw new Error(`IVR not found: ${ivrId}`);
    await ivr.update(data);
    await this._syncToAsterisk(ivr);
    return ivr;
  }

  async deleteIvr(ivrId) {
    const ivr = await IVR.findByPk(ivrId);
    if (!ivr) throw new Error(`IVR not found: ${ivrId}`);
    await ivr.destroy();
    logger.info(`🗑️  IVR deleted: ${ivr.name}`);
    return ivr;
  }

  async getIvrs(limit = 100, offset = 0) {
    return IVR.findAndCountAll({ limit, offset, order: [['name', 'ASC']] });
  }

  async getIvrDetail(ivrId) {
    const ivr = await IVR.findByPk(ivrId);
    if (!ivr) throw new Error(`IVR not found: ${ivrId}`);
    return ivr;
  }

  async setEnabled(ivrId, enabled) {
    const ivr = await IVR.findByPk(ivrId);
    if (!ivr) throw new Error(`IVR not found: ${ivrId}`);
    await ivr.update({ enabled });
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return ivr;
  }

  // 将 IVR 配置生成 Asterisk dialplan 上下文（extensions.conf 格式）
  generateDialplan(ivr) {
    const lines = [];
    const ctx = `ivr-${ivr.name.replace(/\s+/g, '-').toLowerCase()}`;
    lines.push(`[${ctx}]`);
    lines.push(`exten => s,1,Answer()`);
    lines.push(`exten => s,n,Playback(${ivr.greeting || 'demo-congrats'})`);
    lines.push(`exten => s,n,WaitExten(${ivr.timeout})`);

    for (const opt of ivr.options || []) {
      const dest = this._buildDest(opt);
      lines.push(`exten => ${opt.digit},1,${dest}`);
    }

    // 无效输入
    lines.push(`exten => i,1,Playback(invalid)`);
    lines.push(`exten => i,n,Goto(s,1)`);
    // 超时
    lines.push(`exten => t,1,${this._buildTimeoutDest(ivr)}`);

    return lines.join('\n');
  }

  _buildDest(opt) {
    if (opt.destinationType === 'extension') return `Dial(SIP/${opt.destinationId})`;
    if (opt.destinationType === 'queue') return `Queue(${opt.destinationId})`;
    if (opt.destinationType === 'ivr') return `Goto(ivr-${opt.destinationId},s,1)`;
    return 'Hangup()';
  }

  _buildTimeoutDest(ivr) {
    if (ivr.timeoutDestinationType === 'extension') return `Dial(SIP/${ivr.timeoutDestinationId})`;
    if (ivr.timeoutDestinationType === 'queue') return `Queue(${ivr.timeoutDestinationId})`;
    return 'Hangup()';
  }

  async _syncToAsterisk(ivr) {
    try {
      logger.info(`🔄 IVR 配置同步中: ${ivr.name}`);
      await asteriskConfigService.syncAll();
    } catch (err) {
      logger.warn(`IVR 同步失败: ${err.message}`);
    }
  }
}

export default new IvrService();
