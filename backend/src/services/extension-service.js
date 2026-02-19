import { v4 as uuidv4 } from 'uuid';
import Extension from '../db/models/extension.js';
import logger from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import amiClient from '../asterisk/ami-client.js';
import asteriskConfigService from './asterisk-config-service.js';

class ExtensionService {
  // 创建分机
  async createExtension(data) {
    try {
      // 检查分机号码是否已存在
      const existing = await Extension.findOne({
        where: { number: data.number },
      });
      if (existing) {
        throw new Error(`Extension ${data.number} already exists`);
      }

      // 生成密码
      const secret = data.secret || this.generateSecret();

      const extension = await Extension.create({
        number: data.number,
        name: data.name,
        type: data.type || 'SIP',
        context: data.context || 'from-internal',
        secret,
        callerid: data.callerid || `${data.name} <${data.number}>`,
        host: data.host || 'dynamic',
        email: data.email,
        department: data.department,
        maxCalls: data.maxCalls || 5,
        enabled: true,
      });

      logger.info(`✅ Extension created: ${data.number} (${data.name})`);
      asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
      return extension;
    } catch (error) {
      logger.error('Failed to create extension:', error.message);
      throw error;
    }
  }

  // 更新分机
  async updateExtension(extensionId, data) {
    try {
      const extension = await Extension.findByPk(extensionId);
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      // 如果更新号码，检查是否唯一
      if (data.number && data.number !== extension.number) {
        const existing = await Extension.findOne({
          where: { number: data.number },
        });
        if (existing) {
          throw new Error(`Extension ${data.number} already exists`);
        }
      }

      await extension.update(data);
      logger.info(`✏️  Extension updated: ${extension.number}`);
      asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
      return extension;
    } catch (error) {
      logger.error('Failed to update extension:', error.message);
      throw error;
    }
  }

  // 删除分机
  async deleteExtension(extensionId) {
    try {
      const extension = await Extension.findByPk(extensionId);
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      await extension.destroy();
      logger.info(`🗑️  Extension deleted: ${extension.number}`);
      asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
      return extension;
    } catch (error) {
      logger.error('Failed to delete extension:', error.message);
      throw error;
    }
  }

  // 获取所有分机
  async getExtensions(filters = {}, limit = 100, offset = 0) {
    try {
      const where = {};
      if (filters.enabled !== undefined) where.enabled = filters.enabled;
      if (filters.status) where.status = filters.status;
      if (filters.department) where.department = filters.department;

      const extensions = await Extension.findAndCountAll({
        where,
        limit,
        offset,
        order: [['number', 'ASC']],
      });

      return extensions;
    } catch (error) {
      logger.error('Failed to get extensions:', error.message);
      throw error;
    }
  }

  // 获取分机详情
  async getExtensionDetail(extensionId) {
    try {
      const extension = await Extension.findByPk(extensionId, {
        include: [
          {
            association: 'user',
            attributes: ['id', 'username', 'email', 'fullName', 'role'],
          },
        ],
      });

      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      // 获取Asterisk中的实时状态
      try {
        const asteriskStatus = await amiClient.getExtensionStatus(
          extension.number
        );
        extension.asteriskStatus = asteriskStatus;
      } catch (err) {
        logger.warn(`Could not get Asterisk status for ${extension.number}`);
      }

      return extension;
    } catch (error) {
      logger.error('Failed to get extension detail:', error.message);
      throw error;
    }
  }

  // 按号码获取分机
  async getExtensionByNumber(number) {
    try {
      const extension = await Extension.findOne({
        where: { number },
      });

      if (!extension) {
        throw new Error(`Extension ${number} not found`);
      }

      return extension;
    } catch (error) {
      logger.error('Failed to get extension by number:', error.message);
      throw error;
    }
  }

  // 启用/禁用分机
  async setExtensionEnabled(extensionId, enabled) {
    try {
      const extension = await Extension.findByPk(extensionId);
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      await extension.update({ enabled });

      // 更新Asterisk状态
      try {
        await amiClient.setExtensionState(extension.number, enabled);
      } catch (err) {
        logger.warn(
          `Could not update Asterisk state for ${extension.number}:`,
          err.message
        );
      }

      const action = enabled ? '启用' : '禁用';
      logger.info(`${action} extension: ${extension.number}`);
      return extension;
    } catch (error) {
      logger.error('Failed to set extension enabled status:', error.message);
      throw error;
    }
  }

  // 设置分机勿扰状态
  async setDND(extensionId, dnd) {
    try {
      const extension = await Extension.findByPk(extensionId);
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      await extension.update({ dnd });
      logger.info(`🔕 DND set to ${dnd} for extension: ${extension.number}`);
      return extension;
    } catch (error) {
      logger.error('Failed to set DND:', error.message);
      throw error;
    }
  }

  // 生成分机密码
  generateSecret(length = 12) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  // 重置分机密码
  async resetExtensionSecret(extensionId) {
    try {
      const extension = await Extension.findByPk(extensionId);
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      const newSecret = this.generateSecret();
      await extension.update({ secret: newSecret });

      logger.info(`🔑 Extension password reset: ${extension.number}`);
      return { secret: newSecret };
    } catch (error) {
      logger.error('Failed to reset extension password:', error.message);
      throw error;
    }
  }

  // 获取分机状态
  async getExtensionStatus(extensionId) {
    try {
      const extension = await Extension.findByPk(extensionId);
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      let asteriskStatus = null;
      try {
        asteriskStatus = await amiClient.getExtensionStatus(extension.number);
      } catch (err) {
        logger.warn(`Could not get Asterisk status for ${extension.number}`);
      }

      return {
        id: extension.id,
        number: extension.number,
        name: extension.name,
        status: extension.status,
        dnd: extension.dnd,
        enabled: extension.enabled,
        asteriskStatus: asteriskStatus,
      };
    } catch (error) {
      logger.error('Failed to get extension status:', error.message);
      throw error;
    }
  }

  // 获取所有分机的状态
  async getAllExtensionsStatus() {
    try {
      const extensions = await Extension.findAll({
        where: { enabled: true },
        attributes: ['id', 'number', 'name', 'status', 'dnd'],
      });

      const statuses = await Promise.all(
        extensions.map(async (ext) => {
          try {
            const asteriskStatus = await amiClient.getExtensionStatus(
              ext.number
            );
            return {
              ...ext.toJSON(),
              asteriskStatus,
            };
          } catch (err) {
            return ext.toJSON();
          }
        })
      );

      return statuses;
    } catch (error) {
      logger.error('Failed to get all extensions status:', error.message);
      throw error;
    }
  }
}

export default new ExtensionService();
