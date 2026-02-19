import express from 'express';
import recordingService from '../services/recording-service.js';
import authMiddleware from '../middleware/auth.js';
import fs from 'fs';

const router = express.Router();

// 中间件
router.use(authMiddleware);

// 获取录音列表
router.get('/', async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      status,
      archived,
      startDate,
      endDate,
    } = req.query;

    const filters = { status, archived, startDate, endDate };

    const result = await recordingService.getRecordings(
      filters,
      parseInt(limit),
      parseInt(offset)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取录音详情
router.get('/:id', async (req, res) => {
  try {
    const recording = await recordingService.getRecordingDetail(req.params.id);
    res.json(recording);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 下载录音
router.get('/:id/download', async (req, res) => {
  try {
    const recording = await recordingService.getRecordingFile(req.params.id);
    res.download(recording.filePath, recording.filename);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 流式播放录音（支持 Range 断点续传，供前端 <audio> 使用）
router.get('/:id/stream', async (req, res) => {
  try {
    const recording = await recordingService.getRecordingFile(req.params.id);
    const filePath = recording.filePath;
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = filePath.split('.').pop().toLowerCase();
    const mimeMap = { wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', gsm: 'audio/x-gsm' };
    const contentType = mimeMap[ext] || 'audio/wav';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 删除录音
router.delete('/:id', async (req, res) => {
  try {
    const recording = await recordingService.deleteRecording(req.params.id, true);
    res.json({ message: 'Recording deleted successfully', recording });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 存档录音
router.patch('/:id/archive', async (req, res) => {
  try {
    const recording = await recordingService.archiveRecording(req.params.id);
    res.json(recording);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取分机的录音
router.get('/extension/:extensionNumber', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await recordingService.getExtensionRecordings(
      req.params.extensionNumber,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取录音统计
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await recordingService.getRecordingStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
