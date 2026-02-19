import express from 'express';
import auth from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import asteriskConfigService from '../services/asterisk-config-service.js';
import amiClient from '../asterisk/ami-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/asterisk/reconnect
 * 手动触发 AMI 重连（重置计数器）
 */
router.post( '/reconnect', auth, async ( req, res ) => {
    try {
        amiClient.forceReconnect();
        res.json( { success: true, message: '正在重连 Asterisk AMI...' } );
    } catch ( err ) {
        res.status( 500 ).json( { success: false, message: err.message } );
    }
} );

/**
 * GET /api/asterisk/status
 * 返回 AMI 连接状态
 */
router.get('/status', auth, async (req, res) => {
  try {
    let asteriskVersion = null;
    if (amiClient.isConnected) {
      try {
        const result = await amiClient.action({ Action: 'Command', Command: 'core show version' });
        asteriskVersion = result?.Output || result?.output || '已连接';
      } catch { asteriskVersion = '已连接（无法获取版本）'; }
    }
    res.json({
      connected: amiClient.isConnected,
      asteriskVersion,
      reconnectAttempts: amiClient.reconnectAttempts,
        host: `${ process.env.ASTERISK_HOST || 'localhost' }:${ process.env.ASTERISK_PORT || 5038 }`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/asterisk/sync
 * 手动全量同步：生成配置文件 + AMI Reload
 */
router.post('/sync', auth, requireAdmin, async (req, res) => {
  try {
    logger.info(`🔧 手动触发 Asterisk 配置同步 by ${req.user?.username}`);
    const result = await asteriskConfigService.syncAll();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Manual sync failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/asterisk/setup-includes
 * 在 Asterisk 主配置文件中自动添加 #include 指令（首次部署时使用）
 */
router.post('/setup-includes', auth, requireAdmin, async (req, res) => {
  try {
    await asteriskConfigService.setupIncludes();
    res.json({ success: true, message: '#include 指令已添加到主配置文件' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/asterisk/preview
 * 预览将要生成的配置文件内容（不写入磁盘，不 reload）
 */
router.get('/preview', auth, requireAdmin, async (req, res) => {
  try {
    const configs = await asteriskConfigService.previewAll();
    res.json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/asterisk/reload/:module
 * 重载指定 Asterisk 模块
 * module: sip | dialplan | queues | all
 */
router.post('/reload/:module', auth, requireAdmin, async (req, res) => {
  const moduleMap = {
    sip:      'chan_sip.so',
    dialplan: 'pbx_config.so',
    queues:   'app_queue.so',
    all:      'all',
  };
  const moduleName = moduleMap[req.params.module];
  if (!moduleName) {
    return res.status(400).json({ message: '未知模块，可选: sip | dialplan | queues | all' });
  }
  try {
    const result = await asteriskConfigService.reloadModule(moduleName);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
