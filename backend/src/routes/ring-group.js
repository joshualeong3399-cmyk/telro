import express from 'express';
import ringGroupService from '../services/ring-group-service.js';
import asteriskConfigService from '../services/asterisk-config-service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    res.json(await ringGroupService.getRingGroups(+limit, +offset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try { res.json(await ringGroupService.getRingGroupDetail(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const rg = await ringGroupService.createRingGroup(req.body);
    res.status(201).json(rg);
    asteriskConfigService.syncAll().catch(() => {});
  }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const rg = await ringGroupService.updateRingGroup(req.params.id, req.body);
    res.json(rg);
    asteriskConfigService.syncAll().catch(() => {});
  }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await ringGroupService.deleteRingGroup(req.params.id);
    res.json(result);
    asteriskConfigService.syncAll().catch(() => {});
  }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.patch('/:id/enabled', async (req, res) => {
  try {
    const rg = await ringGroupService.setEnabled(req.params.id, req.body.enabled);
    res.json(rg);
    asteriskConfigService.syncAll().catch(() => {});
  }
  catch (e) { res.status(400).json({ error: e.message }); }
});

export default router;
