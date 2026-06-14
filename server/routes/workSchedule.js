import express from 'express';
import { getWorkSchedule, saveWorkSchedule } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const schedule = await getWorkSchedule();
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load work schedule' });
  }
});

router.put('/', async (req, res) => {
  try {
    const schedule = req.body;
    if (!schedule || !Array.isArray(schedule.workDays) || !schedule.startTime || !schedule.endTime) {
      return res.status(400).json({ error: 'Invalid schedule data' });
    }
    const saved = await saveWorkSchedule(schedule);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
