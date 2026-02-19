import axios from 'axios';
import asteriskConfig from '../config/asterisk.js';
import logger from '../utils/logger.js';

class AsteriskARIClient {
  constructor() {
    this.baseURL = asteriskConfig.ari.baseUrl;
    this.auth = {
      username: asteriskConfig.ari.username,
      password: asteriskConfig.ari.password,
    };
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: this.auth,
    });
  }

  // 创建通道
  async createChannel(endpoint, dialplan, callerId) {
    try {
      const response = await this.client.post('/channels', {
        endpoint: endpoint,
        app: dialplan.app,
        appArgs: dialplan.appArgs,
        callerId: callerId,
      });
      logger.debug('Channel created:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to create channel:', error.message);
      throw error;
    }
  }

  // 获取所有活跃通道
  async getChannels() {
    try {
      const response = await this.client.get('/channels');
      return response.data;
    } catch (error) {
      logger.error('Failed to get channels:', error.message);
      throw error;
    }
  }

  // 获取特定通道
  async getChannel(channelId) {
    try {
      const response = await this.client.get(`/channels/${channelId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get channel:', error.message);
      throw error;
    }
  }

  // 接听通话
  async answerChannel(channelId) {
    try {
      const response = await this.client.post(`/channels/${channelId}/answer`);
      logger.info(`Channel ${channelId} answered`);
      return response.data;
    } catch (error) {
      logger.error('Failed to answer channel:', error.message);
      throw error;
    }
  }

  // 挂断通话
  async hangupChannel(channelId, reason = 'normal') {
    try {
      const response = await this.client.delete(`/channels/${channelId}`, {
        params: { reason },
      });
      logger.info(`Channel ${channelId} hung up`);
      return response.data;
    } catch (error) {
      logger.error('Failed to hangup channel:', error.message);
      throw error;
    }
  }

  // 播放声音
  async playSound(channelId, media) {
    try {
      const response = await this.client.post(`/channels/${channelId}/play`, {
        media: media,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to play sound:', error.message);
      throw error;
    }
  }

  // 停止播放声音
  async stopPlayback(channelId, playbackId) {
    try {
      const response = await this.client.delete(
        `/channels/${channelId}/play/${playbackId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to stop playback:', error.message);
      throw error;
    }
  }

  // 开始录音
  async startRecording(channelId, recordingName, format = 'wav') {
    try {
      const response = await this.client.post(
        `/recordings/live`,
        {
          format: format,
          name: recordingName,
        },
        {
          params: {
            channelId: channelId,
          },
        }
      );
      logger.info(`Recording started for channel ${channelId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to start recording:', error.message);
      throw error;
    }
  }

  // 停止录音
  async stopRecording(recordingName) {
    try {
      const response = await this.client.post(
        `/recordings/live/${recordingName}/stop`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to stop recording:', error.message);
      throw error;
    }
  }

  // 获取录音
  async getRecordings() {
    try {
      const response = await this.client.get('/recordings/live');
      return response.data;
    } catch (error) {
      logger.error('Failed to get recordings:', error.message);
      throw error;
    }
  }

  // 播放或转接
  async playOrTransfer(channelId, media, transferContext) {
    try {
      // 先播放信息
      const playResponse = await this.playSound(channelId, media);
      
      // 然后进行转接
      const response = await this.client.post(
        `/channels/${channelId}/continue`,
        {
          context: transferContext,
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to play or transfer:', error.message);
      throw error;
    }
  }

  // 获取应用程序列表
  async getApplications() {
    try {
      const response = await this.client.get('/applications');
      return response.data;
    } catch (error) {
      logger.error('Failed to get applications:', error.message);
      throw error;
    }
  }

  // 创建桥接
  async createBridge(bridgeType = 'basic') {
    try {
      const response = await this.client.post('/bridges', {
        type: bridgeType,
      });
      logger.info('Bridge created:', response.data.id);
      return response.data;
    } catch (error) {
      logger.error('Failed to create bridge:', error.message);
      throw error;
    }
  }

  // 添加通道到桥接
  async addChannelToBridge(bridgeId, channelId) {
    try {
      const response = await this.client.post(
        `/bridges/${bridgeId}/addChannel`,
        {
          channel: channelId,
        }
      );
      logger.info(`Channel ${channelId} added to bridge ${bridgeId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to add channel to bridge:', error.message);
      throw error;
    }
  }

  // 从桥接中移除通道
  async removeChannelFromBridge(bridgeId, channelId) {
    try {
      const response = await this.client.post(
        `/bridges/${bridgeId}/removeChannel`,
        {
          channel: channelId,
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to remove channel from bridge:', error.message);
      throw error;
    }
  }

  // 删除桥接
  async deleteBridge(bridgeId) {
    try {
      const response = await this.client.delete(`/bridges/${bridgeId}`);
      logger.info(`Bridge ${bridgeId} deleted`);
      return response.data;
    } catch (error) {
      logger.error('Failed to delete bridge:', error.message);
      throw error;
    }
  }

  // Webhooks - 设置事件订阅
  async subscribeEvents(applicationName, events = ['*']) {
    try {
      const response = await this.client.post(
        `/applications/${applicationName}/subscription`,
        {
          eventSource: events,
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to subscribe to events:', error.message);
      throw error;
    }
  }
}

export default new AsteriskARIClient();
