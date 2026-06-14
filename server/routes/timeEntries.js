import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { createTimeEntry, getTimeEntriesByUser, getTimeEntryById, updateTimeEntry, deleteTimeEntry } from '../db.js';

const router = express.Router();

// Create
router.post('/', verifyToken, async (req, res) => {
  const { project, description, start_time, end_time, duration_minutes } = req.body;
  const entry = await createTimeEntry({ user_id: req.user.id, project, description, start_time, end_time, duration_minutes: duration_minutes || null });
  res.json(entry);
});

// Read all for user
router.get('/', verifyToken, async (req, res) => {
  const rows = await getTimeEntriesByUser(req.user.id);
  res.json(rows);
});

// Read single
router.get('/:id', verifyToken, async (req, res) => {
  const row = await getTimeEntryById(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Update
router.put('/:id', verifyToken, async (req, res) => {
  const { project, description, start_time, end_time, duration_minutes } = req.body;
  const row = await updateTimeEntry(req.params.id, req.user.id, { project, description, start_time, end_time, duration_minutes: duration_minutes || null });
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Delete
router.delete('/:id', verifyToken, async (req, res) => {
  const ok = await deleteTimeEntry(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

export default router;
