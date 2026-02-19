import amiClient from '../asterisk/ami-client.js';
import CallRecord from '../db/models/call-record.js';
import Extension from '../db/models/extension.js';
import Billing from '../db/models/billing.js';
import logger from '../utils/logger.js';
import recordingService from '../services/recording-service.js';
import callService from '../services/call-service.js';

class EventHandlers {
  constructor(io) {
    this.io = io;
    this.activeConnections = new Map();
    this.setupAmiListeners();
  }

  setupAmiListeners() {
    // 新通话事件
    amiClient.on('newchannel', (event) => {
      this.handleNewChannel(event);
    });

    // 通话连接事件
    amiClient.on('call-connected', (event) => {
      this.handleCallConnected(event);
    });

    // 通话结束事件
    amiClient.on('hangup', (event) => {
      this.handleHangup(event);
    });

    // 分机注册事件
    amiClient.on('registry', (event) => {
      this.handleRegistry(event);
    });

    // 分机状态变化
    amiClient.on('extensionupdate', (event) => {
      this.handleExtensionUpdate(event);
    });

    // 用户更新事件
    amiClient.on('userupdate', (event) => {
      this.handleUserUpdate(event);
    });

    // 分机在线/离线状态
    amiClient.on('peerstatus', (event) => {
      this.handlePeerStatus(event);
    });

    // 队列事件
    amiClient.on('agentconnect', (event) => {
      this.io.emit('queue:agent-connect', { extension: event.membername, queue: event.queue, uniqueId: event.uniqueid });
    });
    amiClient.on('agentcomplete', (event) => {
      this.io.emit('queue:agent-complete', { extension: event.membername, queue: event.queue, holdTime: event.holdtime, talkTime: event.talktime });
    });

    logger.info('✅ AMI event listeners setup completed');
  }

  // 处理分机在线/离线
  async handlePeerStatus(event) {
    try {
      // event.peer 格式: "SIP/1001"
      const peerName = event.peer?.split('/')[1];
      const status = event.peerstatus; // Registered | Unregistered | Reachable | Unreachable
      const online = ['Registered', 'Reachable'].includes(status);

      if (peerName) {
        // 更新数据库中分机在线状态
        await Extension.update(
          { registered: online },
          { where: { number: peerName } }
        ).catch(() => {}); // ignore if column doesn't exist yet

        this.io.emit('extension:status', {
          extension: peerName,
          status,
          online,
          timestamp: new Date(),
        });
        logger.debug(`PeerStatus: ${peerName} → ${status}`);
      }
    } catch (error) {
      logger.error('Error handling PeerStatus:', error.message);
    }
  }

  // 处理新通话
  async handleNewChannel(event) {
    try {
      logger.debug('New channel:', event);

      // 广播给所有客户端
      this.io.emit('channel:new', {
        timestamp: new Date(),
        channel: event.channel,
        uniqueId: event.uniqueid,
        callerIdNum: event.calleridnum,
        callerIdName: event.calleridname,
      });
    } catch (error) {
      logger.error('Error handling new channel:', error.message);
    }
  }

  // 处理通话连接
  async handleCallConnected(event) {
    try {
      logger.info('Call connected:', event.channel);

      // 更新通话记录为已连接
      const callRecord = await CallRecord.findOne({
        where: { callId: event.channel },
      });

      if (callRecord) {
        await callRecord.update({
          status: 'answered',
          connectTime: new Date(),
        });

        // 启动录音
        try {
          const recording = await recordingService.startRecording(
            event.channel,
            callRecord.from,
            callRecord.to
          );
          await callRecord.update({ recordingId: recording.id });
        } catch (err) {
          logger.warn('Failed to start recording:', err.message);
        }
      }

      // 广播连接事件
      this.io.emit('call:connected', {
        timestamp: new Date(),
        channel: event.channel,
        from: callRecord?.from,
        to: callRecord?.to,
      });
    } catch (error) {
      logger.error('Error handling call connected:', error.message);
    }
  }

  // 处理通话结束
  async handleHangup(event) {
    try {
      logger.info('Hangup:', event.channel);

      // 更新通话记录
      const callRecord = await CallRecord.findOne({
        where: { callId: event.channel },
      });

      if (callRecord) {
        await callRecord.update({
          endTime: new Date(),
          status: 'completed',
          hangupCause: event.cause,
        });

        // 停止录音
        if (callRecord.recordingId) {
          try {
            await recordingService.stopRecording(callRecord.recordingId);
          } catch (err) {
            logger.warn('Failed to stop recording:', err.message);
          }
        }

        // 创建计费记录
        try {
          await callService.createBillingRecord(callRecord);
        } catch (err) {
          logger.warn('Failed to create billing record:', err.message);
        }
      }

      // 广播结束事件
      this.io.emit('call:ended', {
        timestamp: new Date(),
        channel: event.channel,
        cause: event.cause,
        callId: callRecord?.id,
      });
    } catch (error) {
      logger.error('Error handling hangup:', error.message);
    }
  }

  // 处理分机注册
  async handleRegistry(event) {
    try {
      logger.info('Registry event:', event.channel);

      // 更新分机状态
      const extension = await Extension.findOne({
        where: { number: event.channeltype === 'SIP' ? event.channel : null },
      });

      if (extension) {
        const status = event.status === 'Registered' ? 'online' : 'offline';
        await extension.update({ status });

        // 广播分机状态变化
        this.io.emit('extension:status-changed', {
          timestamp: new Date(),
          extensionId: extension.id,
          number: extension.number,
          status: status,
        });
      }
    } catch (error) {
      logger.error('Error handling registry:', error.message);
    }
  }

  // 处理分机状态更新
  async handleExtensionUpdate(event) {
    try {
      logger.debug('Extension update:', event);

      // 广播分机更新
      this.io.emit('extension:updated', {
        timestamp: new Date(),
        event: event,
      });
    } catch (error) {
      logger.error('Error handling extension update:', error.message);
    }
  }

  // 处理用户更新
  async handleUserUpdate(event) {
    try {
      logger.debug('User update:', event);

      // 检查用户状态变化
      const deviceState = event.devicestate;
      const device = event.device;

      // 广播用户更新
      this.io.emit('user:updated', {
        timestamp: new Date(),
        device: device,
        state: deviceState,
      });
    } catch (error) {
      logger.error('Error handling user update:', error.message);
    }
  }

  // 添加连接
  addConnection(socketId, userId, extensionId) {
    this.activeConnections.set(socketId, {
      userId,
      extensionId,
      connectedAt: new Date(),
    });
    logger.info(`User ${userId} connected with socket ${socketId}`);
  }

  // 移除连接
  removeConnection(socketId) {
    const connection = this.activeConnections.get(socketId);
    if (connection) {
      logger.info(
        `User ${connection.userId} disconnected socket ${socketId}`
      );
      this.activeConnections.delete(socketId);
    }
  }

  // 获取活跃连接
  getActiveConnections() {
    return Array.from(this.activeConnections.values());
  }

  // 获取用户连接
  getUserConnections(userId) {
    const connections = [];
    for (const [socketId, connection] of this.activeConnections) {
      if (connection.userId === userId) {
        connections.push({ socketId, ...connection });
      }
    }
    return connections;
  }
}

export default EventHandlers;
