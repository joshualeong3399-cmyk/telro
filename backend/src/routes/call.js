import express from 'express';
import callService from '../services/call-service.js';
import { validateDialRequest } from '../utils/validators.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// 中间件
router.use(authMiddleware);

// 发起呼叫
router.post('/dial', async (req, res) => {
  try {
    const { error, value } = validateDialRequest(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const callRecord = await callService.dialCall(
      value.from,
      value.to,
      value.callType
    );
    res.status(201).json(callRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取通话记录列表
router.get('/', async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      from,
      to,
      type,
      status,
      startDate,
      endDate,
    } = req.query;

    const filters = { from, to, type, status, startDate, endDate };

    const result = await callService.getCallRecords(
      filters,
      parseInt(limit),
      parseInt(offset)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取活跃通话
router.get('/active/list', async (req, res) => {
  try {
    const calls = await callService.getActiveCalls();
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 转接通话
router.post('/:callId/transfer', async (req, res) => {
  try {
    const { target } = req.body;
    if (!target) {
      return res.status(400).json({ error: 'Target extension is required' });
    }

    const result = await callService.transferCall(req.params.callId, target);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 挂断通话
router.post('/:callId/hangup', async (req, res) => {
  try {
    const callRecord = await callService.hangupCall(req.params.callId);
    res.json(callRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 监听通话
router.post('/:callId/monitor', async (req, res) => {
  try {
    const result = await callService.monitorCall(req.params.callId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取月度统计
router.get('/stats/monthly', async (req, res) => {
  try {
    const { month, year } = req.query;
    const stats = await callService.getMonthlyStats(
      parseInt(month),
      parseInt(year)
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取每日通话量统计（Reports 页面用）
router.get('/stats/daily', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { Op, fn, col, literal } = await import('sequelize');
    const CallRecord = (await import('../db/models/call-record.js')).default;
    const rows = await CallRecord.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'totalCalls'],
        [fn('SUM', literal("CASE WHEN status='answered' THEN 1 ELSE 0 END")), 'answeredCalls'],
        [fn('AVG', literal("CASE WHEN status='answered' THEN duration ELSE NULL END")), 'avgTalkTimeSec'],
      ],
      where: {
        createdAt: {
          [Op.between]: [new Date(startDate || Date.now() - 30*86400000), new Date(endDate || Date.now())],
        },
      },
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'ASC']],
      raw: true,
    });
    res.json(rows.map(r => ({
      date: r.date,
      totalCalls: parseInt(r.totalCalls) || 0,
      answeredCalls: parseInt(r.answeredCalls) || 0,
      avgTalkTimeSec: parseFloat(r.avgTalkTimeSec) || 0,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取坐席绩效统计
router.get('/stats/agent-performance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { Op, fn, col, literal } = await import('sequelize');
    const CallRecord = (await import('../db/models/call-record.js')).default;
    const Agent = (await import('../db/models/agent.js')).default;
    const rows = await CallRecord.findAll({
      attributes: [
        'agentId',
        [fn('COUNT', col('CallRecord.id')), 'totalCalls'],
        [fn('SUM', literal("CASE WHEN CallRecord.status='answered' THEN 1 ELSE 0 END")), 'answeredCalls'],
        [fn('AVG', literal("CASE WHEN CallRecord.status='answered' THEN CallRecord.duration ELSE NULL END")), 'avgTalkTimeSec'],
      ],
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'], required: false }],
      where: {
        agentId: { [Op.ne]: null },
        createdAt: {
          [Op.between]: [new Date(startDate || Date.now() - 30*86400000), new Date(endDate || Date.now())],
        },
      },
      group: ['agentId', 'agent.id'],
      raw: true,
      nest: true,
    });
    res.json(rows.map(r => ({
      agentId: r.agentId,
      agentName: r['agent.name'] || r.agentId,
      totalCalls: parseInt(r.totalCalls) || 0,
      answeredCalls: parseInt(r.answeredCalls) || 0,
      avgTalkTimeSec: parseFloat(r.avgTalkTimeSec) || 0,
      conversionRate: r.totalCalls > 0 ? (parseInt(r.answeredCalls) / parseInt(r.totalCalls)) * 100 : 0,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CSV 导出通话记录
router.get('/export/csv', async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const { Op } = await import('sequelize');
    const CallRecord = (await import('../db/models/call-record.js')).default;
    const where = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    const records = await CallRecord.findAll({ where, order: [['createdAt', 'DESC']], limit: 10000, raw: true });
    const header = 'ID,来电号码,去电号码,类型,状态,时长(秒),费用,时间\n';
    const rows = records.map(r =>
      [r.id, r.from || '', r.to || '', r.callType || '', r.status || '', r.duration || 0, r.cost || 0, r.createdAt].join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="calls-${Date.now()}.csv"`);
    res.send('\uFEFF' + header + rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取分机通话历史
router.get('/extension/:extensionId', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await callService.getExtensionCallHistory(
      req.params.extensionId,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
