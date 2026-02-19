import dotenv from 'dotenv';

dotenv.config();

export default {
  host: process.env.ASTERISK_HOST || 'localhost',
  port: parseInt(process.env.ASTERISK_PORT || '5038'),
  username: process.env.ASTERISK_USER || 'admin',
  secret: process.env.ASTERISK_SECRET || 'amp111',

  // Asterisk 配置文件目录（运行进程需要对此目录有写入权限）
  confPath: process.env.ASTERISK_CONF_PATH || '/etc/asterisk',
  ari: {
    baseUrl: `http://${process.env.ASTERISK_HOST || 'localhost'}:8088/ari`,
    username: process.env.ASTERISK_USER || 'admin',
    password: process.env.ASTERISK_SECRET || 'amp111',
  },
  
  sip: {
    context: process.env.SIP_CONTEXT || 'from-internal',
  },
  
  recording: {
    path: process.env.RECORDING_PATH || './recordings',
    format: process.env.RECORDING_FORMAT || 'wav',
  },
};
