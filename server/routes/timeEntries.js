import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { createTimeEntry, getTimeEntriesByUser, getAllTimeEntries } from '../db.js';

const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    const { event_type, project, description, timestamp, duration_minutes } = req.body;
    if (!event_type || !timestamp) {
      return res.status(400).json({ error: 'Missing event type or timestamp' });
    }

    const entry = await createTimeEntry({
      user_id: req.user.id,
      event_type,
      project: project ?? null,
      description: description ?? null,
      timestamp,
      duration_minutes: duration_minutes ?? null,
    });

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const role = req.user.role;
    if (role === 'super_admin' || role === 'admin') {
      const rows = await getAllTimeEntries();
      return res.json(rows);
    }

    const rows = await getTimeEntriesByUser(req.user.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
