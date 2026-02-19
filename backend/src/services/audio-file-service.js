import AudioFile from '../db/models/audio-file.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const SOUNDS_DIR = process.env.ASTERISK_SOUNDS_PATH || '/var/lib/asterisk/sounds/custom';
const UPLOAD_DIR = process.env.AUDIO_UPLOAD_PATH || './uploads/audio';

class AudioFileService {
  constructor() {
    this._ensureDirs();
  }

  _ensureDirs() {
    [UPLOAD_DIR].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  }

  async saveUploadedFile(file, meta) {
    const ext = path.extname(file.originalname).toLowerCase() || '.wav';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    const destPath = path.join(UPLOAD_DIR, safeName);

    // Move from multer temp to our storage
    fs.copyFileSync(file.path, destPath);
    try { fs.unlinkSync(file.path); } catch {}

    // Also copy to Asterisk sounds directory if accessible
    const asteriskRelPath = `custom/${safeName.replace(ext, '')}`;
    let asteriskCopied = false;
    try {
      if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });
      fs.copyFileSync(destPath, path.join(SOUNDS_DIR, safeName));
      asteriskCopied = true;
    } catch (e) {
      logger.warn(`Could not copy to Asterisk sounds dir: ${e.message}`);
    }

    const audioFile = await AudioFile.create({
      name: meta.name || file.originalname,
      description: meta.description,
      filename: safeName,
      filePath: destPath,
      asteriskPath: asteriskCopied ? asteriskRelPath : null,
      size: file.size,
      mimeType: file.mimetype || 'audio/wav',
      category: meta.category || 'other',
      uploadedBy: meta.uploadedBy,
    });

    logger.info(`✅ Audio file saved: ${audioFile.name}`);
    return audioFile;
  }

  async getFiles(filters = {}, limit = 100, offset = 0) {
    const where = {};
    if (filters.category) where.category = filters.category;
    if (filters.enabled !== undefined) where.enabled = filters.enabled;
    return AudioFile.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
  }

  async getFileDetail(id) {
    const f = await AudioFile.findByPk(id);
    if (!f) throw new Error(`Audio file not found: ${id}`);
    return f;
  }

  async updateFile(id, data) {
    const f = await AudioFile.findByPk(id);
    if (!f) throw new Error(`Audio file not found: ${id}`);
    await f.update(data);
    return f;
  }

  async deleteFile(id) {
    const f = await AudioFile.findByPk(id);
    if (!f) throw new Error(`Audio file not found: ${id}`);
    // Remove physical files
    [f.filePath, path.join(SOUNDS_DIR, f.filename)].forEach(fp => {
      try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
    });
    await f.destroy();
    return f;
  }

  // Serve audio file stream
  async getFileStream(id) {
    const f = await AudioFile.findByPk(id);
    if (!f) throw new Error(`Audio file not found: ${id}`);
    if (!fs.existsSync(f.filePath)) throw new Error('File not found on disk');
    return { stream: fs.createReadStream(f.filePath), file: f };
  }
}

export default new AudioFileService();
