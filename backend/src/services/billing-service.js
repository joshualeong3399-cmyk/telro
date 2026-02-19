import Billing from '../db/models/billing.js';
import CallRecord from '../db/models/call-record.js';
import Extension from '../db/models/extension.js';
import logger from '../utils/logger.js';
import moment from 'moment';
import { sequelize } from '../db/index.js';

class BillingService {
  // 获取月度账单
  async getMonthlyBilling(year, month, extensionId = null, merchantId = null) {
    try {
      const where = { year, month };
      if (extensionId) where.extensionId = extensionId;
      if (merchantId) where.merchantId = merchantId;

      const billings = await Billing.findAll({
        where,
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
          {
            association: 'callRecord',
            attributes: ['id', 'from', 'to', 'type', 'duration'],
          },
        ],
        order: [['billingDate', 'DESC']],
      });

      return billings;
    } catch (error) {
      logger.error('Failed to get monthly billing:', error.message);
      throw error;
    }
  }

  // 获取月度账单摘要
  async getMonthlyBillingSummary(year, month, extensionId = null, merchantId = null) {
    try {
      const where = { year, month };
      if (extensionId) where.extensionId = extensionId;
      if (merchantId) where.merchantId = merchantId;

      const summary = await Billing.findAll({
        where,
        attributes: [
          'extensionId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['extensionId'],
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
      });

      return summary;
    } catch (error) {
      logger.error('Failed to get monthly billing summary:', error.message);
      throw error;
    }
  }

  // 获取指定日期范围的账单
  async getBillingByDateRange(startDate, endDate, extensionId = null, merchantId = null) {
    try {
      const { Op } = await import('sequelize');
      const where = {
        billingDate: {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate),
        },
      };
      if (extensionId) where.extensionId = extensionId;
      if (merchantId) where.merchantId = merchantId;

      const billings = await Billing.findAll({
        where,
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
        order: [['billingDate', 'DESC']],
      });

      return billings;
    } catch (error) {
      logger.error('Failed to get billing by date range:', error.message);
      throw error;
    }
  }

  // 计算账单成本
  async calculateBillingCost(billingId) {
    try {
      const billing = await Billing.findByPk(billingId);
      if (!billing) {
        throw new Error(`Billing record not found: ${billingId}`);
      }

      const talkTimeMinutes = billing.duration / 60;
      const totalCost = parseFloat((talkTimeMinutes * billing.ratePerMinute).toFixed(4));

      await billing.update({ totalCost });
      logger.info(`💰 Billing calculated: $${totalCost}`);

      return billing;
    } catch (error) {
      logger.error('Failed to calculate billing cost:', error.message);
      throw error;
    }
  }

  // 生成月度发票
  async generateMonthlyInvoice(year, month, extensionId) {
    try {
      const where = { year, month, extensionId };

      const billings = await Billing.findAll({ where });
      const extension = await Extension.findByPk(extensionId);

      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      if (billings.length === 0) {
        logger.warn(`No billing records found for invoice generation`);
        return null;
      }

      const totalCalls = billings.length;
      const totalDuration = billings.reduce((sum, b) => sum + b.duration, 0);
      const totalCost = billings.reduce((sum, b) => sum + b.totalCost, 0);

      const invoice = {
        invoiceNumber: `INV-${extensionId}-${year}-${month}`,
        extensionId,
        extensionNumber: extension.number,
        extensionName: extension.name,
        year,
        month,
        totalCalls,
        totalDuration,
        totalCost: parseFloat(totalCost.toFixed(4)),
        generatedAt: new Date(),
        billingDetails: billings,
      };

      logger.info(`📄 Monthly invoice generated: ${invoice.invoiceNumber}`);
      return invoice;
    } catch (error) {
      logger.error('Failed to generate monthly invoice:', error.message);
      throw error;
    }
  }

  // 获取分机消费排行
  async getTopExtensionsByUsage(year, month, limit = 10, merchantId = null) {
    try {
      const where = { year, month };
      if (merchantId) where.merchantId = merchantId;

      const stats = await Billing.findAll({
        where,
        attributes: [
          'extensionId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['extensionId'],
        order: [[sequelize.literal('totalCost'), 'DESC']],
        limit,
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get top extensions by usage:', error.message);
      throw error;
    }
  }

  // 获取分机的消费趋势
  async getExtensionCostTrend(extensionId, months = 12) {
    try {
      const { Op } = await import('sequelize');
      const now = moment();
      const startDate = now.clone().subtract(months, 'months');

      const trend = await Billing.findAll({
        where: {
          extensionId,
          billingDate: {
            [Op.gte]: startDate.toDate(),
            [Op.lte]: now.toDate(),
          },
        },
        attributes: [
          'year',
          'month',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['year', 'month'],
        order: [['year', 'DESC'], ['month', 'DESC']],
      });

      return trend;
    } catch (error) {
      logger.error('Failed to get extension cost trend:', error.message);
      throw error;
    }
  }

  // 统计通话类型的成本
  async getCostByCallType(year, month, extensionId = null, merchantId = null) {
    try {
      const where = { year, month };
      if (extensionId) where.extensionId = extensionId;
      if (merchantId) where.merchantId = merchantId;

      const stats = await Billing.findAll({
        where,
        attributes: [
          'billingType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['billingType'],
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get cost by call type:', error.message);
      throw error;
    }
  }

  // 批量更新账单状态
  async updateBillingStatus(billingIds, status) {
    try {
      const { Op } = await import('sequelize');
      const result = await Billing.update(
        { status },
        { where: { id: { [Op.in]: billingIds } } }
      );

      logger.info(`Updated ${result[0]} billing records to status: ${status}`);
      return result[0];
    } catch (error) {
      logger.error('Failed to update billing status:', error.message);
      throw error;
    }
  }

  // 获取待付款账单
  async getPendingBillings(extensionId = null, merchantId = null) {
    try {
      const where = { status: 'pending' };
      if (extensionId) where.extensionId = extensionId;
      if (merchantId) where.merchantId = merchantId;

      const billings = await Billing.findAll({
        where,
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
        order: [['billingDate', 'ASC']],
      });

      return billings;
    } catch (error) {
      logger.error('Failed to get pending billings:', error.message);
      throw error;
    }
  }

  // 清空过期账单
  async clearOldBillings(months = 12) {
    try {
      const { Op } = await import('sequelize');
      const cutoffDate = moment().subtract(months, 'months').toDate();

      const result = await Billing.destroy({
        where: {
          createdAt: { [Op.lt]: cutoffDate },
          status: 'paid',
        },
      });

      logger.info(`Cleared ${result} old billing records`);
      return result;
    } catch (error) {
      logger.error('Failed to clear old billings:', error.message);
      throw error;
    }
  }
}

export default new BillingService();

class BillingService {
  // 获取月度账单
  async getMonthlyBilling(year, month, extensionId = null) {
    try {
      const where = { year, month };
      if (extensionId) where.extensionId = extensionId;

      const billings = await Billing.findAll({
        where,
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
          {
            association: 'callRecord',
            attributes: ['id', 'from', 'to', 'type', 'duration'],
          },
        ],
        order: [['billingDate', 'DESC']],
      });

      return billings;
    } catch (error) {
      logger.error('Failed to get monthly billing:', error.message);
      throw error;
    }
  }

  // 获取月度账单摘要
  async getMonthlyBillingSummary(year, month, extensionId = null) {
    try {
      const where = { year, month };
      if (extensionId) where.extensionId = extensionId;

      const summary = await Billing.findAll({
        where,
        attributes: [
          'extensionId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['extensionId'],
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
      });

      return summary;
    } catch (error) {
      logger.error('Failed to get monthly billing summary:', error.message);
      throw error;
    }
  }

  // 获取指定日期范围的账单
  async getBillingByDateRange(startDate, endDate, extensionId = null) {
    try {
      const where = {
        billingDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
      if (extensionId) where.extensionId = extensionId;

      const billings = await Billing.findAll({
        where,
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
        order: [['billingDate', 'DESC']],
      });

      return billings;
    } catch (error) {
      logger.error('Failed to get billing by date range:', error.message);
      throw error;
    }
  }

  // 计算账单成本
  async calculateBillingCost(billingId) {
    try {
      const billing = await Billing.findByPk(billingId);
      if (!billing) {
        throw new Error(`Billing record not found: ${billingId}`);
      }

      const talkTimeMinutes = billing.duration / 60;
      const totalCost = parseFloat((talkTimeMinutes * billing.ratePerMinute).toFixed(4));

      await billing.update({ totalCost });
      logger.info(`💰 Billing calculated: $${totalCost}`);

      return billing;
    } catch (error) {
      logger.error('Failed to calculate billing cost:', error.message);
      throw error;
    }
  }

  // 生成月度发票
  async generateMonthlyInvoice(year, month, extensionId) {
    try {
      const where = { year, month, extensionId };

      const billings = await Billing.findAll({ where });
      const extension = await Extension.findByPk(extensionId);

      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      if (billings.length === 0) {
        logger.warn(`No billing records found for invoice generation`);
        return null;
      }

      const totalCalls = billings.length;
      const totalDuration = billings.reduce((sum, b) => sum + b.duration, 0);
      const totalCost = billings.reduce((sum, b) => sum + b.totalCost, 0);

      const invoice = {
        invoiceNumber: `INV-${extensionId}-${year}-${month}`,
        extensionId,
        extensionNumber: extension.number,
        extensionName: extension.name,
        year,
        month,
        totalCalls,
        totalDuration,
        totalCost: parseFloat(totalCost.toFixed(4)),
        generatedAt: new Date(),
        billingDetails: billings,
      };

      logger.info(`📄 Monthly invoice generated: ${invoice.invoiceNumber}`);
      return invoice;
    } catch (error) {
      logger.error('Failed to generate monthly invoice:', error.message);
      throw error;
    }
  }

  // 获取分机消费排行
  async getTopExtensionsByUsage(year, month, limit = 10) {
    try {
      const stats = await Billing.findAll({
        where: { year, month },
        attributes: [
          'extensionId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['extensionId'],
        order: [[sequelize.literal('totalCost'), 'DESC']],
        limit,
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get top extensions by usage:', error.message);
      throw error;
    }
  }

  // 获取分机的消费趋势
  async getExtensionCostTrend(extensionId, months = 12) {
    try {
      const now = moment();
      const startDate = now.clone().subtract(months, 'months');

      const trend = await Billing.findAll({
        where: {
          extensionId,
          billingDate: {
            $gte: startDate.toDate(),
            $lte: now.toDate(),
          },
        },
        attributes: [
          'year',
          'month',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['year', 'month'],
        order: [['year', 'DESC'], ['month', 'DESC']],
      });

      return trend;
    } catch (error) {
      logger.error('Failed to get extension cost trend:', error.message);
      throw error;
    }
  }

  // 统计通话类型的成本
  async getCostByCallType(year, month, extensionId = null) {
    try {
      const where = { year, month };
      if (extensionId) where.extensionId = extensionId;

      const stats = await Billing.findAll({
        where,
        attributes: [
          'billingType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
          [sequelize.fn('SUM', sequelize.col('duration')), 'totalDuration'],
          [sequelize.fn('SUM', sequelize.col('totalCost')), 'totalCost'],
        ],
        group: ['billingType'],
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get cost by call type:', error.message);
      throw error;
    }
  }

  // 批量更新账单状态
  async updateBillingStatus(billingIds, status) {
    try {
      const result = await Billing.update(
        { status },
        {
          where: {
            id: billingIds,
          },
        }
      );

      logger.info(`Updated ${result[0]} billing records to status: ${status}`);
      return result[0];
    } catch (error) {
      logger.error('Failed to update billing status:', error.message);
      throw error;
    }
  }

  // 获取待付款账单
  async getPendingBillings(extensionId = null) {
    try {
      const where = { status: 'pending' };
      if (extensionId) where.extensionId = extensionId;

      const billings = await Billing.findAll({
        where,
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
        order: [['billingDate', 'ASC']],
      });

      return billings;
    } catch (error) {
      logger.error('Failed to get pending billings:', error.message);
      throw error;
    }
  }

  // 清空过期账单
  async clearOldBillings(months = 12) {
    try {
      const cutoffDate = moment().subtract(months, 'months').toDate();

      const result = await Billing.destroy({
        where: {
          createdAt: {
            $lt: cutoffDate,
          },
          status: 'paid',
        },
      });

      logger.info(`Cleared ${result} old billing records`);
      return result;
    } catch (error) {
      logger.error('Failed to clear old billings:', error.message);
      throw error;
    }
  }
}

export default new BillingService();
