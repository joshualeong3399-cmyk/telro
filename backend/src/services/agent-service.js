import { v4 as uuidv4 } from 'uuid';
import Agent from '../db/models/agent.js';
import AgentStats from '../db/models/agent-stats.js';
import Extension from '../db/models/extension.js';
import User from '../db/models/user.js';
import CallRecord from '../db/models/call-record.js';
import Customer from '../db/models/customer.js';
import logger from '../utils/logger.js';
import moment from 'moment';

class AgentService {
  // 坐席登入
  async agentLogin(extensionId, userId) {
    try {
      const extension = await Extension.findByPk(extensionId);
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      let agent = await Agent.findOne({ where: { extensionId } });
      
      if (!agent) {
        agent = await Agent.create({
          userId,
          extensionId,
          loginTime: new Date(),
          status: 'logged_in',
        });
      } else {
        await agent.update({
          loginTime: new Date(),
          status: 'logged_in',
        });
      }

      // 更新分机状态
      await extension.update({ status: 'online' });

      logger.info(`✅ Agent logged in: Extension ${extension.number}`);
      return agent;
    } catch (error) {
      logger.error('Failed to login agent:', error.message);
      throw error;
    }
  }

  // 坐席登出
  async agentLogout(extensionId) {
    try {
      const agent = await Agent.findOne({ where: { extensionId } });
      if (!agent) {
        throw new Error(`Agent not found for extension: ${extensionId}`);
      }

      const logoutTime = new Date();
      const duration = Math.round(
        (logoutTime - agent.loginTime) / 1000
      );

      await agent.update({
        logoutTime,
        status: 'logged_out',
        totalWorkDuration: agent.totalWorkDuration + duration,
        currentDayDuration: agent.currentDayDuration + duration,
      });

      // 更新分机状态
      const extension = await Extension.findByPk(extensionId);
      if (extension) {
        await extension.update({ status: 'offline' });
      }

      // 记录今天的统计
      await this.recordDailyStats(agent.id);

      logger.info(`📴 Agent logged out: Extension ${extension?.number}`);
      return agent;
    } catch (error) {
      logger.error('Failed to logout agent:', error.message);
      throw error;
    }
  }

  // 获取坐席列表
  async getAgents(limit = 100, offset = 0) {
    try {
      const agents = await Agent.findAndCountAll({
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Extension,
            attributes: ['id', 'number', 'name', 'status'],
          },
          {
            model: User,
            attributes: ['id', 'username', 'email'],
          },
        ],
      });

