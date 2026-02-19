import { Router } from 'express';
import auth from '../middleware/auth.js';
import timeConditionService from '../services/time-condition-service.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await timeConditionService.getConditions(
      parseInt(req.query.limit) || 100,
      parseInt(req.query.offset) || 0
    );
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const tc = await timeConditionService.createCondition(req.body);
    res.json({ success: true, data: tc });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const tc = await timeConditionService.getConditionDetail(req.params.id);
    res.json(tc);
  } catch (err) { res.status(404).json({ success: false, message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const tc = await timeConditionService.updateCondition(req.params.id, req.body);
    res.json({ success: true, data: tc });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await timeConditionService.deleteCondition(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// 手动强制开/关/自动
router.patch('/:id/force-mode', auth, async (req, res) => {
  try {
    const tc = await timeConditionService.setForceMode(req.params.id, req.body.forceMode);
    res.json({ success: true, data: tc });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// 检查当前时间是否在范围内
router.get('/:id/check', auth, async (req, res) => {
  try {
    const tc = await timeConditionService.getConditionDetail(req.params.id);
    const result = timeConditionService.resolveDestination(tc);
    res.json({ success: true, data: result });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
