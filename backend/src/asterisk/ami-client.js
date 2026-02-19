import { EventEmitter } from 'events';
import asteriskManager from 'asterisk-manager';
import asteriskConfig from '../config/asterisk.js';
import logger from '../utils/logger.js';

class AsteriskAMIClient extends EventEmitter {
  constructor() {
    super();
    this.ami = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 3000;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      let settled = false; // prevent resolve/reject being called twice

      const settle = ( fn, val ) => {
        if ( settled ) return;
        settled = true;
        fn( val );
      };

      // Set a connection timeout so the promise rejects quickly when host is unreachable
      const timeout = setTimeout( () => {
        settle( reject, new Error( `AMI connection timeout (${ asteriskConfig.host }:${ asteriskConfig.port })` ) );
        this.scheduleReconnect();
      }, 10000 );

      this.ami = new asteriskManager(
        asteriskConfig.port,
        asteriskConfig.host,
        asteriskConfig.username,
        asteriskConfig.secret,
        true
      );

      this.ami.on('connect', () => {
        clearTimeout( timeout );
        logger.info('✅ Connected to Asterisk AMI');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.setupEventHandlers();
        this.emit('connected');
        settle( resolve );
      });

      this.ami.on('error', (err) => {
        clearTimeout( timeout );
        logger.warn( '⚠️  AMI Connection Error:', err.message );
        this.isConnected = false;
        settle( reject, err );
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.ami.on('close', () => {
        logger.warn('⚠️  AMI Connection Closed');
        this.isConnected = false;
        this.emit('disconnected');
        settle( reject, new Error( 'AMI connection closed' ) );
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });
    });
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    logger.info(
      `🔄 Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );
    setTimeout(() => {
      this.connect().catch((err) => {
        logger.error('Reconnection failed:', err.message);
      });
    }, this.reconnectInterval);
  }

  setupEventHandlers() {
    // 新通话事件
    this.ami.on('newchannel', (event) => {
      this.emit('newchannel', event);
    });

    // 通话连接
    this.ami.on('newchannel', (event) => {
      if (event.channelstate === '6') { // UP
        this.emit('call-connected', event);
      }
    });

    // 通话结束
    this.ami.on('hangup', (event) => {
      this.emit('hangup', event);
    });

    // 分机注册
    this.ami.on('registry', (event) => {
      this.emit('registry', event);
    });

    // 分机状态变化
    this.ami.on('extensionupdate', (event) => {
      this.emit('extensionupdate', event);
    });

    // DTMF事件
    this.ami.on('dtmf', (event) => {
      this.emit('dtmf', event);
    });

    // 通话变化
    this.ami.on('varset', (event) => {
      this.emit('varset', event);
    });

    // 通话接听
    this.ami.on('userupdate', (event) => {
      this.emit('userupdate', event);
    });

    // 分机在线/离线状态 (PeerStatus)
    this.ami.on('peerstatus', (event) => {
      this.emit('peerstatus', event);
    });

    // 队列成员状态（坐席接通/挂断）
    this.ami.on('queuememberadded', (event) => this.emit('queuememberadded', event));
    this.ami.on('queuememberremoved', (event) => this.emit('queuememberremoved', event));
    this.ami.on('queuememberstatus', (event) => this.emit('queuememberstatus', event));
    this.ami.on('agentconnect', (event) => this.emit('agentconnect', event));
    this.ami.on('agentcomplete', (event) => this.emit('agentcomplete', event));
  }

  // 获取所有分机状态
  async getExtensions() {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'SIPpeers',
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 获取分机详情
  async getExtensionStatus(extension) {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'SIPshowpeer',
          peer: extension,
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 发起呼叫
  async dial(from, to, priority = 1, context = 'from-internal') {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'Originate',
          channel: `SIP/${from}`,
          context: context,
          exten: to,
          priority: priority,
          callerid: `${from}`,
          timeout: 30000,
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 挂断通话
  async hangup(channel) {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'Hangup',
          channel: channel,
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 接听通话
  async answerCall(channel) {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'Redirect',
          channel: channel,
          exten: '999', // 接听应答上下文
          context: 'from-internal',
          priority: 1,
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 转接通话
  async transferCall(channel, exten, context = 'from-internal', priority = 1) {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'Redirect',
          channel: channel,
          exten: exten,
          context: context,
          priority: priority,
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 启用/禁用分机
  async setExtensionState(extension, enabled) {
    return new Promise((resolve, reject) => {
      const command = enabled ? 'DeviceStateChange' : 'DeviceStateChange';
      this.ami.action(
        {
          action: command,
          device: `SIP/${extension}`,
          state: enabled ? 'INUSE' : 'NOT_INUSE',
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 监听分机
  async monitorCall(channel, spy = true) {
    return new Promise((resolve, reject) => {
      const app = spy ? 'ChanSpy' : 'Mixmonitor';
      this.ami.action(
        {
          action: 'Redirect',
          channel: channel,
          exten: spy ? '8001' : '8002',
          context: 'monitor',
          priority: 1,
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 启用录音
  async startRecording(channel, recordingFile) {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'MixMonitor',
          channel: channel,
          file: recordingFile,
          options: 'b',
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 停止录音
  async stopRecording(channel) {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'StopMixMonitor',
          channel: channel,
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 获取队列
  async getQueues() {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'Queues',
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 获取队列统计
  async getQueueStatistics(queueName) {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'QueueStatus',
          queue: queueName,
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 获取通话状态
  async getChannels() {
    return new Promise((resolve, reject) => {
      this.ami.action(
        {
          action: 'CoreShowChannels',
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });
  }

  // 通用 AMI 指令发送（Promise 包装）
  action(fields) {
    return new Promise((resolve, reject) => {
      if (!this.ami || !this.isConnected) {
        return reject(new Error('AMI not connected'));
      }
      this.ami.action(fields, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }

  // 重载指定 Asterisk 模块
  async reload(module = 'all') {
    const cmd = module === 'all' ? 'core reload' : `module reload ${module}`;
    return this.action({ Action: 'Command', Command: cmd });
  }

  disconnect() {
    if (this.ami) {
      this.ami.disconnect();
      this.isConnected = false;
    }
  }
}

export default new AsteriskAMIClient();
