import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '../../logs');

// 确保日志目录存在
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 日志级别
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// 日志格式
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// 定义日志传输
const transports = [
  // 控制台输出
  new winston.transports.Console(),
  
  // 错误日志文件
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
  }),
  
  // 通话日志文件
  new winston.transports.File({
    filename: path.join(logsDir, 'call.log'),
    level: 'info',
  }),
  
  // 计费日志文件
  new winston.transports.File({
    filename: path.join(logsDir, 'billing.log'),
    level: 'info',
  }),
  
  // 应用日志文件
  new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
  }),
];

// 创建日志实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels,
  format,
  transports,
});

export default logger;
