import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../db/models/user.js';
import authMiddleware from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/users  (admin + operator only)
router.get('/', requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { role, search, limit = 50, offset = 0 } = req.query;
    const { Op } = await import('sequelize');
    const where = {};
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { fullName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    // operators can only see their merchants and employees
    if (req.user.role === 'operator') {
      where.merchantId = req.user.id;
    }
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ total: count, users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me
router.get('/me', async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', requireRole('admin', 'operator'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users  — create user (admin/operator)
router.post('/', requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { username, email, password, fullName, role, department, extensionId, merchantId } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱、密码为必填项' });
    }
    // operators can only create merchant/employee
    if (req.user.role === 'operator' && !['merchant', 'employee'].includes(role)) {
      return res.status(403).json({ error: '运营商只能创建商家或员工账号' });
    }
    const hashedPw = await bcrypt.hash(password, 10);
    const user = await User.create({
      username, email, password: hashedPw, fullName, role: role || 'employee',
      department, extensionId, merchantId: merchantId || (req.user.role === 'operator' ? req.user.id : null),
    });
    const { password: _, ...safe } = user.toJSON();
    res.status(201).json(safe);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: '用户名或邮箱已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', requireRole('admin', 'operator'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const { fullName, email, role, department, extensionId, enabled, password } = req.body;
    const updates = { fullName, email, role, department, extensionId, enabled };
    if (password) updates.password = await bcrypt.hash(password, 10);

    await user.update(updates);
    const { password: _, ...safe } = user.toJSON();
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (user.id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
    await user.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/toggle  — enable/disable
router.patch('/:id/toggle', requireRole('admin', 'operator'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    await user.update({ enabled: !user.enabled });
    res.json({ enabled: user.enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
