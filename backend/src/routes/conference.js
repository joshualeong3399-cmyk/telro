import express from 'express';
import conferenceService from '../services/conference-service.js';
import asteriskConfigService from '../services/asterisk-config-service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    res.json(await conferenceService.getRooms(+limit, +offset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try { res.json(await conferenceService.getRoomDetail(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const room = await conferenceService.createRoom(req.body);
    res.status(201).json(room);
    asteriskConfigService.syncAll().catch(() => {});
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const room = await conferenceService.updateRoom(req.params.id, req.body);
    res.json(room);
    asteriskConfigService.syncAll().catch(() => {});
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await conferenceService.deleteRoom(req.params.id);
    res.json(result);
    asteriskConfigService.syncAll().catch(() => {});
  } catch (e) { res.status(404).json({ error: e.message }); }
});

export default router;
