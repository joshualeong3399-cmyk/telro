import { Router } from 'express';
import auth from '../middleware/auth.js';
import agentService from '../services/agent-service.js';

const router = Router();

// 坐席登入
router.post('/login', auth, async (req, res) => {
  try {
    const { extensionId } = req.body;
    const userId = req.user.id;

    const agent = await agentService.agentLogin(extensionId, userId);
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 坐席登出
router.post('/logout', auth, async (req, res) => {
  try {
    const { extensionId } = req.body;
    const agent = await agentService.agentLogout(extensionId);
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取坐席列表
router.get('/', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const result = await agentService.getAgents(limit, offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取坐席详情
router.get('/:agentId', auth, async (req, res) => {
  try {
    const result = await agentService.getAgentDetail(req.params.agentId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// 更新坐席信息
router.put('/:agentId', auth, async (req, res) => {
  try {
    const agent = await agentService.updateAgent(req.params.agentId, req.body);
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 添加技能
router.post('/:agentId/skills', auth, async (req, res) => {
  try {
    const { skillName } = req.body;
    const agent = await agentService.addSkill(req.params.agentId, skillName);
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 移除技能
router.delete('/:agentId/skills/:skillName', auth, async (req, res) => {
  try {
    const agent = await agentService.removeSkill(
      req.params.agentId,
      req.params.skillName
    );
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取坐席统计
router.get('/:agentId/stats', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const result = await agentService.getAgentStats(req.params.agentId, days);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取团队统计
router.get('/team/daily-stats', auth, async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const result = await agentService.getTeamStats(date);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
