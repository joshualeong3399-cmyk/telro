import express from 'express';
import smsService from '../services/sms-service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/sms?folder=inbox&search=&limit=20&offset=0
router.get('/', async (req, res) => {
  try {
    const { folder = 'inbox', search, limit = 20, offset = 0 } = req.query;
    const result = await smsService.getMessages({ folder, search, limit, offset });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sms/stats
router.get('/stats', async (req, res) => {
  try {
    res.json(await smsService.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sms/:id
router.get('/:id', async (req, res) => {
  try {
    const msg = await smsService.getMessage(req.params.id);
    await smsService.markRead(req.params.id);
    res.json(msg);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/sms/send  — compose + send immediately
router.post('/send', async (req, res) => {
  try {
    const { from, to, body, sipTrunkId } = req.body;
    if (!from || !to || !body) return res.status(400).json({ error: '缺少必填字段: from, to, body' });
    const msg = await smsService.sendMessage({ from, to, body, sipTrunkId, userId: req.user?.id });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sms/draft  — save as draft
router.post('/draft', async (req, res) => {
  try {
    const { from, to, body, sipTrunkId } = req.body;
    const msg = await smsService.createDraft({ from, to, body, sipTrunkId, userId: req.user?.id });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sms/:id/send  — send existing draft
router.post('/:id/send', async (req, res) => {
  try {
    res.json(await smsService.sendDraft(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/sms/receive  — inbound webhook (called by gateway / AMI)
router.post('/receive', async (req, res) => {
  try {
    const msg = await smsService.receiveMessage(req.body);
    // broadcast to connected clients
    const io = req.app.get('io');
    if (io) io.emit('sms:inbound', msg);
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms/:id
router.delete('/:id', async (req, res) => {
  try {
    res.json(await smsService.deleteMessage(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
