import { Router } from 'express';
import auth from '../middleware/auth.js';
import dispositionService from '../services/disposition-service.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const list = await dispositionService.getDispositions(req.query.enabledOnly === 'true');
    res.json({ success: true, data: list });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const d = await dispositionService.createDisposition(req.body);
    res.json({ success: true, data: d });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const d = await dispositionService.updateDisposition(req.params.id, req.body);
    res.json({ success: true, data: d });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await dispositionService.deleteDisposition(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// 初始化默认处置码
router.post('/seed', auth, async (req, res) => {
  try {
    await dispositionService.seedDefaults();
    res.json({ success: true, message: 'Default dispositions seeded' });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
