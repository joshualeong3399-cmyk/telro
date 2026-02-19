import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import Extension from '../db/models/extension.js';
import CallRecord from '../db/models/call-record.js';
import Billing from '../db/models/billing.js';
import logger from '../utils/logger.js';
import amiClient from '../asterisk/ami-client.js';
import moment from 'moment';

class CallService {
  // 创建通话记录
  async createCallRecord(from, to, type, sipTrunkId = null) {
    try {
      const fromExt = await Extension.findOne({ where: { number: from } });
      const toExt = await Extension.findOne({ where: { number: to } });

      const callRecord = await CallRecord.create({
        callId: `CALL-${uuidv4()}`,
        uniqueId: uuidv4(),
        from,
        fromExtensionId: fromExt?.id,
        to,
        toExtensionId: toExt?.id,
        type,
        sipTrunkId,
        startTime: new Date(),
        status: 'failed',
      });

      logger.info(`📞 Call record created: ${from} -> ${to}`);
      return callRecord;
    } catch (error) {
      logger.error('Failed to create call record:', error.message);
      throw error;
    }
  }

  // 更新通话记录
  async updateCallRecord(callId, updates) {
    try {
      const callRecord = await CallRecord.findOne({ where: { callId } });
      if (!callRecord) {
        throw new Error(`Call record not found: ${callId}`);
      }

      // 计算时长
      if (updates.endTime && callRecord.startTime) {
        updates.duration = Math.round(
          (new Date(updates.endTime) - new Date(callRecord.startTime)) / 1000
        );
        if (updates.connectTime) {
          updates.talkTime = Math.round(
            (new Date(updates.endTime) - new Date(updates.connectTime)) / 1000
          );
          updates.ringTime = Math.round(
            (new Date(updates.connectTime) - new Date(callRecord.startTime)) / 1000
          );
        }
      }

      await callRecord.update(updates);
      logger.info(`✅ Call record updated: ${callId}`);
      
      // 如果通话已完成，创建计费记录
      if (updates.status === 'answered' && updates.endTime) {
        await this.createBillingRecord(callRecord);
      }

      return callRecord;
    } catch (error) {
      logger.error('Failed to update call record:', error.message);
      throw error;
    }
  }

  // 发起呼叫
  async dialCall(from, to, callType = 'outbound') {
    try {
      // 创建呼叫记录
      const callRecord = await this.createCallRecord(from, to, callType);

      // 检查分机是否存在
      const fromExt = await Extension.findOne({ where: { number: from } });
      if (!fromExt) {
        throw new Error(`Extension ${from} not found`);
      }

      // 通过AMI发起呼叫
      const result = await amiClient.dial(from, to, 1, 'from-internal');
      
      logger.info(`📞 Dial attempt: ${from} -> ${to}`);
      return callRecord;
    } catch (error) {
      logger.error('Failed to dial:', error.message);
      throw error;
    }
  }

  // 转接通话
  async transferCall(channelId, toExtension) {
    try {
      const result = await amiClient.transferCall(
        channelId,
        toExtension,
        'from-internal',
        1
      );
      
      logger.info(`🔄 Call transferred to extension: ${toExtension}`);
      return result;
    } catch (error) {
      logger.error('Failed to transfer call:', error.message);
      throw error;
    }
  }

  // 挂断通话
  async hangupCall(callId) {
    try {
      const callRecord = await CallRecord.findOne({ where: { callId } });
      if (!callRecord) {
        throw new Error(`Call record not found: ${callId}`);
      }

      // 更新通话记录
      await this.updateCallRecord(callId, {
        endTime: new Date(),
        status: 'failed',
      });

      logger.info(`📞 Call hung up: ${callId}`);
      return callRecord;
    } catch (error) {
      logger.error('Failed to hangup call:', error.message);
      throw error;
    }
  }

