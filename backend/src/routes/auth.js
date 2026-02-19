import express from 'express';
import authService from '../services/auth-service.js';
import { validateUserLogin } from '../utils/validators.js';

const router = express.Router();

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { error, value } = validateUserLogin(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await authService.login(value.username, value.password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required',
      });
    }

    const user = await authService.register(
      username,
      email,
      password,
      fullName
    );
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 刷新令牌
router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const result = await authService.refreshToken(token);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

export default router;
