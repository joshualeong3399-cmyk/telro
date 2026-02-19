import User from '../db/models/user.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

class AuthService {
  // 用户注册
  async register(username, email, password, fullName) {
    try {
      // 检查用户是否已存在
      const existing = await User.findOne({
        where: { username },
      });

      if (existing) {
        throw new Error(`User ${username} already exists`);
      }

      // 检查邮箱是否已使用
      const emailExists = await User.findOne({
        where: { email },
      });

      if (emailExists) {
        throw new Error(`Email ${email} already registered`);
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const user = await User.create({
        username,
        email,
        password: hashedPassword,
        fullName,
        role: 'agent',
        enabled: true,
      });

      logger.info(`✅ User registered: ${username}`);

      // 返回不包含密码的用户信息
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Failed to register user:', error.message);
      throw error;
    }
  }

  // 用户登录
  async login(username, password) {
    try {
      const user = await User.findOne({
        where: { username },
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name', 'status'],
          },
        ],
      });

      if (!user) {
        throw new Error('Invalid username or password');
      }

      if (!user.enabled) {
        throw new Error('User account is disabled');
      }

      // 检查账户是否被锁定
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new Error('User account is locked. Please try again later.');
      }

      // 验证密码
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        // 增加登录失败次数
        await user.update({
          loginAttempts: user.loginAttempts + 1,
        });

        // 如果失败5次，锁定账户1小时
        if (user.loginAttempts >= 5) {
          const lockedUntil = new Date();
          lockedUntil.setHours(lockedUntil.getHours() + 1);
          await user.update({ lockedUntil });
        }

        throw new Error('Invalid username or password');
      }

      // 重置登录失败次数和锁定时间
      await user.update({
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      });

      // 生成JWT令牌
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRE || '24h' }
      );

      logger.info(`✅ User logged in: ${username}`);

      return {
        token,
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      logger.error('Login failed:', error.message);
      throw error;
    }
  }

  // 验证令牌
  verifyToken(token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      );
      return decoded;
    } catch (error) {
      logger.error('Token verification failed:', error.message);
      throw error;
    }
  }

  // 刷新令牌
  async refreshToken(token) {
    try {
      const decoded = this.verifyToken(token);
      const user = await User.findByPk(decoded.id);

      if (!user || !user.enabled) {
        throw new Error('Invalid or disabled user');
      }

      const newToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRE || '24h' }
      );

      return { token: newToken };
    } catch (error) {
      logger.error('Token refresh failed:', error.message);
      throw error;
    }
  }

  // 修改密码
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // 验证旧密码
      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!passwordMatch) {
        throw new Error('Old password is incorrect');
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({ password: hashedPassword });

      logger.info(`✅ Password changed for user: ${user.username}`);
      return { message: 'Password changed successfully' };
    } catch (error) {
      logger.error('Failed to change password:', error.message);
      throw error;
    }
  }

  // 删除用户
  async deleteUser(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.destroy();
      logger.info(`🗑️  User deleted: ${user.username}`);
      return user;
    } catch (error) {
      logger.error('Failed to delete user:', error.message);
      throw error;
    }
  }

  // 获取所有用户
  async getAllUsers(limit = 100, offset = 0) {
    try {
      const users = await User.findAndCountAll({
        limit,
        offset,
        attributes: {
          exclude: ['password'],
        },
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      return users;
    } catch (error) {
      logger.error('Failed to get all users:', error.message);
      throw error;
    }
  }

  // 获取用户详情
  async getUserDetail(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: {
          exclude: ['password'],
        },
        include: [
          {
            association: 'extension',
            attributes: ['id', 'number', 'name', 'status', 'email'],
          },
        ],
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Failed to get user detail:', error.message);
      throw error;
    }
  }

  // 删除密码的用户对象
  sanitizeUser(user) {
    const obj = user.toJSON ? user.toJSON() : user;
    delete obj.password;
    delete obj.loginAttempts;
    delete obj.lockedUntil;
    return obj;
  }
}

export default new AuthService();
