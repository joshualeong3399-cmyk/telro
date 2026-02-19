import { Op } from 'sequelize';
import SmsMessage from '../db/models/sms-message.js';
import SIPTrunk from '../db/models/sip-trunk.js';
import https from 'https';
import http from 'http';
import { URLSearchParams } from 'url';

/**
 * Dispatch an outbound SMS via the trunk's configured HTTP gateway.
 * Supports Twilio-style (Basic Auth + form POST) and Alibaba Cloud-style (JSON POST with key/secret).
 * Falls back to a simulation if no smsApiUrl is configured.
 */
async function dispatchViaTrunk(trunk, { from, to, body }) {
  if (!trunk || !trunk.smsApiUrl) {
    // No gateway configured — log and simulate success
    console.warn(`[SMS] Trunk ${trunk?.name || 'unknown'} has no smsApiUrl. Simulating send.`);
    return { simulated: true };
  }

  const url = new URL(trunk.smsApiUrl);
  const isHttps = url.protocol === 'https:';

  // Detect Twilio by hostname
  const isTwilio = url.hostname.includes('twilio.com');

  return new Promise((resolve, reject) => {
    let postData, headers;

    if (isTwilio) {
      // Twilio: form-encoded body, Basic Auth (AccountSID:AuthToken)
      postData = new URLSearchParams({ From: from, To: to, Body: body }).toString();
      const auth = Buffer.from(`${trunk.smsApiKey}:${trunk.smsApiSecret}`).toString('base64');
      headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(postData),
      };
    } else {
      // Generic JSON gateway (Alibaba Cloud, custom, etc.)
      postData = JSON.stringify({
        PhoneNumbers: to,
        SignName: from,
        TemplateCode: 'SMS_CUSTOM',
        TemplateParam: JSON.stringify({ message: body }),
        AccessKeyId: trunk.smsApiKey,
        AccessKeySecret: trunk.smsApiSecret,
      });
      headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      };
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers,
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`SMS gateway returned HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

class SmsService {
  /**
   * Get messages filtered by direction/status (folder)
   * folder: 'inbox' = inbound+received, 'outbox' = outbound (all), 'sent' = sent/delivered, 'draft' = draft
   */
  async getMessages({ folder = 'inbox', search, limit = 20, offset = 0 } = {}) {
    const where = {};

    switch (folder) {
      case 'inbox':
        where.direction = 'inbound';
        break;
      case 'sent':
        where.direction = 'outbound';
        where.status = { [Op.in]: ['sent', 'delivered'] };
        break;
      case 'draft':
        where.direction = 'outbound';
        where.status = 'draft';
        break;
      case 'outbox':
        where.direction = 'outbound';
        where.status = { [Op.in]: ['sending', 'failed'] };
        break;
      default:
        break;
    }

    if (search) {
      where[Op.or] = [
        { from: { [Op.like]: `%${search}%` } },
        { to: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await SmsMessage.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return { total: count, messages: rows };
  }

  async getMessage(id) {
    const msg = await SmsMessage.findByPk(id);
    if (!msg) throw new Error('短信不存在');
    return msg;
  }

  async createDraft({ from, to, body, sipTrunkId, userId }) {
    return SmsMessage.create({ from, to, body, sipTrunkId, userId, direction: 'outbound', status: 'draft' });
  }

  async sendMessage({ from, to, body, sipTrunkId, userId }) {
    const msg = await SmsMessage.create({
      from, to, body, sipTrunkId, userId,
      direction: 'outbound',
      status: 'sending',
      sentAt: new Date(),
    });

    try {
      // Look up the trunk to get gateway config
      const trunk = sipTrunkId ? await SIPTrunk.findByPk(sipTrunkId) : null;
      await dispatchViaTrunk(trunk, { from, to, body });
      await msg.update({ status: 'sent', sentAt: new Date() });
    } catch (err) {
      await msg.update({ status: 'failed' });
      throw err;
    }

    return msg;
  }

  async sendDraft(id) {
    const msg = await this.getMessage(id);
    if (msg.status !== 'draft') throw new Error('只能发送草稿状态的短信');
    await msg.update({ status: 'sending', sentAt: new Date() });

    try {
      const trunk = msg.sipTrunkId ? await SIPTrunk.findByPk(msg.sipTrunkId) : null;
      await dispatchViaTrunk(trunk, { from: msg.from, to: msg.to, body: msg.body });
      await msg.update({ status: 'sent' });
    } catch (err) {
      await msg.update({ status: 'failed' });
      throw err;
    }

    return msg;
  }

  async markRead(id) {
    const msg = await this.getMessage(id);
    if (!msg.readAt) await msg.update({ readAt: new Date() });
    return msg;
  }

  async deleteMessage(id) {
    const msg = await this.getMessage(id);
    await msg.destroy();
    return { success: true };
  }

  /** Simulate receiving an inbound SMS (called by webhook / AMI event) */
  async receiveMessage({ from, to, body, sipTrunkId, externalId } = {}) {
    return SmsMessage.create({
      from, to, body, sipTrunkId, externalId,
      direction: 'inbound',
      status: 'received',
    });
  }

  async getStats() {
    const [inbox, sent, draft, failed] = await Promise.all([
      SmsMessage.count({ where: { direction: 'inbound' } }),
      SmsMessage.count({ where: { direction: 'outbound', status: { [Op.in]: ['sent', 'delivered'] } } }),
      SmsMessage.count({ where: { status: 'draft' } }),
      SmsMessage.count({ where: { status: 'failed' } }),
    ]);
    return { inbox, sent, draft, failed };
  }
}

export default new SmsService();
