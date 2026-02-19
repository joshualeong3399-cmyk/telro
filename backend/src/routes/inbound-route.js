import { Router } from 'express';
import auth from '../middleware/auth.js';
import asteriskConfigService from '../services/asterisk-config-service.js';
import inboundRouteService from '../services/inbound-route-service.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await inboundRouteService.getRoutes(
      parseInt(req.query.limit) || 100,
      parseInt(req.query.offset) || 0
    );
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const route = await inboundRouteService.createRoute(req.body);
    res.json({ success: true, data: route });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const route = await inboundRouteService.getRouteDetail(req.params.id);
    res.json(route);
  } catch (err) { res.status(404).json({ success: false, message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const route = await inboundRouteService.updateRoute(req.params.id, req.body);
    res.json({ success: true, data: route });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await inboundRouteService.deleteRoute(req.params.id);
    res.json({ success: true });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/enabled', auth, async (req, res) => {
  try {
    const route = await inboundRouteService.setEnabled(req.params.id, req.body.enabled);
    res.json({ success: true, data: route });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// 测试匹配路由
router.post('/match', auth, async (req, res) => {
  try {
    const { did, callerId } = req.body;
    const route = await inboundRouteService.matchRoute(did, callerId);
    res.json({ success: true, data: route });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
