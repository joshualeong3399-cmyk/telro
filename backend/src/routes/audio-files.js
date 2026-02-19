import express from 'express';
import multer from 'multer';
import audioFileService from '../services/audio-file-service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: '/tmp/telro-audio-uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authMiddleware);

// GET /api/audio-files
router.get('/', async (req, res) => {
  try {
    const { category, limit = 100, offset = 0 } = req.query;
    const result = await audioFileService.getFiles({ category }, parseInt(limit), parseInt(offset));
    res.json({ audioFiles: result.rows, total: result.count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/audio-files  (multipart upload)
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传音频文件' });
    const meta = {
      name: req.body.name || req.file.originalname,
      description: req.body.description,
      category: req.body.category || 'other',
      uploadedBy: req.user?.id,
    };
    const audioFile = await audioFileService.saveUploadedFile(req.file, meta);
    res.status(201).json(audioFile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/audio-files/:id
router.delete('/:id', async (req, res) => {
  try {
    await audioFileService.deleteFile(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
