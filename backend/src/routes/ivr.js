import { Router } from 'express';
import auth from '../middleware/auth.js';
import asteriskConfigService from '../services/asterisk-config-service.js';
import ivrService from '../services/ivr-service.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await ivrService.getIvrs(
      parseInt(req.query.limit) || 100,
      parseInt(req.query.offset) || 0
    );
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const ivr = await ivrService.createIvr(req.body);
    res.json({ success: true, data: ivr });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const ivr = await ivrService.getIvrDetail(req.params.id);
    res.json(ivr);
  } catch (err) { res.status(404).json({ success: false, message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const ivr = await ivrService.updateIvr(req.params.id, req.body);
    res.json({ success: true, data: ivr });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await ivrService.deleteIvr(req.params.id);
    res.json({ success: true });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/enabled', auth, async (req, res) => {
  try {
    const ivr = await ivrService.setEnabled(req.params.id, req.body.enabled);
    res.json({ success: true, data: ivr });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// 获取生成的 Dialplan 脚本（预览用）
router.get('/:id/dialplan', auth, async (req, res) => {
  try {
    const ivr = await ivrService.getIvrDetail(req.params.id);
    const dialplan = ivrService.generateDialplan(ivr);
    res.type('text/plain').send(dialplan);
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
