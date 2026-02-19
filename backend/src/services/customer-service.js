import { v4 as uuidv4 } from 'uuid';
import Customer from '../db/models/customer.js';
import CallRecord from '../db/models/call-record.js';
import logger from '../utils/logger.js';
import moment from 'moment';

class CustomerService {
  // 创建客户
  async createCustomer(data) {
    try {
      // 检查是否已存在
      const existing = await Customer.findOne({
        where: { phoneNumber: data.phoneNumber },
      });

      if (existing) {
        return existing;
      }

      const customer = await Customer.create({
        phoneNumber: data.phoneNumber,
        name: data.name || '',
        email: data.email,
        company: data.company,
        industry: data.industry,
        region: data.region,
        tags: data.tags || [],
        source: data.source || 'unknown',
        status: 'new',
      });

      logger.info(`👤 Customer created: ${data.phoneNumber}`);
      return customer;
    } catch (error) {
      logger.error('Failed to create customer:', error.message);
      throw error;
    }
  }

  // 获取客户列表
  async getCustomers(filters = {}, limit = 100, offset = 0) {
    try {
      const where = {};
      
      if (filters.status) where.status = filters.status;
      if (filters.source) where.source = filters.source;
      if (filters.tag) {
        where.tags = {
          $contains: [filters.tag],
        };
      }

      const customers = await Customer.findAndCountAll({
        where,
        limit,
        offset,
        order: [['lastContactAt', 'DESC']],
      });

      return customers;
    } catch (error) {
      logger.error('Failed to get customers:', error.message);
      throw error;
    }
  }

  // 获取客户详情
  async getCustomerDetail(customerId) {
    try {
      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      // 获取关联的通话记录
      const calls = await CallRecord.findAll({
        where: {
          $or: [
            { toNumber: customer.phoneNumber },
            { fromNumber: customer.phoneNumber },
          ],
        },
        order: [['startTime', 'DESC']],
        limit: 20,
      });

      return { customer, recentCalls: calls };
    } catch (error) {
      logger.error('Failed to get customer detail:', error.message);
      throw error;
    }
  }

  // 更新客户信息
  async updateCustomer(customerId, data) {
    try {
      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      const allowedFields = ['name', 'email', 'company', 'industry', 'region', 'tags', 'status', 'notes', 'rating'];
      const updates = {};
      
      for (const field of allowedFields) {
        if (field in data) {
          updates[field] = data[field];
        }
      }

      await customer.update(updates);
      logger.info(`✏️  Customer updated: ${customerId}`);
      return customer;
    } catch (error) {
      logger.error('Failed to update customer:', error.message);
      throw error;
    }
  }

  // 添加客户标签
  async addTag(customerId, tag) {
    try {
      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      const tags = customer.tags || [];
      if (!tags.includes(tag)) {
        tags.push(tag);
        await customer.update({ tags });
      }

      logger.info(`🏷️  Tag added to customer: ${customerId} - ${tag}`);
      return customer;
    } catch (error) {
      logger.error('Failed to add tag:', error.message);
      throw error;
    }
  }

  // 移除客户标签
  async removeTag(customerId, tag) {
    try {
      const customer = await Customer.findByPk(customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      const tags = customer.tags || [];
      const index = tags.indexOf(tag);
      if (index > -1) {
        tags.splice(index, 1);
        await customer.update({ tags });
      }

      logger.info(`🗑️  Tag removed from customer: ${customerId} - ${tag}`);
      return customer;
    } catch (error) {
      logger.error('Failed to remove tag:', error.message);
      throw error;
    }
  }

  // 更新最后联系时间
  async updateLastContact(phoneNumber, notes = '') {
    try {
      let customer = await Customer.findOne({ where: { phoneNumber } });
      
      if (!customer) {
        customer = await this.createCustomer({ phoneNumber });
      }

      await customer.update({
        lastContactAt: new Date(),
        status: 'contacted',
      });

      logger.info(`☎️  Last contact updated: ${phoneNumber}`);
      return customer;
    } catch (error) {
      logger.error('Failed to update last contact:', error.message);
      throw error;
    }
  }

  // 获取跟进客户列表
  async getFollowupCustomers() {
    try {
      const now = new Date();
      const customers = await Customer.findAll({
        where: {
          nextFollowupAt: {
            $lte: now,
          },
          status: ['contacted', 'qualified'],
        },
        order: [['nextFollowupAt', 'ASC']],
        limit: 50,
      });

      return customers;
    } catch (error) {
      logger.error('Failed to get followup customers:', error.message);
      throw error;
    }
  }

  // 统计客户状态
  async getCustomerStats() {
    try {
      const stats = {
        total: await Customer.count(),
        new: await Customer.count({ where: { status: 'new' } }),
        contacted: await Customer.count({ where: { status: 'contacted' } }),
        qualified: await Customer.count({ where: { status: 'qualified' } }),
        converted: await Customer.count({ where: { status: 'converted' } }),
        lost: await Customer.count({ where: { status: 'lost' } }),
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get customer stats:', error.message);
      throw error;
    }
  }
}

export default new CustomerService();