      return agents;
    } catch (error) {
      logger.error('Failed to get agents:', error.message);
      throw error;
    }
  }

  // 获取坐席详情
  async getAgentDetail(agentId) {
    try {
      const agent = await Agent.findByPk(agentId, {
        include: [
          {
            model: Extension,
            attributes: ['id', 'number', 'name', 'status', 'department'],
          },
          {
            model: User,
            attributes: ['id', 'username', 'email'],
          },
        ],
      });

      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // 获取今天的统计
      const today = moment().startOf('day').toDate();
      const stats = await AgentStats.findOne({
        where: {
          agentId,
          date: {
            $gte: today,
          },
        },
      });

      return { agent, stats };
    } catch (error) {
      logger.error('Failed to get agent detail:', error.message);
      throw error;
    }
  }

  // 更新坐席信息
  async updateAgent(agentId, data) {
    try {
      const agent = await Agent.findByPk(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // 允许更新的字段
      const allowedFields = ['skillTags', 'department', 'managerId', 'notes'];
      const updates = {};
      
      for (const field of allowedFields) {
        if (field in data) {
          updates[field] = data[field];
        }
      }

      await agent.update(updates);
      logger.info(`✏️  Agent updated: ${agentId}`);
      return agent;
    } catch (error) {
      logger.error('Failed to update agent:', error.message);
      throw error;
    }
  }

  // 记录每日统计
  async recordDailyStats(agentId) {
    try {
      const today = moment().startOf('day').toDate();
      
      // 获取今天的通话记录
      const startOfDay = moment().startOf('day').toDate();
      const endOfDay = moment().endOf('day').toDate();

      const agent = await Agent.findByPk(agentId);
      if (!agent) throw new Error('Agent not found');

      // 获取关联的分机
      const extension = await Extension.findByPk(agent.extensionId);
      
      if (!extension) throw new Error('Extension not found');

      // 查询通话记录
      const calls = await CallRecord.findAll({
        where: {
          extensionId: extension.id,
          startTime: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      });

      const totalCalls = calls.length;
      const answeredCalls = calls.filter(c => c.status === 'answered').length;
      const missedCalls = calls.filter(c => c.status === 'failed' || c.status === 'no_answer').length;
      
      const totalTalkTime = calls.reduce((sum, c) => sum + (c.talkTime || 0), 0);
      const avgTalkTime = answeredCalls > 0 ? Math.round(totalTalkTime / answeredCalls) : 0;

      // 更新或创建每日统计
      const [stats, created] = await AgentStats.findOrCreate({
        where: {
          agentId,
          date: today,
        },
        defaults: {
          totalCalls,
          answeredCalls,
          missedCalls,
          avgTalkTime,
          totalTalkTime,
        },
      });

      if (!created) {
        await stats.update({
          totalCalls,
          answeredCalls,
          missedCalls,
          avgTalkTime,
          totalTalkTime,
        });
      }

      logger.info(`📊 Daily stats recorded for agent: ${agentId}`);
      return stats;
    } catch (error) {
      logger.error('Failed to record daily stats:', error.message);
      throw error;
    }
  }

  // 获取坐席统计数据
  async getAgentStats(agentId, days = 7) {
    try {
      const startDate = moment().subtract(days, 'days').startOf('day').toDate();
      const endDate = moment().endOf('day').toDate();

      const stats = await AgentStats.findAll({
        where: {
          agentId,
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
        order: [['date', 'DESC']],
      });

      // 计算汇总数据
      const summary = {
        totalCalls: stats.reduce((sum, s) => sum + s.totalCalls, 0),
        totalAnswered: stats.reduce((sum, s) => sum + s.answeredCalls, 0),
        totalMissed: stats.reduce((sum, s) => sum + s.missedCalls, 0),
        avgTalkTime: stats.length > 0 
          ? Math.round(stats.reduce((sum, s) => sum + s.avgTalkTime, 0) / stats.length)
          : 0,
        conversionRate: stats.length > 0
          ? stats.reduce((sum, s) => sum + s.conversionRate, 0) / stats.length
          : 0,
      };

      return { daily: stats, summary };
    } catch (error) {
      logger.error('Failed to get agent stats:', error.message);
      throw error;
    }
  }

  // 批量获取坐席统计
  async getTeamStats(date = new Date()) {
    try {
      const startDate = moment(date).startOf('day').toDate();
      const endDate = moment(date).endOf('day').toDate();

      const stats = await AgentStats.findAll({
        where: {
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
        include: [
          {
            model: Agent,
            attributes: ['id', 'extensionId'],
            include: [
              {
                model: Extension,
                attributes: ['number', 'name'],
              },
            ],
          },
        ],
        order: [['totalCalls', 'DESC']],
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get team stats:', error.message);
      throw error;
    }
  }

  // 添加坐席技能
  async addSkill(agentId, skillName) {
    try {
      const agent = await Agent.findByPk(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const skills = agent.skillTags || [];
      if (!skills.includes(skillName)) {
        skills.push(skillName);
        await agent.update({ skillTags: skills });
      }

      logger.info(`🏷️  Skill added to agent: ${agentId} - ${skillName}`);
      return agent;
    } catch (error) {
      logger.error('Failed to add skill:', error.message);
      throw error;
    }
  }

  // 移除坐席技能
  async removeSkill(agentId, skillName) {
    try {
      const agent = await Agent.findByPk(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const skills = agent.skillTags || [];
      const index = skills.indexOf(skillName);
      if (index > -1) {
        skills.splice(index, 1);
        await agent.update({ skillTags: skills });
      }

      logger.info(`🗑️  Skill removed from agent: ${agentId} - ${skillName}`);
      return agent;
    } catch (error) {
      logger.error('Failed to remove skill:', error.message);
      throw error;
    }
  }
}

export default new AgentService();
