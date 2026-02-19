import express from 'express';
import extensionService from '../services/extension-service.js';
import { validateExtension } from '../utils/validators.js';
import authMiddleware from '../middleware/auth.js';
import asteriskConfigService from '../services/asterisk-config-service.js';

const router = express.Router();

// 中间件
router.use(authMiddleware);

// 获取所有分机
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, enabled, status, department } = req.query;
    const filters = {};
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    if (status) filters.status = status;
    if (department) filters.department = department;

    const result = await extensionService.getExtensions(
      filters,
      parseInt(limit),
      parseInt(offset)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建分机
router.post('/', async (req, res) => {
  try {
    const { error, value } = validateExtension(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const extension = await extensionService.createExtension(value);
    res.status(201).json(extension);
    asteriskConfigService.syncAll().catch(() => {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取分机详情
router.get('/:id', async (req, res) => {
  try {
    const extension = await extensionService.getExtensionDetail(req.params.id);
    res.json(extension);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 更新分机
router.put('/:id', async (req, res) => {
  try {
    const extension = await extensionService.updateExtension(req.params.id, req.body);
    res.json(extension);
    asteriskConfigService.syncAll().catch(() => {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除分机
router.delete('/:id', async (req, res) => {
  try {
    const extension = await extensionService.deleteExtension(req.params.id);
    res.json({ message: 'Extension deleted successfully', extension });
    asteriskConfigService.syncAll().catch(() => {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取分机状态
router.get('/:id/status', async (req, res) => {
  try {
    const status = await extensionService.getExtensionStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 获取所有分机状态
router.get('/status/all', async (req, res) => {
  try {
    const statuses = await extensionService.getAllExtensionsStatus();
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启用/禁用分机
router.patch('/:id/enabled', async (req, res) => {
  try {
    const { enabled } = req.body;
    const extension = await extensionService.setExtensionEnabled(
      req.params.id,
      enabled
    );
    res.json(extension);
    asteriskConfigService.syncAll().catch(() => {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 设置勿扰
router.patch('/:id/dnd', async (req, res) => {
  try {
    const { dnd } = req.body;
    const extension = await extensionService.setDND(req.params.id, dnd);
    res.json(extension);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 重置分机密码
router.post('/:id/reset-secret', async (req, res) => {
  try {
    const result = await extensionService.resetExtensionSecret(req.params.id);
    res.json(result);
    asteriskConfigService.syncAll().catch(() => {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
