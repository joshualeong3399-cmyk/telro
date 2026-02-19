import express from 'express';
import multer from 'multer';
import { parse as csvParse } from 'csv-parse/sync';
import queueService from '../services/queue-service.js';
import authMiddleware from '../middleware/auth.js';
import amiClient from '../asterisk/ami-client.js';
import QueueTask from '../db/models/queue-task.js';
import Billing from '../db/models/billing.js';
import logger from '../utils/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

// ── Campaign CRUD ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try { res.status(201).json(await queueService.createQueue(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    res.json(await queueService.getQueues(+limit, +offset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try { res.json(await queueService.updateQueue(req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { res.json(await queueService.deleteQueue(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Contacts ───────────────────────────────────────────────────────────────────
// Add contacts manually (array of {name, phone})
router.post('/:queueId/contacts', async (req, res) => {
  try {
    const { contacts = [], maxAttempts = 3 } = req.body;
    const tasks = await queueService.addContactsToQueue(req.params.queueId, contacts, maxAttempts);
    res.status(201).json({ added: tasks.length, tasks });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// CSV import: POST /queue/:id/contacts/import  (multipart field: file)
router.post('/:queueId/contacts/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
    const maxAttempts = parseInt(req.body.maxAttempts) || 3;
    
    // Parse CSV — supports: name,phone  OR  phone  (one column)
    let records;
    try {
      records = csvParse(req.file.buffer.toString('utf8'), {
        columns: true, skip_empty_lines: true, trim: true, bom: true,
      });
    } catch {
      // Fallback: no header row, treat first col as phone, second as name
      const lines = req.file.buffer.toString('utf8').split(/\r?\n/).filter(l => l.trim());
      records = lines.map(line => {
        const parts = line.split(',');
        return { phone: parts[0]?.trim(), name: parts[1]?.trim() || '' };
      });
    }

    // Normalize field names (case-insensitive)
    const contacts = records
      .map(r => {
        const keys = Object.keys(r);
        const phoneKey = keys.find(k => /phone|number|tel|mobile|手机|电话/i.test(k)) || keys[0];
        const nameKey = keys.find(k => /name|姓名|联系人/i.test(k));
        return {
          phone: r[phoneKey]?.toString().replace(/\s+/g, '') || '',
          name: nameKey ? r[nameKey] : (r.name || ''),
        };
      })
      .filter(c => c.phone && c.phone.length > 4);

    if (contacts.length === 0) {
      return res.status(400).json({ error: 'No valid phone numbers found in CSV' });
    }

    const tasks = await queueService.addContactsToQueue(req.params.queueId, contacts, maxAttempts);
    res.status(201).json({
      message: `成功导入 ${tasks.length} 个联系人`,
      added: tasks.length,
      skipped: contacts.length - tasks.length,
    });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Get tasks/contacts
router.get('/:queueId/tasks', async (req, res) => {
  try {
    const { limit = 100, offset = 0, status } = req.query;
    res.json(await queueService.getQueueTasks(req.params.queueId, { status }, +limit, +offset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete all tasks in a queue (reset contacts)
router.delete('/:queueId/tasks', async (req, res) => {
  try {
    const count = await queueService.clearQueueTasks(req.params.queueId);
    res.json({ deleted: count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Campaign Control ───────────────────────────────────────────────────────────
router.post('/:queueId/start', async (req, res) => {
  try { res.json(await queueService.startQueue(req.params.queueId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:queueId/pause', async (req, res) => {
  try { res.json(await queueService.pauseQueue(req.params.queueId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:queueId/stop', async (req, res) => {
  try { res.json(await queueService.stopQueue(req.params.queueId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:queueId/stats', async (req, res) => {
  try { res.json(await queueService.getQueueStatistics(req.params.queueId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:queueId/retry-failed', async (req, res) => {
  try {
    const count = await queueService.retryFailedTasks(req.params.queueId);
    res.json({ message: `Retrying ${count} failed tasks`, count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:queueId/report', async (req, res) => {
  try { res.json(await queueService.exportQueueReport(req.params.queueId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Answered Call Action: AI or Human ─────────────────────────────────────────
// Called when operator clicks "接入AI" or "转接话务员" on an answered call
router.post('/tasks/:taskId/action', async (req, res) => {
  try {
    const { type, extensionNumber, flowId } = req.body;
    // type: 'human' | 'ai' | 'queue'
    const task = await QueueTask.findByPk(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.channelId) return res.status(400).json({ error: '通话尚未建立频道，请稍候重试' });

    const io = req.app.get('io');

    if (type === 'human') {
      // Direct transfer to a specific extension
      if (!extensionNumber) return res.status(400).json({ error: 'extensionNumber required for human transfer' });
      await amiClient.action({
        Action: 'Redirect',
        Channel: task.channelId,
        Exten: extensionNumber,
        Context: 'campaign-transfer',
        Priority: '1',
      });
      await task.update({ handledBy: 'human', transferredToExtension: extensionNumber, status: 'transferred' });
      if (io) io.emit('campaign:call-transferred', { taskId: task.id, extensionNumber });
      res.json({ success: true, type: 'human', extensionNumber });

    } else if (type === 'queue') {
      // Place customer in queue + notify ALL extensions
      // 1. Redirect the customer channel to the waiting queue context
      const queueName = `campaign-${task.queueId}`;
      await amiClient.action({
        Action: 'Redirect',
        Channel: task.channelId,
        Exten: 's',
        Context: 'campaign-queue-hold',
        Priority: '1',
      }).catch(() => {});

      // 2. Dynamically add all active extensions as queue members via QueueAdd
      const Extension = (await import('../db/models/extension.js')).default;
      const extensions = await Extension.findAll({ where: { enabled: true } });
      for (const ext of extensions) {
        await amiClient.action({
          Action: 'QueueAdd',
          Queue: queueName,
          Interface: `SIP/${ext.number}`,
          MemberName: ext.name || ext.number,
          Paused: 'false',
        }).catch(() => {});
      }

      // 3. Get queue info and customer details
      const callerId = task.targetNumber || 'Unknown';
      const campaignQueue = await (await import('../db/models/call-queue.js')).default.findByPk(task.queueId);

      // 4. Broadcast incoming call notification to ALL connected clients
      const notification = {
        taskId: task.id,
        queueId: task.queueId,
        queueName: campaignQueue?.name || queueName,
        channelId: task.channelId,
        contactNumber: callerId,
        contactName: task.contactName || '',
        outboundCallerId: campaignQueue?.callerId || '',
        timestamp: new Date().toISOString(),
      };
      if (io) {
        io.emit('campaign:queue-incoming', notification);
        logger.info(`Emitted campaign:queue-incoming for task ${task.id}`);
      }

      await task.update({ handledBy: 'queue', status: 'waiting-agent' });
      res.json({ success: true, type: 'queue', notification });

    } else if (type === 'ai') {
      if (!flowId) return res.status(400).json({ error: 'flowId required for AI routing' });
      await amiClient.action({
        Action: 'Redirect',
        Channel: task.channelId,
        Exten: 's',
        Context: `ai-flow-${flowId}`,
        Priority: '1',
      });
      await task.update({ handledBy: 'ai', status: 'ai-handled' });
      if (io) io.emit('campaign:call-ai', { taskId: task.id, flowId });
      res.json({ success: true, type: 'ai', flowId });

    } else {
      res.status(400).json({ error: `Unknown action type: ${type}` });
    }
  } catch (e) {
    logger.error('Campaign task action error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Agent accepts a queued campaign call
// POST /api/campaigns/tasks/:taskId/accept   body: { extensionNumber }
router.post('/tasks/:taskId/accept', async (req, res) => {
  try {
    const { extensionNumber } = req.body;
    if (!extensionNumber) return res.status(400).json({ error: 'extensionNumber required' });
    const task = await QueueTask.findByPk(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Originate a call FROM the extension TO the waiting customer's channel (using bridge)
    // The customer is waiting in campaign-queue-hold context; we redirect their channel to agent
    await amiClient.action({
      Action: 'Redirect',
      Channel: task.channelId,
      Exten: extensionNumber,
      Context: 'campaign-transfer',
      Priority: '1',
    });

    const io = req.app.get('io');
    await task.update({ handledBy: 'human', transferredToExtension: extensionNumber, status: 'transferred' });
    if (io) {
      io.emit('campaign:call-accepted', { taskId: task.id, extensionNumber });
      io.emit('campaign:queue-dismissed', { taskId: task.id }); // dismiss notification from other agents
    }

    // ── 双计费: 创建"坐席接入腿"账单记录 ──
    try {
      const campaignQueue = await (await import('../db/models/call-queue.js')).default.findByPk(task.queueId);
      const ratePerMin = campaignQueue?.agentCostPerMinute ?? 0;
      await Billing.create({
        callRecordId: task.callRecordId || task.id,
        merchantId: campaignQueue?.merchantId ?? null,
        billingType: 'campaign-inbound',
        from: task.targetNumber || 'unknown',
        to: extensionNumber,
        duration: 0,
        ratePerMinute: ratePerMin,
        ratePerSecond: ratePerMin / 60,
        totalCost: 0,
        currency: campaignQueue?.currency || 'CNY',
        billingDate: new Date(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        status: 'pending',
        queueTaskId: task.id,
        leg: 'inbound',
        notes: `坐席接入 - 分机: ${extensionNumber}, 活动: ${campaignQueue?.name || task.queueId}`,
      });
    } catch (be) { logger.warn('Billing inbound record error:', be.message); }

    res.json({ success: true, extensionNumber });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agent rejects (passes) a queued campaign call
router.post('/tasks/:taskId/reject', async (req, res) => {
  try {
    const task = await QueueTask.findByPk(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // Keep waiting, just emit so other agents know this one passed
    const io = req.app.get('io');
    if (io) io.emit('campaign:call-rejected', { taskId: task.id, by: req.body.extensionNumber });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Hangup an active campaign call
router.post('/tasks/:taskId/hangup', async (req, res) => {
  try {
    const task = await QueueTask.findByPk(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.channelId) {
      await amiClient.action({ Action: 'Hangup', Channel: task.channelId }).catch(() => {});
    }
    await task.update({ status: 'cancelled' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
