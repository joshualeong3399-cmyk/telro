import { Router } from 'express';
import auth from '../middleware/auth.js';
import customerService from '../services/customer-service.js';

const router = Router();

// 创建客户
router.post('/', auth, async (req, res) => {
  try {
    const customer = await customerService.createCustomer(req.body);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取客户列表
router.get('/', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const filters = {
      status: req.query.status,
      source: req.query.source,
      tag: req.query.tag,
    };

    const result = await customerService.getCustomers(filters, limit, offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取客户详情
router.get('/:customerId', auth, async (req, res) => {
  try {
    const result = await customerService.getCustomerDetail(req.params.customerId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// 更新客户
router.put('/:customerId', auth, async (req, res) => {
  try {
    const customer = await customerService.updateCustomer(
      req.params.customerId,
      req.body
    );
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 添加标签
router.post('/:customerId/tags', auth, async (req, res) => {
  try {
    const { tag } = req.body;
    const customer = await customerService.addTag(req.params.customerId, tag);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 移除标签
router.delete('/:customerId/tags/:tag', auth, async (req, res) => {
  try {
    const customer = await customerService.removeTag(
      req.params.customerId,
      req.params.tag
    );
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取跟进客户
router.get('/followup/list', auth, async (req, res) => {
  try {
    const customers = await customerService.getFollowupCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取客户统计
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const stats = await customerService.getCustomerStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
