import { v4 as uuidv4 } from 'uuid';
import CallQueue from '../db/models/call-queue.js';
import QueueTask from '../db/models/queue-task.js';
import Extension from '../db/models/extension.js';
import SIPTrunk from '../db/models/sip-trunk.js';
import CallRecord from '../db/models/call-record.js';
import Billing from '../db/models/billing.js';
import logger from '../utils/logger.js';
import callService from './call-service.js';
import amiClient from '../asterisk/ami-client.js';
import moment from 'moment';
import { sequelize } from '../db/index.js';
import asteriskConfigService from './asterisk-config-service.js';

// Global io reference — set from index.js via queueService.setIo(io)
let _io = null;

/**
 * Limit-based concurrency helper (replaces p-limit without extra dep).
 * Returns a wrapper that ensures at most `concurrency` promises run simultaneously.
 */
function createConcurrencyLimiter(concurrency) {
  let running = 0;
  const queue = [];

  const next = () => {
    if (running >= concurrency || queue.length === 0) return;
    running++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(() => fn())
      .then(resolve, reject)
      .finally(() => {
        running--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

class QueueService {
  setIo(io) { _io = io; }

  // 创建队列/Campaign
  async createQueue(data) {
    try {
      const extension = await Extension.findByPk(data.extensionId);
      if (!extension) throw new Error(`Extension not found: ${data.extensionId}`);

      const queue = await CallQueue.create({
        name: data.name,
        description: data.description,
        extensionId: data.extensionId,
        strategy: data.strategy || 'ringall',
        maxWaitTime: data.maxWaitTime || 300,
        retryInterval: data.retryInterval || 300,
        wrapupTime: data.wrapupTime || 0,
        maxConcurrentCalls: data.maxConcurrentCalls || 5,
        sipTrunkId: data.sipTrunkId || null,
        callerIdOverride: data.callerIdOverride || null,
        scheduledStartTime: data.scheduledStartTime || null,
        timezone: data.timezone || 'Asia/Shanghai',
        defaultHandling: data.defaultHandling || 'ask',
        aiFlowId: data.aiFlowId || null,
        enabled: true,
      });

      logger.info(`✅ Queue/Campaign created: ${data.name}`);
      asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
      // Schedule auto-start if scheduledStartTime is set
      if (queue.scheduledStartTime) {
        this._scheduleQueueStart(queue);
      }
      return queue;
    } catch (error) {
      logger.error('Failed to create queue:', error.message);
      throw error;
    }
  }

  // 更新队列/Campaign
  async updateQueue(queueId, data) {
    try {
      const queue = await CallQueue.findByPk(queueId);
      if (!queue) throw new Error(`Queue not found: ${queueId}`);
      await queue.update(data);
      logger.info(`✏️  Queue updated: ${queue.name}`);
      asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
      if (data.scheduledStartTime && queue.status === 'scheduled') {
        this._scheduleQueueStart(queue);
      }
      return queue;
    } catch (error) {
      logger.error('Failed to update queue:', error.message);
      throw error;
    }
  }

  // Schedule auto-start via setTimeout
  _scheduleQueueStart(queue) {
    const delay = new Date(queue.scheduledStartTime) - Date.now();
    if (delay <= 0) return; // already past
    logger.info(`⏰ Campaign "${queue.name}" scheduled to start in ${Math.round(delay/1000)}s`);
    setTimeout(async () => {
      try {
        const fresh = await CallQueue.findByPk(queue.id);
        if (fresh && fresh.status === 'scheduled') {
          logger.info(`⏰ Auto-starting scheduled campaign: ${queue.name}`);
          await this.startQueue(queue.id);
        }
      } catch (e) { logger.error('Scheduled campaign start failed:', e.message); }
    }, delay);
  }

  // 删除队列
  async deleteQueue(queueId) {
    try {
      const queue = await CallQueue.findByPk(queueId);
      if (!queue) {
        throw new Error(`Queue not found: ${queueId}`);
      }

      // 删除队列任务
      await QueueTask.destroy({ where: { queueId } });

      await queue.destroy();
      logger.info(`🗑️  Queue deleted: ${queue.name}`);
      asteriskConfigService.syncAll().catch(e => logger.warn('Asterisk sync failed:', e.message));
      return queue;
    } catch (error) {
      logger.error('Failed to delete queue:', error.message);
      throw error;
    }
  }

  // 获取队列列表
  async getQueues(limit = 100, offset = 0) {
    try {
      const queues = await CallQueue.findAndCountAll({
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
      });

      return queues;
    } catch (error) {
      logger.error('Failed to get queues:', error.message);
      throw error;
    }
  }

  // 添加任务到队列（旧接口，仅电话号码）
  async addTasksToQueue(queueId, phoneNumbers, maxAttempts = 3) {
    const contacts = phoneNumbers.map(p => ({ phone: p, name: '' }));
    return this.addContactsToQueue(queueId, contacts, maxAttempts);
  }

  // 添加联系人到队列（新接口，含姓名）
  async addContactsToQueue(queueId, contacts, maxAttempts = 3) {
    try {
      const queue = await CallQueue.findByPk(queueId);
      if (!queue) throw new Error(`Queue not found: ${queueId}`);

      const tasks = [];
      for (const contact of contacts) {
        const phone = (contact.phone || contact.number || '').toString().trim();
        if (!phone) continue;
        const task = await QueueTask.create({
          queueId,
          targetNumber: phone,
          contactName: contact.name || contact.contactName || '',
          status: 'pending',
          maxAttempts,
        });
        tasks.push(task);
      }

      logger.info(`📋 Added ${tasks.length} contacts to campaign: ${queue.name}`);
      return tasks;
    } catch (error) {
      logger.error('Failed to add contacts to queue:', error.message);
      throw error;
    }
  }

  // 清空队列所有任务
  async clearQueueTasks(queueId) {
    const count = await QueueTask.destroy({ where: { queueId, status: ['pending', 'failed', 'cancelled', 'no-answer'] } });
    logger.info(`🗑️  Cleared ${count} tasks from queue ${queueId}`);
    return count;
  }

  // 获取队列的任务
  async getQueueTasks(queueId, filters = {}, limit = 100, offset = 0) {
    try {
      const where = { queueId };
      if (filters.status) where.status = filters.status;

      const tasks = await QueueTask.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'ASC']],
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to get queue tasks:', error.message);
      throw error;
    }
  }

  // 启动队列处理
  async startQueue(queueId) {
    try {
      const queue = await CallQueue.findByPk(queueId, {
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
      });

      if (!queue) {
        throw new Error(`Queue not found: ${queueId}`);
      }

      await queue.update({ status: 'active' });

      // 获取待处理的任务数量
      const pendingCount = await QueueTask.count({
        where: { queueId, status: 'pending' },
      });

      logger.info(
        `🚀 Queue started: ${queue.name}, Processing ${pendingCount} tasks (concurrency: ${queue.maxConcurrentCalls || 5})`
      );

      // 异步并发处理任务
      this.processQueueTasksConcurrent(
        queueId,
        queue.extension.number,
        queue.maxConcurrentCalls || 5
      );

      return queue;
    } catch (error) {
      logger.error('Failed to start queue:', error.message);
      throw error;
    }
  }

  // 暂停队列
  async pauseQueue(queueId) {
    try {
      const queue = await CallQueue.findByPk(queueId);
      if (!queue) {
        throw new Error(`Queue not found: ${queueId}`);
      }

      await queue.update({ status: 'paused' });
      logger.info(`⏸️  Queue paused: ${queue.name}`);
      return queue;
    } catch (error) {
      logger.error('Failed to pause queue:', error.message);
      throw error;
    }
  }

  // 停止队列
  async stopQueue(queueId) {
    try {
      const queue = await CallQueue.findByPk(queueId);
      if (!queue) {
        throw new Error(`Queue not found: ${queueId}`);
      }

      // 取消所有待处理的任务
      await QueueTask.update(
        { status: 'cancelled' },
        { where: { queueId, status: 'pending' } }
      );

      await queue.update({ status: 'inactive' });
      logger.info(`⏹️  Queue stopped: ${queue.name}`);
      return queue;
    } catch (error) {
      logger.error('Failed to stop queue:', error.message);
      throw error;
    }
  }

  // 并发处理队列任务（核心并发拨号逻辑）
  async processQueueTasksConcurrent(queueId, extensionNumber, concurrency = 5) {
    const limit = createConcurrencyLimiter(concurrency);

    try {
      // 加载所有待处理任务（一次性）
      let pendingTasks = await QueueTask.findAll({
        where: { queueId, status: 'pending' },
        order: [['createdAt', 'ASC']],
      });

      if (pendingTasks.length === 0) {
        logger.info(`✅ No pending tasks for queue: ${queueId}`);
        await CallQueue.update({ status: 'completed' }, { where: { id: queueId } });
        return;
      }

      logger.info(
        `📞 Starting concurrent dialing: ${pendingTasks.length} tasks, concurrency=${concurrency}`
      );

      // 并发处理所有任务，最多同时 concurrency 个
      await Promise.all(
        pendingTasks.map((task) =>
          limit(async () => {
            // 检查队列是否仍然活跃
            const queue = await CallQueue.findByPk(queueId, { attributes: ['status', 'retryInterval', 'wrapupTime'] });
            if (!queue || queue.status !== 'active') {
              logger.info(`⏸️  Queue ${queueId} is no longer active, skipping task ${task.id}`);
              return;
            }

            await this._executeTask(task, extensionNumber, queue);
          })
        )
      );

      // 检查是否有重试任务（status=pending 且 nextRetryTime 已过期）
      const retryTasks = await QueueTask.findAll({
        where: { queueId, status: 'pending' },
        order: [['nextRetryTime', 'ASC']],
      });

      if (retryTasks.length > 0) {
        logger.info(`🔄 ${retryTasks.length} tasks queued for retry in queue: ${queueId}`);
        // 调度重试（延迟后再次并发执行）
        const firstRetry = retryTasks[0].nextRetryTime;
        const delay = Math.max(0, new Date(firstRetry) - Date.now());
        setTimeout(() => {
          this.processQueueTasksConcurrent(queueId, extensionNumber, concurrency);
        }, delay);
      } else {
        // 全部完成，更新队列状态
        const queue = await CallQueue.findByPk(queueId);
        if (queue && queue.status === 'active') {
          await queue.update({ status: 'completed' });
          logger.info(`✅ Queue fully completed: ${queueId}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to process queue tasks concurrently: ${error.message}`);
    }
  }

  // 执行单个任务 — 升级版（支持 Trunk 拨出 + Socket.io 实时通知 + AI/人工路由）
  async _executeTask(task, extensionNumber, queue) {
    const actionId = `campaign-${task.id}-${Date.now()}`;
    let resolveCallDone;
    const callDonePromise = new Promise(r => { resolveCallDone = r; });

    try {
      // 原子性标记为 calling
      const [updated] = await QueueTask.update(
        { status: 'calling', attempts: task.attempts + 1, lastAttemptTime: new Date() },
        { where: { id: task.id, status: 'pending' } }
      );
      if (updated === 0) return; // 已被抢占

      const contactDisplay = task.contactName
        ? `${task.contactName} <${task.targetNumber}>`
        : task.targetNumber;
      logger.info(`📞 Campaign dial [${task.id}]: ${contactDisplay}`);

      // 确定拨出 Channel 字符串
      let channelStr;
      let trunk = null;
      if (queue.sipTrunkId) {
        trunk = await SIPTrunk.findByPk(queue.sipTrunkId);
      }
      if (trunk) {
        channelStr = `SIP/${trunk.name}/${task.targetNumber}`;
      } else {
        // 无 trunk，通过分机直接拨出（走 Outbound Route 规则）
        channelStr = `Local/${task.targetNumber}@from-internal`;
      }

      const callerId = queue.callerIdOverride
        ? `"${task.contactName || 'Campaign'}" <${queue.callerIdOverride}>`
        : `"${task.contactName || 'Campaign'}" <${extensionNumber}>`;

      // 监听 AMI originateresponse 获取 channel 信息
      const originateHandler = (event) => {
        if (event.actionid === actionId) {
          const channelId = event.channel || channelStr;
          const uniqueId = event.uniqueid;
          // 存储 channelId 到 task 以便后续 Redirect
          QueueTask.update({ channelId, channelUniqueId: uniqueId }, { where: { id: task.id } })
            .catch(() => {});
          logger.debug(`Campaign call originated: task=${task.id} channel=${channelId}`);
        }
      };

      // 监听 dialend 事件（由 ami-client 透传）
      const dialEndHandler = async (event) => {
        // Match by ActionID or channel
        const taskForEvent = await QueueTask.findByPk(task.id);
        if (!taskForEvent || taskForEvent.channelUniqueId !== event.uniqueid) return;

        const status = (event.dialstatus || '').toUpperCase();
        logger.info(`📊 DialEnd for task ${task.id}: ${status}`);

        if (status === 'ANSWER') {
          await QueueTask.update({ status: 'answered', callResultDetail: 'answered', answeredAt: new Date() }, { where: { id: task.id } });
          // ── 双计费: 创建"拨出腿"账单记录 ──
          try {
            const ratePerMin = queue.costPerMinute ?? 0;
            await Billing.create({
              callRecordId: task.callRecordId || task.id, // fallback to task id
              merchantId: queue.merchantId ?? null,
              billingType: 'campaign-outbound',
              from: queue.callerIdOverride || extensionNumber,
              to: task.targetNumber,
              duration: 0, // will be updated on hangup
              ratePerMinute: ratePerMin,
              ratePerSecond: ratePerMin / 60,
              totalCost: 0,
              currency: queue.currency || 'CNY',
              billingDate: new Date(),
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
              status: 'pending',
              queueTaskId: task.id,
              leg: 'outbound',
              notes: `群呼拨出 - 活动: ${queue.name}`,
            });
          } catch (be) { logger.warn('Billing outbound record error:', be.message); }

          // Emit to frontend — operators see this and can choose AI or Human
          if (_io) {
            _io.emit('campaign:call-answered', {
              taskId: task.id,
              queueId: queue.id,
              queueName: queue.name,
              contactName: task.contactName || '',
              contactNumber: task.targetNumber,
              channelId: taskForEvent.channelId,
              defaultHandling: queue.defaultHandling,
              aiFlowId: queue.aiFlowId,
              timestamp: new Date().toISOString(),
            });
          }
          // If auto-AI: immediately redirect to AI flow
          if (queue.defaultHandling === 'ai' && queue.aiFlowId && taskForEvent.channelId) {
            try {
              await amiClient.action({
                Action: 'Redirect', Channel: taskForEvent.channelId,
                Exten: 's', Context: `ai-flow-${queue.aiFlowId}`, Priority: '1',
              });
              await QueueTask.update({ handledBy: 'ai', status: 'ai-handled' }, { where: { id: task.id } });
            } catch (e) { logger.warn('AI auto-redirect failed:', e.message); }
          }
        } else if (status === 'BUSY') {
          await QueueTask.update({ callResultDetail: 'busy' }, { where: { id: task.id } });
        } else if (status === 'NOANSWER' || status === 'NO ANSWER') {
          await QueueTask.update({ callResultDetail: 'no_answer' }, { where: { id: task.id } });
        } else if (status === 'CONGESTION') {
          await QueueTask.update({ callResultDetail: 'congestion' }, { where: { id: task.id } });
        } else {
          await QueueTask.update({ callResultDetail: status.toLowerCase() }, { where: { id: task.id } });
        }
      };

      // Hangup event — resolve the call done promise
      const hangupHandler = async (event) => {
        const taskForEvent = await QueueTask.findByPk(task.id);
        if (!taskForEvent || taskForEvent.channelUniqueId !== event.uniqueid) return;
        logger.info(`📴 Campaign call ended: task=${task.id}`);
        // Emit hangup to frontend so answered-call card disappears
        if (_io) _io.emit('campaign:call-ended', { taskId: task.id, queueId: queue.id });
        resolveCallDone();
      };

      // Register temporary event listeners on the raw ami emitter
      if (amiClient.ami) {
        amiClient.ami.on('originateresponse', originateHandler);
        amiClient.ami.on('dialend', dialEndHandler);
        amiClient.ami.on('hangup', hangupHandler);
      }

      // Fire originate
      try {
        await amiClient.action({
          Action: 'Originate',
          Channel: channelStr,
          Context: queue.dtmfConnectKey ? `campaign-dtmf-${queue.id}` : 'campaign-hold',
          Exten: 's',
          Priority: '1',
          CallerID: callerId,
          Variable: `CAMPAIGN_TASK_ID=${task.id}`,
          ActionID: actionId,
          Async: 'yes',
          Timeout: String((queue.maxWaitTime || 30) * 1000),
        });
      } catch (err) {
        logger.warn(`AMI Originate failed for task ${task.id}: ${err.message}`);
        // Create basic call record without AMI
        try {
          await callService.createCallRecord(extensionNumber, task.targetNumber, 'outbound');
        } catch {}
      }

      // Wait for call to complete (max 5 minutes)
      const MAX_WAIT = (queue.maxWaitTime || 60) * 1000 + 60000;
      await Promise.race([
        callDonePromise,
        new Promise(r => setTimeout(r, MAX_WAIT)),
      ]);

      // Cleanup listeners
      if (amiClient.ami) {
        amiClient.ami.removeListener('originateresponse', originateHandler);
        amiClient.ami.removeListener('dialend', dialEndHandler);
        amiClient.ami.removeListener('hangup', hangupHandler);
      }

      // Determine final task status
      const finalTask = await QueueTask.findByPk(task.id);
      if (!finalTask) return;

      const answered = finalTask.status === 'answered' || finalTask.status === 'transferred' || finalTask.status === 'ai-handled';
      const isHandled = ['answered', 'transferred', 'ai-handled'].includes(finalTask.status);

      if (!isHandled) {
        const result = finalTask.callResultDetail || 'no_answer';
        if (finalTask.attempts < finalTask.maxAttempts) {
          const nextRetryTime = moment().add(queue.retryInterval, 'seconds').toDate();
          await finalTask.update({ status: 'pending', nextRetryTime, result });
          logger.info(`🔄 Retry scheduled: ${task.targetNumber} (${result})`);
        } else {
          await finalTask.update({ status: 'failed', result: `max_attempts: ${result}` });
          logger.info(`❌ Max attempts reached: ${task.targetNumber}`);
        }
      }

    } catch (err) {
      logger.error(`Task execution error [${task.targetNumber}]: ${err.message}`);
      if (resolveCallDone) resolveCallDone();
      const reloaded = await QueueTask.findByPk(task.id).catch(() => null);
      if (reloaded && reloaded.attempts < reloaded.maxAttempts) {
        const nextRetryTime = moment().add(queue.retryInterval, 'seconds').toDate();
        await reloaded.update({ status: 'pending', nextRetryTime, result: err.message }).catch(() => {});
      } else if (reloaded) {
        await reloaded.update({ status: 'failed', result: err.message }).catch(() => {});
      }
    }

    // 话后等待时间
    if (queue.wrapupTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, queue.wrapupTime * 1000));
    }
  }

  // 保留旧方法名供向后兼容（内部调用新方法）
  async processQueueTasks(queueId, extensionNumber) {
    return this.processQueueTasksConcurrent(queueId, extensionNumber, 5);
  }

  // 获取队列统计
  async getQueueStatistics(queueId) {
    try {
      const queue = await CallQueue.findByPk(queueId);
      if (!queue) {
        throw new Error(`Queue not found: ${queueId}`);
      }

      const tasks = await QueueTask.findAll({
        where: { queueId },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['status'],
        raw: true,
      });

      const stats = {
        queueId,
        queueName: queue.name,
        totalTasks: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        calling: 0,
        answered: 0,
        cancelled: 0,
      };

      for (const task of tasks) {
        stats.totalTasks += task.count;
        stats[task.status] = task.count;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get queue statistics:', error.message);
      throw error;
    }
  }

  // 重试失败的任务
  async retryFailedTasks(queueId) {
    try {
      const result = await QueueTask.update(
        { status: 'pending', attempts: 0 },
        { where: { queueId, status: 'failed' } }
      );

      logger.info(`🔄 Retrying ${result[0]} failed tasks`);
      return result[0];
    } catch (error) {
      logger.error('Failed to retry failed tasks:', error.message);
      throw error;
    }
  }

  // 导出队列报告
  async exportQueueReport(queueId) {
    try {
      const queue = await CallQueue.findByPk(queueId);
      if (!queue) {
        throw new Error(`Queue not found: ${queueId}`);
      }

      const tasks = await QueueTask.findAll({
        where: { queueId },
        include: [
          {
            association: 'callRecord',
            attributes: ['id', 'from', 'to', 'duration', 'startTime'],
          },
        ],
      });

      const report = {
        queueId,
        queueName: queue.name,
        generatedAt: new Date(),
        totalTasks: tasks.length,
        tasks: tasks.map((t) => ({
          targetNumber: t.targetNumber,
          status: t.status,
          attempts: t.attempts,
          maxAttempts: t.maxAttempts,
          callRecord: t.callRecord,
        })),
      };

      return report;
    } catch (error) {
      logger.error('Failed to export queue report:', error.message);
      throw error;
    }
  }
}

export default new QueueService();
