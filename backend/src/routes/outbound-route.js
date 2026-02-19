import { Router } from 'express';
import auth from '../middleware/auth.js';
import asteriskConfigService from '../services/asterisk-config-service.js';
import outboundRouteService from '../services/outbound-route-service.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await outboundRouteService.getRoutes(
      parseInt(req.query.limit) || 100,
      parseInt(req.query.offset) || 0
    );
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const route = await outboundRouteService.createRoute(req.body);
    res.json({ success: true, data: route });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const route = await outboundRouteService.getRouteDetail(req.params.id);
    res.json(route);
  } catch (err) { res.status(404).json({ success: false, message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const route = await outboundRouteService.updateRoute(req.params.id, req.body);
    res.json({ success: true, data: route });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await outboundRouteService.deleteRoute(req.params.id);
    res.json({ success: true });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.patch('/:id/enabled', auth, async (req, res) => {
  try {
    const route = await outboundRouteService.setEnabled(req.params.id, req.body.enabled);
    res.json({ success: true, data: route });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// 测试拨号规则匹配
router.post('/match', auth, async (req, res) => {
  try {
    const { dialNumber } = req.body;
    const result = await outboundRouteService.matchRoute(dialNumber);
    res.json({ success: true, data: result });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
