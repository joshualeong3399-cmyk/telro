import { Router } from 'express';
import auth from '../middleware/auth.js';
import dncService from '../services/dnc-service.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await dncService.getList(
      { reason: req.query.reason, enabled: req.query.enabled === 'true' ? true : undefined },
      parseInt(req.query.limit) || 100,
      parseInt(req.query.offset) || 0
    );
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const dnc = await dncService.addNumber({ ...req.body, addedByUserId: req.user.id });
    res.json({ success: true, data: dnc });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await dncService.removeNumber(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/enabled', auth, async (req, res) => {
  try {
    const dnc = await dncService.setEnabled(req.params.id, req.body.enabled);
    res.json({ success: true, data: dnc });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// 检查某号码是否在黑名单中
router.get('/check/:phoneNumber', auth, async (req, res) => {
  try {
    const blocked = await dncService.isBlocked(req.params.phoneNumber);
    res.json({ success: true, blocked });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// 批量导入
router.post('/import', auth, async (req, res) => {
  try {
    const { numbers, reason } = req.body;
    const result = await dncService.bulkImport(numbers, reason, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