  // 获取通话记录
  async getCallRecords(filters = {}, limit = 20, offset = 0) {
    try {
      const where = {};
      
      if (filters.from) where.from = filters.from;
      if (filters.to) where.to = filters.to;
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      
      if (filters.startDate || filters.endDate) {
        const timeRange = {};
        if (filters.startDate) {
          timeRange[Op.gte] = new Date(filters.startDate);
        }
        if (filters.endDate) {
          timeRange[Op.lte] = new Date(filters.endDate);
        }
        where.startTime = timeRange;
      }

      const records = await CallRecord.findAndCountAll({
        where,
        limit,
        offset,
        order: [['startTime', 'DESC']],
        include: [
          {
            association: 'fromExtension',
            attributes: ['id', 'number', 'name'],
          },
          {
            association: 'toExtension',
            attributes: ['id', 'number', 'name'],
          },
          {
            association: 'recording',
            attributes: ['id', 'filename', 'duration'],
          },
        ],
      });

      return records;
    } catch (error) {
      logger.error('Failed to get call records:', error.message);
      throw error;
    }
  }

  // 创建计费记录
  async createBillingRecord(callRecord) {
    try {
      if (callRecord.talkTime <= 0) {
        logger.debug('Skipping billing for call with no talk time');
        return null;
      }

      let ratePerMinute = 0;
      let billingType = 'internal';

      // 确定计费类型和费率
      if (callRecord.type === 'outbound' || callRecord.type === 'inbound') {
        billingType = 'trunk';
        ratePerMinute = 0.05; // 从SIP干线获取
      } else if (callRecord.fromExtensionId) {
        billingType = 'extension';
        ratePerMinute = 0.1; // 从分机配置获取
      }

      const talkTimeMinutes = callRecord.talkTime / 60;
      const totalCost = parseFloat((talkTimeMinutes * ratePerMinute).toFixed(4));

      const billing = await Billing.create({
        extensionId: callRecord.fromExtensionId,
        merchantId: callRecord.fromExtensionId
          ? (await Extension.findByPk(callRecord.fromExtensionId))?.merchantId ?? null
          : null,
        callRecordId: callRecord.id,
        billingType,
        from: callRecord.from,
        to: callRecord.to,
        duration: callRecord.talkTime,
        ratePerMinute,
        ratePerSecond: parseFloat((ratePerMinute / 60).toFixed(6)),
        totalCost,
        billingDate: new Date(),
        month: moment().month() + 1,
        year: moment().year(),
        status: 'pending',
      });

      logger.info(
        `💰 Billing record created: ${callRecord.from} -> ${callRecord.to}, Cost: $${totalCost}`
      );
      return billing;
    } catch (error) {
      logger.error('Failed to create billing record:', error.message);
      throw error;
    }
  }

  // 获取实时通话
  async getActiveCalls() {
    try {
      const calls = await amiClient.getChannels();
      return calls;
    } catch (error) {
      logger.error('Failed to get active calls:', error.message);
      throw error;
    }
  }

  // 监听通话
  async monitorCall(callId) {
    try {
      const callRecord = await CallRecord.findOne({ where: { callId } });
      if (!callRecord) {
        throw new Error(`Call record not found: ${callId}`);
      }

      // 通过AMI启用ChanSpy
      const result = await amiClient.monitorCall(callRecord.callId, true);
      
      logger.info(`👁️  Monitoring started for call: ${callId}`);
      return result;
    } catch (error) {
      logger.error('Failed to monitor call:', error.message);
      throw error;
    }
  }

  // 获取月度通话统计
  async getMonthlyStats(month, year) {
    try {
      const where = {
        month,
        year,
      };

      const stats = await Billing.findAll({
        where,
        attributes: [
          'extensionId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['extensionId'],
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get monthly stats:', error.message);
      throw error;
    }
  }

  // 获取分机通话记录
  async getExtensionCallHistory(extensionId, limit = 20, offset = 0) {
    try {
      const extension = await Extension.findByPk(extensionId);
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      const records = await CallRecord.findAndCountAll({
        where: {
          [sequelize.Op.or]: [
            { fromExtensionId: extensionId },
            { toExtensionId: extensionId },
          ],
        },
        limit,
        offset,
        order: [['startTime', 'DESC']],
      });

      return records;
    } catch (error) {
      logger.error('Failed to get extension call history:', error.message);
      throw error;
    }
  }
}

export default new CallService();
