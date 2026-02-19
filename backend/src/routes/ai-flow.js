import express from 'express';
import multer from 'multer';
import path from 'path';
import aiFlowService from '../services/ai-flow-service.js';
import audioFileService from '../services/audio-file-service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// Multer setup for audio uploads (temp storage, service moves to final location)
const upload = multer({
  dest: './uploads/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.wav', '.mp3', '.gsm', '.ogg', '.ulaw', '.alaw'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported audio format: ${ext}. Allowed: ${allowed.join(', ')}`));
  },
});

// ─── AI Flows ──────────────────────────────────────────────────────────────────
router.get('/flows', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    res.json(await aiFlowService.getFlows(+limit, +offset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/flows/:id', async (req, res) => {
  try { res.json(await aiFlowService.getFlowDetail(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/flows', async (req, res) => {
  try { res.status(201).json(await aiFlowService.createFlow(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/flows/:id', async (req, res) => {
  try { res.json(await aiFlowService.updateFlow(req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/flows/:id', async (req, res) => {
  try { res.json(await aiFlowService.deleteFlow(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/flows/:id/duplicate', async (req, res) => {
  try { res.json(await aiFlowService.duplicateFlow(req.params.id)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Preview the generated dialplan for a flow
router.get('/flows/:id/dialplan', async (req, res) => {
  try {
    const flow = await aiFlowService.getFlowDetail(req.params.id);
    const dialplan = await aiFlowService.generateFlowDialplan(flow);
    res.json({ flowId: flow.id, name: flow.name, dialplan });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Audio Files ───────────────────────────────────────────────────────────────
router.get('/audio', async (req, res) => {
  try {
    const { category, limit = 100, offset = 0 } = req.query;
    res.json(await audioFileService.getFiles({ category }, +limit, +offset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/audio/:id', async (req, res) => {
  try { res.json(await audioFileService.getFileDetail(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// Stream audio file content
router.get('/audio/:id/play', async (req, res) => {
  try {
    const { stream, file } = await audioFileService.getFileStream(req.params.id);
    res.setHeader('Content-Type', file.mimeType || 'audio/wav');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    stream.pipe(res);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// Upload audio file
router.post('/audio', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const audioFile = await audioFileService.saveUploadedFile(req.file, {
      name: req.body.name || req.file.originalname,
      description: req.body.description,
      category: req.body.category || 'other',
      uploadedBy: req.user?.id,
    });
    res.status(201).json(audioFile);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/audio/:id', async (req, res) => {
  try { res.json(await audioFileService.updateFile(req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/audio/:id', async (req, res) => {
  try { res.json(await audioFileService.deleteFile(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

export default router;
