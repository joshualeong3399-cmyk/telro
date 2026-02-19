import VoicemailBox from '../db/models/voicemail-box.js';
import Extension from '../db/models/extension.js';
import logger from '../utils/logger.js';
import asteriskConfigService from './asterisk-config-service.js';
import fs from 'fs';
import path from 'path';

class VoicemailService {
  async createVoicemailBox(data) {
    const ext = await Extension.findByPk(data.extensionId);
    if (!ext) throw new Error(`Extension not found: ${data.extensionId}`);
    const existing = await VoicemailBox.findOne({ where: { extensionId: data.extensionId } });
    if (existing) throw new Error(`Voicemail box already exists for extension ${ext.number}`);
    const mailbox = data.mailbox || `${ext.number}@default`;
    const vmb = await VoicemailBox.create({ ...data, mailbox, email: data.email || ext.email });
    logger.info(`✅ Voicemail box created: ${mailbox}`);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return vmb;
  }

  async updateVoicemailBox(id, data) {
    const vmb = await VoicemailBox.findByPk(id);
    if (!vmb) throw new Error(`Voicemail box not found: ${id}`);
    await vmb.update(data);
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return vmb;
  }

  async deleteVoicemailBox(id) {
    const vmb = await VoicemailBox.findByPk(id);
    if (!vmb) throw new Error(`Voicemail box not found: ${id}`);
    await vmb.destroy();
    asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
    return vmb;
  }

  async getVoicemailBoxes(limit = 100, offset = 0) {
    return VoicemailBox.findAndCountAll({
      limit, offset,
      order: [['mailbox', 'ASC']],
      include: [{ model: Extension, as: 'extension', attributes: ['id', 'number', 'name'] }],
    });
  }

  async getByExtensionId(extensionId) {
    return VoicemailBox.findOne({ where: { extensionId } });
  }

  // List voicemail messages (reads /var/spool/asterisk/voicemail/default/{mailboxNum}/)
  async listMessages(boxId) {
    const vmb = await VoicemailBox.findByPk(boxId);
    if (!vmb) throw new Error(`Voicemail box not found: ${boxId}`);
    const [mailboxNum] = vmb.mailbox.split('@');
    const folders = ['INBOX', 'Old', 'Work', 'Family', 'Friends'];
    const messages = [];
    const basePath = `/var/spool/asterisk/voicemail/default/${mailboxNum}`;
    if (!fs.existsSync(basePath)) return { box: vmb, folders: {}, total: 0 };
    for (const folder of folders) {
      const folderPath = path.join(basePath, folder);
      if (!fs.existsSync(folderPath)) continue;
      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.txt'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
          const meta = {};
          content.split('\n').forEach(line => {
            const [k, v] = line.split('=');
            if (k && v) meta[k.trim()] = v.trim();
          });
          const msgNum = file.replace('.txt', '');
          const wavFile = path.join(folderPath, `${msgNum}.wav`);
          messages.push({
            folder, msgNum, ...meta,
            hasAudio: fs.existsSync(wavFile),
            audioPath: hasAudio ? `/api/voicemail/${boxId}/message/${folder}/${msgNum}/audio` : null,
          });
        } catch { }
      }
    }
    return { box: vmb, messages, total: messages.length };
  }

  // Delete a voicemail message
  async deleteMessage(boxId, folder, msgNum) {
    const vmb = await VoicemailBox.findByPk(boxId);
    if (!vmb) throw new Error(`Voicemail box not found: ${boxId}`);
    const [mailboxNum] = vmb.mailbox.split('@');
    const basePath = `/var/spool/asterisk/voicemail/default/${mailboxNum}/${folder}`;
    ['txt', 'wav', 'WAV', 'gsm'].forEach(ext => {
      const fp = path.join(basePath, `${msgNum}.${ext}`);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    return { deleted: true, folder, msgNum };
  }

  // Generate voicemail.conf content
  generateVoicemailConf(boxes) {
    const lines = [];
    lines.push('[general]');
    lines.push('format = wav49|gsm|wav');
    lines.push('serveremail = asterisk@localhost');
    lines.push('attach = yes');
    lines.push('maxmessage = 180');
    lines.push('minmessage = 3');
    lines.push('maxsilence = 10');
    lines.push('');
    lines.push('[zonemessages]');
    lines.push('china = Asia/Shanghai|\'vm-received\' Q \'digits/at\' IMp');
    lines.push('');
    lines.push('[default]');
    for (const box of boxes) {
      if (!box.enabled) continue;
      const [num] = box.mailbox.split('@');
      const email = box.email ? `,${box.email}` : '';
      const name = box.Extension?.name || num;
      lines.push(`${num} => ${box.password},${name}${email}`);
    }
    return lines.join('\n') + '\n';
  }
}

export default new VoicemailService();
