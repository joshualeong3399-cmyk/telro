import express from 'express';
import voicemailService from '../services/voicemail-service.js';
import authMiddleware from '../middleware/auth.js';
import fs from 'fs';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    res.json(await voicemailService.getVoicemailBoxes(+limit, +offset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try { res.status(201).json(await voicemailService.createVoicemailBox(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try { res.json(await voicemailService.updateVoicemailBox(req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { res.json(await voicemailService.deleteVoicemailBox(req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// List messages in a voicemail box
router.get('/:id/messages', async (req, res) => {
  try { res.json(await voicemailService.listMessages(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a specific message
router.delete('/:id/messages/:folder/:msgNum', async (req, res) => {
  try {
    res.json(await voicemailService.deleteMessage(req.params.id, req.params.folder, req.params.msgNum));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stream audio of a message
router.get('/:id/messages/:folder/:msgNum/audio', async (req, res) => {
  try {
    const vmb = await voicemailService.getVoicemailBoxes(1, 0); // find by id
    const { id, folder, msgNum } = req.params;
    const [mailboxNum] = (await voicemailService.getByExtensionId ? '' : '');
    const wavPath = `/var/spool/asterisk/voicemail/default/${msgNum}/${folder}/${msgNum}.wav`;
    if (!fs.existsSync(wavPath)) return res.status(404).json({ error: 'Audio file not found' });
    res.setHeader('Content-Type', 'audio/wav');
    fs.createReadStream(wavPath).pipe(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
