import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Recording from '../db/models/recording.js';
import CallRecord from '../db/models/call-record.js';
import logger from '../utils/logger.js';
import amiClient from '../asterisk/ami-client.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RecordingService {
  constructor() {
    this.recordingPath = process.env.RECORDING_PATH || './recordings';
    this.ensureRecordingDirectory();
  }

  // 确保录音目录存在
  ensureRecordingDirectory() {
    if (!fs.existsSync(this.recordingPath)) {
      fs.mkdirSync(this.recordingPath, { recursive: true });
      logger.info(`📁 Recording directory created: ${this.recordingPath}`);
    }
  }

  // 启动通话录音
  async startRecording(callId, from, to) {
    try {
      const recordingId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${from}-${to}-${timestamp}-${recordingId}`;
      const filePath = path.join(this.recordingPath, filename);

      // 从数据库获取通话信息
      const callRecord = await CallRecord.findOne({
        where: { callId },
      });

      if (!callRecord) {
        throw new Error(`Call record not found: ${callId}`);
      }

      // 创建录音记录
      const recording = await Recording.create({
        callRecordId: callRecord.id,
        filename: filename,
        filePath: filePath,
        format: 'wav',
        status: 'recording',
      });

      // 通过AMI启动MixMonitor
      try {
        await amiClient.startRecording(callId, filePath);
      } catch (err) {
        logger.warn('Failed to start recording via AMI:', err.message);
      }

      logger.info(`🎙️  Recording started: ${filename}`);
      return recording;
    } catch (error) {
      logger.error('Failed to start recording:', error.message);
      throw error;
    }
  }

  // 停止通话录音
  async stopRecording(recordingId) {
    try {
      const recording = await Recording.findByPk(recordingId);
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      // 获取关联的通话记录
      const callRecord = await CallRecord.findByPk(recording.callRecordId);

      // 通过AMI停止录音
      try {
        await amiClient.stopRecording(callRecord.callId);
      } catch (err) {
        logger.warn('Failed to stop recording via AMI:', err.message);
      }

      // 更新录音状态
      const fileStats = fs.statSync(recording.filePath);
      await recording.update({
        status: 'completed',
        size: fileStats.size,
      });

      logger.info(`✅ Recording stopped: ${recording.filename}`);
      return recording;
    } catch (error) {
      logger.error('Failed to stop recording:', error.message);
      throw error;
    }
  }

  // 获取录音列表
  async getRecordings(filters = {}, limit = 20, offset = 0) {
    try {
      const where = {};

      if (filters.status) where.status = filters.status;
      if (filters.archived !== undefined) where.archived = filters.archived;

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.createdAt.$lte = new Date(filters.endDate);
        }
      }

      const recordings = await Recording.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            association: 'callRecord',
            attributes: ['id', 'from', 'to', 'duration', 'startTime'],
          },
        ],
      });

      return recordings;
    } catch (error) {
      logger.error('Failed to get recordings:', error.message);
      throw error;
    }
  }

  // 获取录音详情
  async getRecordingDetail(recordingId) {
    try {
      const recording = await Recording.findByPk(recordingId, {
        include: [
          {
            association: 'callRecord',
            attributes: ['id', 'from', 'to', 'type', 'duration', 'startTime', 'endTime'],
          },
        ],
      });

      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      // 检查文件是否存在
      recording.fileExists = fs.existsSync(recording.filePath);

      return recording;
    } catch (error) {
      logger.error('Failed to get recording detail:', error.message);
      throw error;
    }
  }

  // 获取分机的录音
  async getExtensionRecordings(extensionNumber, limit = 20, offset = 0) {
    try {
      const recordings = await Recording.findAndCountAll({
        where: {},
        limit,
        offset,
        include: [
          {
            association: 'callRecord',
            where: {
              [sequelize.Op.or]: [
                { from: extensionNumber },
                { to: extensionNumber },
              ],
            },
            attributes: ['id', 'from', 'to', 'duration', 'startTime'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      return recordings;
    } catch (error) {
      logger.error('Failed to get extension recordings:', error.message);
      throw error;
    }
  }

  // 下载录音文件
  async getRecordingFile(recordingId) {
    try {
      const recording = await Recording.findByPk(recordingId);
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      if (!fs.existsSync(recording.filePath)) {
        throw new Error(`Recording file not found: ${recording.filePath}`);
      }

      return recording;
    } catch (error) {
      logger.error('Failed to get recording file:', error.message);
      throw error;
    }
  }

  // 删除录音
  async deleteRecording(recordingId, deleteFile = true) {
    try {
      const recording = await Recording.findByPk(recordingId);
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      // 删除物理文件
      if (deleteFile && fs.existsSync(recording.filePath)) {
        fs.unlinkSync(recording.filePath);
        logger.info(`🗑️  Recording file deleted: ${recording.filePath}`);
      }

      // 删除数据库记录
      await recording.destroy();
      logger.info(`🗑️  Recording deleted: ${recordingId}`);

      return recording;
    } catch (error) {
      logger.error('Failed to delete recording:', error.message);
      throw error;
    }
  }

  // 存档录音
  async archiveRecording(recordingId) {
    try {
      const recording = await Recording.findByPk(recordingId);
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      await recording.update({ archived: true });
      logger.info(`📦 Recording archived: ${recordingId}`);

      return recording;
    } catch (error) {
      logger.error('Failed to archive recording:', error.message);
      throw error;
    }
  }

  // 批量删除旧录音
  async deleteOldRecordings(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const recordings = await Recording.findAll({
        where: {
          createdAt: {
            $lt: cutoffDate,
          },
          archived: false,
        },
      });

      for (const recording of recordings) {
        await this.deleteRecording(recording.id, true);
      }

      logger.info(`🗑️  Deleted ${recordings.length} old recordings`);
      return recordings.length;
    } catch (error) {
      logger.error('Failed to delete old recordings:', error.message);
      throw error;
    }
  }

  // 获取录音统计
  async getRecordingStats(startDate, endDate) {
    try {
      const stats = await Recording.findAll({
        where: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalRecordings'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('size')), 'totalSize'],
        ],
        raw: true,
      });

      return stats[0];
    } catch (error) {
      logger.error('Failed to get recording stats:', error.message);
      throw error;
    }
  }
}

export default new RecordingService();
