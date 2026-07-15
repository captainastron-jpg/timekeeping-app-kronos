import express from 'express';
import { addHoliday, deleteHoliday, getWorkSchedule, saveWorkSchedule } from '../db.js';

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

router.post('/holidays', async (req, res) => {
  try {
    const { holiday_date, holiday_name, is_working } = req.body;
    if (!holiday_date || !holiday_name || typeof is_working !== 'boolean') {
      return res.status(400).json({ error: 'Invalid holiday data' });
    }

    const savedHoliday = await addHoliday({ holiday_date, holiday_name, is_working });
    res.status(201).json(savedHoliday);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/holidays/:holiday_date', async (req, res) => {
  try {
    const { holiday_date } = req.params;
    if (!holiday_date) {
      return res.status(400).json({ error: 'Missing holiday date' });
    }

    const deleted = await deleteHoliday(holiday_date);
    if (!deleted) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
