import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const authMiddleware = (req, res, next) => {
  try {
    // 从请求头获取令牌
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // 解析"Bearer <token>"格式
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const token = parts[1];

    // 验证令牌
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );

    // 将用户信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Authentication failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default authMiddleware;

// Named exports for destructured import in routes
export const auth = authMiddleware;

export const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};
