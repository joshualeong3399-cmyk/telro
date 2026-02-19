import { Router } from 'express';
import auth from '../middleware/auth.js';
import asteriskConfigService from '../services/asterisk-config-service.js';
import sipTrunkService from '../services/sip-trunk-service.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await sipTrunkService.getTrunks(
      parseInt(req.query.limit) || 100,
      parseInt(req.query.offset) || 0
    );
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const trunk = await sipTrunkService.createTrunk(req.body);
    res.json({ success: true, data: trunk });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const trunk = await sipTrunkService.getTrunkDetail(req.params.id);
    res.json(trunk);
  } catch (err) { res.status(404).json({ success: false, message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const trunk = await sipTrunkService.updateTrunk(req.params.id, req.body);
    res.json({ success: true, data: trunk });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await sipTrunkService.deleteTrunk(req.params.id);
    res.json({ success: true });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.post('/:id/test', auth, async (req, res) => {
  try {
    const result = await sipTrunkService.testTrunkConnectivity(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/enabled', auth, async (req, res) => {
  try {
    const trunk = await sipTrunkService.setEnabled(req.params.id, req.body.enabled);
    res.json({ success: true, data: trunk });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
