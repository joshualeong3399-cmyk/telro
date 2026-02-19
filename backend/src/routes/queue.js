import express from 'express';
import queueService from '../services/queue-service.js';
import { validateQueueCreate, validateQueueTasks } from '../utils/validators.js';
import authMiddleware from '../middleware/auth.js';
import asteriskConfigService from '../services/asterisk-config-service.js';

const router = express.Router();

// 中间件
router.use(authMiddleware);

// 创建队列
router.post('/', async (req, res) => {
  try {
    const { error, value } = validateQueueCreate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const queue = await queueService.createQueue(value);
    res.status(201).json(queue);
    asteriskConfigService.syncAll().catch(() => {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取队列列表
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await queueService.getQueues(parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除队列
router.delete('/:id', async (req, res) => {
  try {
    const queue = await queueService.deleteQueue(req.params.id);
    res.json({ message: 'Queue deleted successfully', queue });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加任务到队列
router.post('/:queueId/tasks', async (req, res) => {
  try {
    const { error, value } = validateQueueTasks({
      ...req.body,
      queueId: req.params.queueId,
    });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const tasks = await queueService.addTasksToQueue(
      value.queueId,
      value.phoneNumbers,
      value.maxAttempts
    );
    res.status(201).json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取队列任务
router.get('/:queueId/tasks', async (req, res) => {
  try {
    const { limit = 100, offset = 0, status } = req.query;
    const filters = { status };

    const result = await queueService.getQueueTasks(
      req.params.queueId,
      filters,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启动队列
router.post('/:queueId/start', async (req, res) => {
  try {
    const queue = await queueService.startQueue(req.params.queueId);
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 暂停队列
router.post('/:queueId/pause', async (req, res) => {
  try {
    const queue = await queueService.pauseQueue(req.params.queueId);
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 停止队列
router.post('/:queueId/stop', async (req, res) => {
  try {
    const queue = await queueService.stopQueue(req.params.queueId);
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取队列统计
router.get('/:queueId/stats', async (req, res) => {
  try {
    const stats = await queueService.getQueueStatistics(req.params.queueId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 重试失败的任务
router.post('/:queueId/retry-failed', async (req, res) => {
  try {
    const count = await queueService.retryFailedTasks(req.params.queueId);
    res.json({ message: `Retrying ${count} failed tasks`, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 导出队列报告
router.get('/:queueId/report', async (req, res) => {
  try {
    const report = await queueService.exportQueueReport(req.params.queueId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
